const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');

const router = express.Router();

// GET /api/v1/testers — org's approved testers
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, email, license_number, license_state, license_expiration,
              certifying_body, company_name, company_phone, is_approved, is_verified, test_count, created_at
       FROM certified_testers WHERE org_id = $1 ORDER BY name`,
      [req.org.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// GET /api/v1/testers/public — public directory
router.get('/public', async (req, res) => {
  try {
    const { org_slug } = req.query;
    if (!org_slug) return res.status(400).json({ success: false, error: 'org_slug required', code: 'MISSING_PARAMS' });

    const orgResult = await query('SELECT id FROM organizations WHERE slug=$1 AND status=$2', [org_slug, 'active']);
    if (!orgResult.rows[0]) return res.status(404).json({ success: false, error: 'Organization not found', code: 'NOT_FOUND' });

    const { rows } = await query(
      `SELECT name, company_name, company_phone, license_number, license_state, license_expiration, certifying_body
       FROM certified_testers WHERE org_id=$1 AND is_approved=true
       AND license_expiration > NOW() ORDER BY name`,
      [orgResult.rows[0].id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// POST /api/v1/testers/register — public self-registration
router.post('/register', async (req, res) => {
  try {
    const {
      org_slug, email, name, password, license_number, license_state,
      license_expiration, certifying_body, certification_type,
      company_name, company_phone, gauge_serial, gauge_cal_date,
    } = req.body;

    if (!org_slug || !email || !name || !password || !license_number || !license_state || !license_expiration) {
      return res.status(400).json({ success: false, error: 'Required fields missing', code: 'MISSING_FIELDS' });
    }

    const orgResult = await query('SELECT id FROM organizations WHERE slug=$1 AND status=$2', [org_slug, 'active']);
    if (!orgResult.rows[0]) return res.status(404).json({ success: false, error: 'Organization not found', code: 'NOT_FOUND' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO certified_testers (org_id, email, name, password_hash, license_number, license_state,
         license_expiration, certifying_body, certification_type, company_name, company_phone,
         gauge_serial, gauge_cal_date, is_approved)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false) RETURNING id, name, email`,
      [orgResult.rows[0].id, email.toLowerCase(), name, hash, license_number, license_state.toUpperCase(),
       license_expiration, certifying_body, certification_type || 'general',
       company_name, company_phone, gauge_serial, gauge_cal_date]
    );

    res.status(201).json({ success: true, data: rows[0], message: 'Registration submitted. Awaiting admin approval.' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'Email already registered', code: 'DUPLICATE_EMAIL' });
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// PUT /api/v1/testers/:id/approve
router.put('/:id/approve', async (req, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' });
  try {
    const { rows } = await query(
      'UPDATE certified_testers SET is_approved=true WHERE id=$1 AND org_id=$2 RETURNING id, name, email',
      [req.params.id, req.org.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Tester not found', code: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// PUT /api/v1/testers/:id/reject
router.put('/:id/reject', async (req, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' });
  try {
    const { rows } = await query(
      'DELETE FROM certified_testers WHERE id=$1 AND org_id=$2 AND is_approved=false RETURNING id',
      [req.params.id, req.org.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Tester not found or already approved', code: 'NOT_FOUND' });
    res.json({ success: true, data: { id: rows[0].id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
