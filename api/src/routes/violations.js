const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /api/v1/violations
router.get('/', async (req, res) => {
  try {
    const { status, violation_type, page = 1, per_page = 50 } = req.query;
    const offset = (page - 1) * per_page;
    const params = [req.org.id];
    let where = 'WHERE v.org_id = $1';

    if (status) { params.push(status); where += ` AND v.status = $${params.length}`; }
    if (violation_type) { params.push(violation_type); where += ` AND v.violation_type = $${params.length}`; }

    const countResult = await query(`SELECT COUNT(*) FROM violations v ${where}`, params);

    params.push(per_page, offset);
    const { rows } = await query(
      `SELECT v.*, d.tag_number, d.assembly_type, p.address_line1, p.city, p.owner_name, p.owner_email
       FROM violations v
       JOIN devices d ON d.id = v.device_id
       JOIN properties p ON p.id = d.property_id
       ${where} ORDER BY v.issued_date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: rows,
      meta: { total: parseInt(countResult.rows[0].count), page: parseInt(page), per_page: parseInt(per_page) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// PUT /api/v1/violations/:id/resolve
router.put('/:id/resolve', async (req, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' });
  try {
    const { notes } = req.body;
    const { rows } = await query(
      `UPDATE violations SET status='resolved', resolved_date=NOW(), notes=COALESCE($1,notes)
       WHERE id=$2 AND org_id=$3 RETURNING *`,
      [notes, req.params.id, req.org.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Violation not found', code: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// PUT /api/v1/violations/:id/waive
router.put('/:id/waive', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin only', code: 'FORBIDDEN' });
  try {
    const { waive_reason } = req.body;
    if (!waive_reason) return res.status(400).json({ success: false, error: 'waive_reason required', code: 'MISSING_FIELDS' });

    const { rows } = await query(
      `UPDATE violations SET status='waived', waived_by=$1, waive_reason=$2, resolved_date=NOW()
       WHERE id=$3 AND org_id=$4 RETURNING *`,
      [req.user.user_id, waive_reason, req.params.id, req.org.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Violation not found', code: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// POST /api/v1/violations/:id/actions — log enforcement action
router.post('/:id/actions', async (req, res) => {
  try {
    const { notes } = req.body;
    const { rows } = await query(
      `UPDATE violations SET status='in_progress', notes=COALESCE($1,notes)
       WHERE id=$2 AND org_id=$3 RETURNING *`,
      [notes, req.params.id, req.org.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Violation not found', code: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
