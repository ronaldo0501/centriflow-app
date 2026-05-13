const express = require('express');
const { query } = require('../db');
const { invalidateOrgCache } = require('../middleware/orgResolver');

const router = express.Router();

// GET /api/v1/org — current org settings
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, slug, state, timezone, plan_tier, device_limit,
              cw_enabled, cw_sync_mode, fee_config, org_settings,
              approved_list_sources, lob_enabled, status, created_at
       FROM organizations WHERE id = $1`,
      [req.org.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// PATCH /api/v1/org — update org settings
router.patch('/', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin only', code: 'FORBIDDEN' });
  }
  try {
    const { name, timezone, org_settings, fee_config, lob_enabled } = req.body;
    const { rows } = await query(
      `UPDATE organizations SET
         name        = COALESCE($1, name),
         timezone    = COALESCE($2, timezone),
         org_settings = COALESCE($3, org_settings),
         fee_config  = COALESCE($4, fee_config),
         lob_enabled = COALESCE($5, lob_enabled)
       WHERE id = $6 RETURNING *`,
      [name, timezone, org_settings ? JSON.stringify(org_settings) : null,
       fee_config ? JSON.stringify(fee_config) : null, lob_enabled, req.org.id]
    );
    invalidateOrgCache(req.org.id, req.org.slug);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
