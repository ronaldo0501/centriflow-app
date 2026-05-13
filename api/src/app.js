const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authMiddleware = require('./middleware/auth');
const { orgResolver } = require('./middleware/orgResolver');

const authRoutes = require('./routes/auth');
const orgRoutes = require('./routes/organizations');
const deviceRoutes = require('./routes/devices');
const reportRoutes = require('./routes/test-reports');
const violationRoutes = require('./routes/violations');
const testerRoutes = require('./routes/testers');
const feeRoutes = require('./routes/fees');
const surveyRoutes = require('./routes/surveys');
const annualReportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');

const app = express();

// Security + logging
app.use(helmet());
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.APP_URL,
].filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, server-to-server)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(morgan('dev'));

// Raw body for Stripe webhooks — must come before express.json()
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// Body parsing
app.use(express.json());

// Health check — no auth required
app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

// Auth + org resolution (order matters)
app.use(authMiddleware);
app.use(orgResolver);

// Routes
app.use('/auth', authRoutes);
app.use('/api/v1/org', orgRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/violations', violationRoutes);
app.use('/api/v1/testers', testerRoutes);
app.use('/api/v1/fees', feeRoutes);
app.use('/api/v1/surveys', surveyRoutes);
app.use('/api/v1/annual-report', annualReportRoutes);
app.use('/api/v1/admin', adminRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found', code: 'NOT_FOUND' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Internal server error', code: 'SERVER_ERROR' });
});

module.exports = app;
