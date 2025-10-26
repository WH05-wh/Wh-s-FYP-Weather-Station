// ==============================
// 🌦 ESP32 MQTT Push Bridge Server
// ==============================

// --- Required Modules ---
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mqtt = require('mqtt');
const webpush = require('web-push');
const path = require('path');

// --- Express Setup ---
const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public'))); // ✅ Serve frontend files

// --- MQTT Broker Configuration ---
const MQTT_URL = 'wss://broker.hivemq.com:8884/mqtt'; // Public HiveMQ WebSocket broker
const MQTT_TOPICS = ['esp32/rain', 'esp32/temp', 'esp32/hum']; // Topics published by ESP32

// --- VAPID Keys (Push Notification Auth) ---
const VAPID_PUBLIC = 'BBiul0FRmUT8rMriHAofq--doFLEkOsEzzn6RYFXo1_mBBRSbnaabHbUwqYeO1kXc1MgC8jh64P4zddWfTcEukc';
const VAPID_PRIVATE = 'MlHhkEhC9fAQVSCk2VTvPAJ077ePl1x_T81oNVYi0m8';
const VAPID_EMAIL = 'mailto:Wooihong0185@gmail.com';

// --- Web Push Configuration ---
webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

// --- In-memory list of subscribed clients ---
const subscriptions = new Set();

// --- Default Route ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Subscription Route (Frontend subscribes here) ---
app.post('/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }

  subscriptions.add(JSON.stringify(sub));
  console.log('📬 New subscription added:', sub.endpoint);
  res.status(201).json({ success: true });
});

// --- MQTT Client Setup ---
const mqttClient = mqtt.connect(MQTT_URL);

mqttClient.on('connect', () => {
  console.log('📡 Connected to MQTT broker');
  MQTT_TOPICS.forEach(topic => mqttClient.subscribe(topic));
});

// --- Variables to store last known states ---
let lastRain = null;
let lastHum = null;

// --- MQTT Message Handling ---
mqttClient.on('message', (topic, messageBuffer) => {
  const message = messageBuffer.toString();
  console.log(`📩 MQTT message on [${topic}]: ${message}`);

  // 🌧 Only send notifications for rain and humidity > 95%
  let shouldNotify = false;
  let payload = null;

  if (topic === 'esp32/rain') {
    if (message === '0' && lastRain !== '0') {
      // 0 = Rain detected
      shouldNotify = true;
      payload = {
        title: '🌧 Rain Detected',
        body: 'Rain detected by your ESP32 weather station!',
        url: '/'
      };
    }
    lastRain = message;
  }

  if (topic === 'esp32/hum') {
    const humidity = parseFloat(message);
    if (humidity > 95 && (!lastHum || lastHum <= 95)) {
      shouldNotify = true;
      payload = {
        title: '💧 High Humidity Alert',
        body: `Humidity level is ${humidity}% — possible rain soon!`,
        url: '/'
      };
    }
    lastHum = humidity;
  }

  // Only send notifications when condition is met
  if (shouldNotify && payload) {
    console.log('📢 Sending push notification:', payload.title);
    subscriptions.forEach(subStr => {
      const sub = JSON.parse(subStr);
      webpush.sendNotification(sub, JSON.stringify(payload))
        .catch(err => {
          console.error('❌ Push send failed:', err.statusCode);
          if (err.statusCode === 410 || err.statusCode === 404) {
            subscriptions.delete(subStr); // Remove expired subscriptions
          }
        });
    });
  }
});

// --- Start the Server ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 MQTT Push Bridge running on http://localhost:${PORT}`);
  console.log(`🌍 Serving static files from: ${path.join(__dirname, 'public')}`);
});
