const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const signTokens = (payload) => ({
  token: jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' }),
  refreshToken: jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' }),
});

// POST /auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required', code: 'MISSING_FIELDS' });
    }

    const { rows } = await query(
      'SELECT u.*, o.slug as org_slug FROM users u JOIN organizations o ON o.id = u.org_id WHERE u.email = $1',
      [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ success: false, error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
    }

    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const payload = { user_id: user.id, org_id: user.org_id, role: user.role };
    const { token, refreshToken } = signTokens(payload);

    res.json({
      success: true,
      data: {
        token,
        refresh_token: refreshToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        org: { id: user.org_id, slug: user.org_slug },
      },
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ success: false, error: 'Refresh token required', code: 'MISSING_TOKEN' });
    }

    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    const payload = { user_id: decoded.user_id, org_id: decoded.org_id, role: decoded.role };
    const { token, refreshToken } = signTokens(payload);

    res.json({ success: true, data: { token, refresh_token: refreshToken } });
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid or expired refresh token', code: 'INVALID_REFRESH_TOKEN' });
  }
});

// POST /auth/register-org
router.post('/register-org', authLimiter, async (req, res) => {
  try {
    const { org_name, org_slug, state, timezone, admin_name, admin_email, admin_password } = req.body;
    if (!org_name || !org_slug || !state || !admin_name || !admin_email || !admin_password) {
      return res.status(400).json({ success: false, error: 'All fields required', code: 'MISSING_FIELDS' });
    }

    const existing = await query('SELECT id FROM organizations WHERE slug = $1', [org_slug]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Org slug already taken', code: 'SLUG_TAKEN' });
    }

    const orgResult = await query(
      `INSERT INTO organizations (name, slug, state, timezone, plan_tier, status)
       VALUES ($1, $2, $3, $4, 'starter', 'onboarding') RETURNING id`,
      [org_name, org_slug.toLowerCase(), state.toUpperCase(), timezone || 'America/Denver']
    );
    const orgId = orgResult.rows[0].id;

    const hash = await bcrypt.hash(admin_password, 10);
    await query(
      'INSERT INTO users (org_id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)',
      [orgId, admin_email.toLowerCase(), hash, admin_name, 'admin']
    );

    res.status(201).json({ success: true, data: { org_id: orgId, slug: org_slug } });
  } catch (err) {
    console.error('register-org error:', err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// POST /auth/tester-login
router.post('/tester-login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required', code: 'MISSING_FIELDS' });
    }

    const { rows } = await query(
      'SELECT * FROM certified_testers WHERE email = $1 AND is_approved = true',
      [email.toLowerCase()]
    );
    const tester = rows[0];
    if (!tester || !(await bcrypt.compare(password, tester.password_hash || ''))) {
      return res.status(401).json({ success: false, error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
    }

    if (new Date(tester.license_expiration) < new Date()) {
      return res.status(403).json({ success: false, error: 'License expired', code: 'LICENSE_EXPIRED' });
    }

    const payload = { tester_id: tester.id, type: 'tester' };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    res.json({
      success: true,
      data: {
        token,
        tester: { id: tester.id, name: tester.name, email: tester.email, license_number: tester.license_number },
      },
    });
  } catch (err) {
    console.error('tester-login error:', err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
