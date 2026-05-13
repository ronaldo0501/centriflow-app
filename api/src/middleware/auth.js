const jwt = require('jsonwebtoken');

const PUBLIC_PATHS = [
  '/auth/',
  '/api/v1/devices/lookup',
  '/api/v1/testers/register',
  '/api/v1/testers/public',
  '/webhooks/',
  '/health',
];

const authMiddleware = (req, res, next) => {
  const isPublic = PUBLIC_PATHS.some(p => req.path.startsWith(p));
  if (isPublic) return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing auth token', code: 'NO_TOKEN' });
  }

  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }
};

module.exports = authMiddleware;
