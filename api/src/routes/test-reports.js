const express = require('express');
const { query } = require('../db');
const notifications = require('../services/notifications');

const router = express.Router();

const VALID_TYPES = ['RP', 'DC', 'PVB', 'SVB', 'AG', 'DCDA', 'RPDA'];

// POST /api/v1/reports — tester portal submission
router.post('/', async (req, res) => {
  try {
    const {
      device_id, tester_id, test_date, test_event_type = 'annual',
      reading_cv1_initial, reading_cv1_final, reading_cv2_initial, reading_cv2_final,
      reading_rv_opened, reading_air_inlet,
      result, repair_made = false, repair_description, notes, pdf_url, photo_urls,
    } = req.body;

    if (!device_id || !tester_id || !test_date || !result) {
      return res.status(400).json({ success: false, error: 'device_id, tester_id, test_date, result required', code: 'MISSING_FIELDS' });
    }
    if (!['pass', 'fail'].includes(result)) {
      return res.status(400).json({ success: false, error: 'result must be pass or fail', code: 'INVALID_RESULT' });
    }

    // Verify device exists (lookup by device_id, get org_id from device)
    const deviceResult = await query(
      'SELECT d.*, o.id as org_id FROM devices d JOIN organizations o ON o.id = d.org_id WHERE d.id = $1',
      [device_id]
    );
    const device = deviceResult.rows[0];
    if (!device) return res.status(404).json({ success: false, error: 'Device not found', code: 'NOT_FOUND' });

    // Validate tester license
    const testerResult = await query(
      'SELECT * FROM certified_testers WHERE id = $1 AND is_approved = true',
      [tester_id]
    );
    const tester = testerResult.rows[0];
    if (!tester) return res.status(403).json({ success: false, error: 'Tester not approved', code: 'TESTER_NOT_APPROVED' });
    if (new Date(tester.license_expiration) < new Date()) {
      return res.status(403).json({ success: false, error: 'Tester license expired', code: 'LICENSE_EXPIRED' });
    }
    if (tester.gauge_cal_date) {
      const calAge = (Date.now() - new Date(tester.gauge_cal_date)) / (1000 * 60 * 60 * 24 * 365);
      if (calAge > 1) return res.status(403).json({ success: false, error: 'Gauge calibration expired', code: 'GAUGE_EXPIRED' });
    }

    // Validate readings (no negatives)
    const readings = [reading_cv1_initial, reading_cv1_final, reading_cv2_initial, reading_cv2_final, reading_rv_opened, reading_air_inlet];
    if (readings.some(r => r !== undefined && r !== null && parseFloat(r) < 0)) {
      return res.status(400).json({ success: false, error: 'Readings cannot be negative', code: 'INVALID_READING' });
    }

    const retest_required = result === 'fail';
    const cw_sync_status = device.org_id && result === 'fail' ? 'pending' : 'not_applicable';

    const { rows } = await query(
      `INSERT INTO test_reports (device_id, tester_id, test_date, test_event_type,
         reading_cv1_initial, reading_cv1_final, reading_cv2_initial, reading_cv2_final,
         reading_rv_opened, reading_air_inlet, result, repair_made, repair_description,
         retest_required, notes, pdf_url, photo_urls, cw_sync_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [device_id, tester_id, test_date, test_event_type,
       reading_cv1_initial, reading_cv1_final, reading_cv2_initial, reading_cv2_final,
       reading_rv_opened, reading_air_inlet, result, repair_made, repair_description,
       retest_required, notes, pdf_url, JSON.stringify(photo_urls || []), cw_sync_status]
    );
    const report = rows[0];

    // Update device last test info
    const nextDue = new Date(test_date);
    nextDue.setMonth(nextDue.getMonth() + (device.test_frequency_months || 12));

    await query(
      `UPDATE devices SET last_test_date=$1, last_test_result=$2, next_test_due=$3,
         pending_test_event = CASE WHEN $2='fail' THEN 'post_repair' ELSE NULL END,
         updated_at=NOW() WHERE id=$4`,
      [test_date, result, nextDue.toISOString().split('T')[0], device_id]
    );

    // Increment tester test count
    await query('UPDATE certified_testers SET test_count = test_count + 1 WHERE id = $1', [tester_id]);

    // If fail, create violation
    if (result === 'fail') {
      const deadline = new Date(test_date);
      deadline.setDate(deadline.getDate() + 30);
      await query(
        `INSERT INTO violations (org_id, device_id, test_report_id, violation_type, issued_date, compliance_deadline)
         VALUES ($1,$2,$3,'failed_test',$4,$5)`,
        [device.org_id, device_id, report.id, test_date, deadline.toISOString().split('T')[0]]
      );
    }

    // Send notifications asynchronously — never block the response
    setImmediate(async () => {
      try {
        const propResult = await query(
          `SELECT p.owner_name, p.owner_email, p.owner_phone, p.address_line1, p.city, p.state
           FROM properties p JOIN devices d ON d.property_id = p.id WHERE d.id = $1`,
          [device_id]
        );
        const orgResult = await query('SELECT id, name FROM organizations WHERE id = $1', [device.org_id]);
        const owner = propResult.rows[0];
        const org = orgResult.rows[0];
        const deviceWithAddr = { ...device, ...propResult.rows[0] };
        if (owner && org) {
          if (result === 'fail') {
            const deadline = new Date(test_date);
            deadline.setDate(deadline.getDate() + 30);
            await notifications.sendTestFailedNotice({ device: deviceWithAddr, owner, org, testReport: report, tester, complianceDeadline: deadline.toISOString().split('T')[0] });
          } else {
            await notifications.sendTestSubmittedConfirmation({ device: deviceWithAddr, owner, org, testReport: report, tester });
          }
        }
      } catch (notifyErr) {
        console.error('Notification error (non-fatal):', notifyErr.message);
      }
    });

    res.status(201).json({ success: true, data: report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// GET /api/v1/reports
router.get('/', async (req, res) => {
  try {
    const { result, status, device_id, page = 1, per_page = 50 } = req.query;
    const offset = (page - 1) * per_page;
    const params = [req.org.id];
    let where = 'WHERE d.org_id = $1';

    if (result) { params.push(result); where += ` AND tr.result = $${params.length}`; }
    if (status) { params.push(status); where += ` AND tr.status = $${params.length}`; }
    if (device_id) { params.push(device_id); where += ` AND tr.device_id = $${params.length}`; }

    const countResult = await query(
      `SELECT COUNT(*) FROM test_reports tr JOIN devices d ON d.id = tr.device_id ${where}`, params
    );

    params.push(per_page, offset);
    const { rows } = await query(
      `SELECT tr.*, d.tag_number, d.assembly_type, d.size,
              p.address_line1, p.city, ct.name as tester_name, ct.license_number
       FROM test_reports tr
       JOIN devices d ON d.id = tr.device_id
       JOIN properties p ON p.id = d.property_id
       JOIN certified_testers ct ON ct.id = tr.tester_id
       ${where} ORDER BY tr.submitted_at DESC
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

// GET /api/v1/reports/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT tr.*, d.tag_number, d.assembly_type, d.size, d.org_id,
              p.address_line1, p.city, p.state,
              ct.name as tester_name, ct.license_number, ct.company_name
       FROM test_reports tr
       JOIN devices d ON d.id = tr.device_id
       JOIN properties p ON p.id = d.property_id
       JOIN certified_testers ct ON ct.id = tr.tester_id
       WHERE tr.id = $1 AND d.org_id = $2`,
      [req.params.id, req.org.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Report not found', code: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// PUT /api/v1/reports/:id/review — admin accept/reject
router.put('/:id/review', async (req, res) => {
  if (req.user.role === 'readonly') {
    return res.status(403).json({ success: false, error: 'Insufficient permissions', code: 'FORBIDDEN' });
  }
  try {
    const { status, notes } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'status must be accepted or rejected', code: 'INVALID_STATUS' });
    }

    const { rows } = await query(
      `UPDATE test_reports SET status=$1, reviewed_at=NOW(), reviewed_by=$2
       WHERE id=$3 RETURNING *`,
      [status, req.user.user_id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Report not found', code: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
