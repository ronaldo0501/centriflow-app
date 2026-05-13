const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/v1/annual-report/:year
router.get('/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ success: false, error: 'Invalid year', code: 'INVALID_YEAR' });
    }
    const orgId = req.org.id;
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const [devicesRes, testsRes, violationsRes, testersRes] = await Promise.all([
      query(
        `SELECT d.last_test_result, d.next_test_due, d.assembly_type
         FROM devices d WHERE d.org_id = $1 AND d.status = 'active'`,
        [orgId]
      ),
      query(
        `SELECT tr.result, tr.test_date, EXTRACT(MONTH FROM tr.test_date) AS month
         FROM test_reports tr
         JOIN devices d ON d.id = tr.device_id
         WHERE d.org_id = $1 AND tr.test_date BETWEEN $2 AND $3`,
        [orgId, startDate, endDate]
      ),
      query(
        `SELECT v.status FROM violations v WHERE v.org_id = $1
         AND (v.issued_date BETWEEN $2 AND $3 OR v.resolved_date BETWEEN $2 AND $3 OR v.status = 'open')`,
        [orgId, startDate, endDate]
      ),
      query(
        `SELECT COUNT(DISTINCT ct.id) AS count
         FROM certified_testers ct
         JOIN test_reports tr ON tr.tester_id = ct.id
         JOIN devices d ON d.id = tr.device_id
         WHERE d.org_id = $1 AND tr.test_date BETWEEN $2 AND $3`,
        [orgId, startDate, endDate]
      ),
    ]);

    const devices = devicesRes.rows;
    const tests = testsRes.rows;

    const total_devices = devices.length;
    const tested = tests.length;
    const passed = tests.filter(t => t.result === 'pass').length;
    const failed = tests.filter(t => t.result === 'fail').length;
    const not_tested = devices.filter(d => d.last_test_result === 'not_tested').length;
    const compliance_rate = total_devices === 0 ? 0 : ((total_devices - not_tested) / total_devices) * 100;

    const now = new Date();
    const overdue = devices.filter(d => {
      if (!d.next_test_due) return false;
      return new Date(d.next_test_due) < now;
    }).length;

    const open_violations = violationsRes.rows.filter(v => v.status === 'open').length;
    const resolved_violations = violationsRes.rows.filter(v => v.status === 'resolved').length;

    // Assembly type breakdown
    const typeCounts = {};
    devices.forEach(d => { typeCounts[d.assembly_type] = (typeCounts[d.assembly_type] || 0) + 1; });
    const top_assembly_types = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));

    // Monthly breakdown
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthly = {};
    tests.forEach(t => {
      const m = parseInt(t.month, 10);
      if (!monthly[m]) monthly[m] = { count: 0, pass: 0, fail: 0 };
      monthly[m].count++;
      if (t.result === 'pass') monthly[m].pass++;
      if (t.result === 'fail') monthly[m].fail++;
    });
    const monthly_tests = Object.entries(monthly)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([m, stats]) => ({ month: monthNames[Number(m) - 1], ...stats }));

    return res.json({
      success: true,
      data: {
        year,
        total_devices,
        tested,
        passed,
        failed,
        not_tested,
        overdue,
        compliance_rate,
        open_violations,
        resolved_violations,
        new_devices: 0,
        testers_active: parseInt(testersRes.rows[0]?.count || '0', 10),
        top_assembly_types,
        monthly_tests,
      },
    });
  } catch (err) {
    console.error('annual-report error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate report', code: 'REPORT_ERROR' });
  }
});

// POST /api/v1/annual-report/:year/generate  — PDF generation (stub; full impl in Phase 7)
router.post('/:year/generate', async (req, res) => {
  return res.status(501).json({
    success: false,
    error: 'PDF generation not yet configured — requires Puppeteer setup',
    code: 'NOT_IMPLEMENTED',
  });
});

module.exports = router;
