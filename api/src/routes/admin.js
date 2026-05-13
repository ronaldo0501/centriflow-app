'use strict';

const express = require('express');
const { query } = require('../db');
const { importFromCSV } = require('../services/usc-list');
const { triggerRefresh } = require('../workers/usc-refresh-worker');

const router = express.Router();

// ---------------------------------------------------------------------------
// Auth guard — all admin routes require admin role
// ---------------------------------------------------------------------------

router.use((req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin role required', code: 'FORBIDDEN' });
  }
  next();
});

// ---------------------------------------------------------------------------
// POST /api/v1/admin/usc/refresh — trigger manual USC list refresh
// ---------------------------------------------------------------------------

router.post('/usc/refresh', async (req, res) => {
  try {
    await triggerRefresh();
    res.json({ success: true, message: 'Refresh queued' });
  } catch (err) {
    console.error('[admin] usc/refresh error:', err);
    res.status(500).json({ success: false, error: 'Failed to queue refresh', code: 'SERVER_ERROR' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/admin/usc/status — assembly_approved_models counts by list_source
// ---------------------------------------------------------------------------

router.get('/usc/status', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT
         list_source,
         COUNT(*) AS count,
         MAX(list_updated_at) AS last_updated
       FROM assembly_approved_models
       WHERE is_current = TRUE
       GROUP BY list_source
       ORDER BY list_source`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[admin] usc/status error:', err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/admin/usc/import — import raw CSV text
// Body: { csv_text: string, list_source?: string }
// ---------------------------------------------------------------------------

router.post('/usc/import', async (req, res) => {
  try {
    const { csv_text, list_source } = req.body;

    if (!csv_text || typeof csv_text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'csv_text (string) is required in request body',
        code: 'MISSING_FIELDS',
      });
    }

    const result = await importFromCSV(csv_text, list_source || 'usc');

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[admin] usc/import error:', err);
    res.status(500).json({ success: false, error: 'Import failed', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
