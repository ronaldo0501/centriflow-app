const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /api/v1/fees
router.get('/', async (req, res) => {
  try {
    const { status, fee_type, page = 1, per_page = 50 } = req.query;
    const offset = (page - 1) * per_page;
    const params = [req.org.id];
    let where = 'WHERE f.org_id = $1';

    if (status) { params.push(status); where += ` AND f.status = $${params.length}`; }
    if (fee_type) { params.push(fee_type); where += ` AND f.fee_type = $${params.length}`; }

    const countResult = await query(`SELECT COUNT(*) FROM fees f ${where}`, params);

    params.push(per_page, offset);
    const { rows } = await query(
      `SELECT f.*, d.tag_number, p.address_line1, p.city, p.owner_name, p.owner_email
       FROM fees f
       LEFT JOIN devices d ON d.id = f.device_id
       LEFT JOIN properties p ON p.id = d.property_id
       ${where} ORDER BY f.created_at DESC
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

// POST /api/v1/fees/:id/waive
router.post('/:id/waive', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin only', code: 'FORBIDDEN' });
  try {
    const { waive_reason } = req.body;
    if (!waive_reason) return res.status(400).json({ success: false, error: 'waive_reason required', code: 'MISSING_FIELDS' });

    const { rows } = await query(
      `UPDATE fees SET status='waived', waived_by=$1, waive_reason=$2
       WHERE id=$3 AND org_id=$4 AND status='pending' RETURNING *`,
      [req.user.user_id, waive_reason, req.params.id, req.org.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Fee not found or not pending', code: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// POST /api/v1/fees/checkout — create Stripe Checkout session (stub for now)
router.post('/checkout', async (req, res) => {
  try {
    const { fee_id } = req.body;
    const { rows } = await query('SELECT * FROM fees WHERE id=$1 AND org_id=$2', [fee_id, req.org.id]);
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Fee not found', code: 'NOT_FOUND' });

    // Stripe Checkout integration added in Phase 5 billing sprint
    res.status(501).json({ success: false, error: 'Stripe checkout not yet configured', code: 'NOT_IMPLEMENTED' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
