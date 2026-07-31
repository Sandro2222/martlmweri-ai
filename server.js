// Local development server. On Vercel this file is unused — api/check.js runs
// as a serverless function instead. Both share the logic in lib/checker.js.
require('dotenv').config();
const express = require('express');
const path = require('path');
const { checkText } = require('./lib/checker');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// --- Very small in-memory rate limiter so a public deployment can't drain your Groq quota. ---
// Adjust MAX_REQUESTS / WINDOW_MS to taste, or swap for a real store (Redis) if you scale up.
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 15;     // requests per IP per window
const hits = new Map();

function rateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }
  entry.count += 1;
  hits.set(ip, entry);
  if (entry.count > MAX_REQUESTS) {
    return res.status(429).json({ error: 'მოთხოვნები ძალიან ხშირია, გთხოვთ სცადოთ ცოტა ხანში.' });
  }
  next();
}

app.post('/api/check', rateLimit, async (req, res) => {
  try {
    const { status, body } = await checkText(req.body && req.body.text);
    res.status(status).json(body);
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'უცნობი შეცდომა.' });
  }
});

app.listen(PORT, () => {
  console.log(`MartlweraAI სერვერი გაშვებულია: http://localhost:${PORT}`);
});
