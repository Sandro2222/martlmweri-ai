// Vercel serverless function — POST /api/check
// Local dev uses server.js instead; both share lib/checker.js.
// On Vercel env vars are injected by the platform; locally we read .env.
if (!process.env.VERCEL) {
  try { require('dotenv').config(); } catch { /* dotenv is optional here */ }
}
const { checkText } = require('../lib/checker');

// Very small in-memory rate limiter. Note: serverless instances are ephemeral
// and not shared, so this only throttles bursts hitting the same warm instance.
// For strict global limits use a shared store (Upstash Redis, Vercel KV).
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 15;     // requests per IP per window
const hits = new Map();

function rateLimited(req) {
  const fwd = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd || '').split(',')[0].trim()
    || (req.socket && req.socket.remoteAddress) || 'unknown';
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }
  entry.count += 1;
  hits.set(ip, entry);
  return entry.count > MAX_REQUESTS;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'მხოლოდ POST მოთხოვნაა დაშვებული.' });
  }

  if (rateLimited(req)) {
    return res.status(429).json({ error: 'მოთხოვნები ძალიან ხშირია, გთხოვთ სცადოთ ცოტა ხანში.' });
  }

  try {
    // Vercel parses JSON bodies automatically, but guard against a raw string.
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const { status, body: payload } = await checkText(body && body.text);
    return res.status(status).json(payload);
  } catch (err) {
    return res.status(500).json({ error: (err && err.message) || 'უცნობი შეცდომა.' });
  }
};
