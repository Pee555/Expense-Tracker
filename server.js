require('dotenv').config();
const express = require('express');
const multer = require('multer');
// const lineWebhook = require('./webhook/line-webhook');

const app = express();
// const PORT = process.env.PORT || 3000;
const PORT = process.env.PORT || 8080;
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Routes
app.get('/', (req, res) => {
  res.json({ status: 'Hello from Railway!' });
});

// LINE Webhook
// app.post('/webhook', lineWebhook);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

console.log('ENV:', process.env);
