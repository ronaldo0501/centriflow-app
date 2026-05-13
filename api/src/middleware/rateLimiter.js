const rateLimit = {};
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 100;
const AUTH_MAX = process.env.NODE_ENV === 'development' ? 1000 : 10;

const limiter = (max) => (req, res, next) => {
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const entry = rateLimit[key] || { count: 0, start: now };

  if (now - entry.start > WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }

  entry.count++;
  rateLimit[key] = entry;

  if (entry.count > max) {
    return res.status(429).json({ success: false, error: 'Too many requests', code: 'RATE_LIMITED' });
  }
  next();
};

module.exports = {
  apiLimiter: limiter(MAX_REQUESTS),
  authLimiter: limiter(AUTH_MAX),
};
