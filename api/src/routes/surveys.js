const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /api/v1/surveys
router.get('/', async (req, res) => {
  try {
    const { outcome, page = 1, per_page = 50 } = req.query;
    const offset = (page - 1) * per_page;
    const params = [req.org.id];
    let where = 'WHERE s.org_id = $1';

    if (outcome) { params.push(outcome); where += ` AND s.outcome = $${params.length}`; }

    const countResult = await query(`SELECT COUNT(*) FROM surveys s ${where}`, params);

    params.push(per_page, offset);
    const { rows } = await query(
      `SELECT s.*, u.name as inspector_name, p.address_line1, p.city
       FROM surveys s
       LEFT JOIN users u ON u.id = s.inspector_id
       LEFT JOIN properties p ON p.id = s.property_id
       ${where} ORDER BY s.survey_date DESC
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

// GET /api/v1/surveys/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT s.*, u.name as inspector_name, p.address_line1, p.city, p.state
       FROM surveys s
       LEFT JOIN users u ON u.id = s.inspector_id
       LEFT JOIN properties p ON p.id = s.property_id
       WHERE s.id=$1 AND s.org_id=$2`,
      [req.params.id, req.org.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Survey not found', code: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// POST /api/v1/surveys
router.post('/', async (req, res) => {
  try {
    const {
      property_id, survey_address, survey_date, survey_method, establishment_type,
      cross_connection_found, hazard_level, assembly_required, recommended_type,
      recommended_size, outcome, next_survey_due, notes, photos,
    } = req.body;

    if (!survey_date || !outcome) {
      return res.status(400).json({ success: false, error: 'survey_date and outcome required', code: 'MISSING_FIELDS' });
    }

    const { rows } = await query(
      `INSERT INTO surveys (org_id, property_id, survey_address, survey_date, inspector_id,
         survey_method, establishment_type, cross_connection_found, hazard_level,
         assembly_required, recommended_type, recommended_size, outcome, next_survey_due, notes, photos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [req.org.id, property_id, survey_address, survey_date, req.user.user_id,
       survey_method, establishment_type, cross_connection_found, hazard_level,
       assembly_required, recommended_type, recommended_size, outcome, next_survey_due,
       notes, JSON.stringify(photos || [])]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// PUT /api/v1/surveys/:id
router.put('/:id', async (req, res) => {
  try {
    const { outcome, notes, next_survey_due, resulting_device_id } = req.body;
    const { rows } = await query(
      `UPDATE surveys SET
         outcome             = COALESCE($1, outcome),
         notes               = COALESCE($2, notes),
         next_survey_due     = COALESCE($3, next_survey_due),
         resulting_device_id = COALESCE($4, resulting_device_id)
       WHERE id=$5 AND org_id=$6 RETURNING *`,
      [outcome, notes, next_survey_due, resulting_device_id, req.params.id, req.org.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Survey not found', code: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
