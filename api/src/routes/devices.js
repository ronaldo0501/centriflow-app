const express = require('express');
const { query } = require('../db');
const { updateDeviceValidationStatus } = require('../services/usc-list');

const router = express.Router();

// GET /api/v1/devices — paginated list with filters
router.get('/', async (req, res) => {
  try {
    const { status = 'active', assembly_type, hazard, search, page = 1, per_page = 50 } = req.query;
    const offset = (page - 1) * per_page;
    const params = [req.org.id];
    let where = 'WHERE d.org_id = $1';

    if (status) { params.push(status); where += ` AND d.status = $${params.length}`; }
    if (assembly_type) { params.push(assembly_type); where += ` AND d.assembly_type = $${params.length}`; }
    if (hazard) { params.push(hazard); where += ` AND d.hazard_classification = $${params.length}`; }
    if (search) { params.push(`%${search}%`); where += ` AND (d.tag_number ILIKE $${params.length} OR p.address_line1 ILIKE $${params.length})`; }

    const countResult = await query(
      `SELECT COUNT(*) FROM devices d JOIN properties p ON p.id = d.property_id ${where}`,
      params
    );

    params.push(per_page, offset);
    const { rows } = await query(
      `SELECT d.*, p.address_line1, p.city, p.state, p.zip, p.owner_name, p.owner_email, p.owner_phone
       FROM devices d JOIN properties p ON p.id = d.property_id
       ${where} ORDER BY d.tag_number LIMIT $${params.length - 1} OFFSET $${params.length}`,
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

// GET /api/v1/devices/due — devices due in 30/60/90 days
router.get('/due', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const { rows } = await query(
      `SELECT d.*, p.address_line1, p.city, p.owner_name, p.owner_email, p.owner_phone
       FROM devices d JOIN properties p ON p.id = d.property_id
       WHERE d.org_id = $1 AND d.status = 'active'
         AND d.next_test_due <= NOW() + ($2 || ' days')::INTERVAL
         AND d.next_test_due >= NOW()
       ORDER BY d.next_test_due ASC`,
      [req.org.id, days]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// GET /api/v1/devices/lookup — public device search for tester portal
router.get('/lookup', async (req, res) => {
  try {
    const { tag, address, org_slug } = req.query;
    if (!org_slug || (!tag && !address)) {
      return res.status(400).json({ success: false, error: 'org_slug and tag or address required', code: 'MISSING_PARAMS' });
    }

    const orgResult = await query('SELECT id FROM organizations WHERE slug = $1 AND status = $2', [org_slug, 'active']);
    if (!orgResult.rows[0]) {
      return res.status(404).json({ success: false, error: 'Organization not found', code: 'ORG_NOT_FOUND' });
    }
    const orgId = orgResult.rows[0].id;

    const params = [orgId];
    let where = 'WHERE d.org_id = $1 AND d.status = \'active\'';
    if (tag) { params.push(tag); where += ` AND d.tag_number ILIKE $${params.length}`; }
    if (address) { params.push(`%${address}%`); where += ` AND p.address_line1 ILIKE $${params.length}`; }

    const { rows } = await query(
      `SELECT d.id, d.tag_number, d.assembly_type, d.size, d.manufacturer, d.model_number,
              d.last_test_date, d.last_test_result, d.next_test_due, d.hazard_classification,
              p.address_line1, p.city, p.state, p.zip
       FROM devices d JOIN properties p ON p.id = d.property_id ${where} LIMIT 20`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// GET /api/v1/devices/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT d.*, p.address_line1, p.city, p.state, p.zip, p.owner_name, p.owner_email, p.owner_phone
       FROM devices d JOIN properties p ON p.id = d.property_id
       WHERE d.id = $1 AND d.org_id = $2`,
      [req.params.id, req.org.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Device not found', code: 'NOT_FOUND' });

    const { rows: reports } = await query(
      `SELECT tr.*, ct.name as tester_name FROM test_reports tr
       JOIN certified_testers ct ON ct.id = tr.tester_id
       WHERE tr.device_id = $1 ORDER BY tr.test_date DESC LIMIT 5`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...rows[0], recent_tests: reports } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// POST /api/v1/devices
router.post('/', async (req, res) => {
  try {
    const {
      property_id, tag_number, assembly_type, size, manufacturer, model_number,
      serial_number, hazard_classification, service_type, location_notes,
      install_date, test_frequency_months, lat, lng,
    } = req.body;

    if (!property_id || !tag_number || !assembly_type || !size || !hazard_classification) {
      return res.status(400).json({ success: false, error: 'Missing required fields', code: 'MISSING_FIELDS' });
    }

    const VALID_TYPES = ['RP', 'DC', 'PVB', 'SVB', 'AG', 'DCDA', 'RPDA'];
    if (!VALID_TYPES.includes(assembly_type)) {
      return res.status(400).json({ success: false, error: `Invalid assembly_type. Must be one of: ${VALID_TYPES.join(', ')}`, code: 'INVALID_ASSEMBLY_TYPE' });
    }

    const propCheck = await query('SELECT id FROM properties WHERE id = $1 AND org_id = $2', [property_id, req.org.id]);
    if (!propCheck.rows[0]) return res.status(404).json({ success: false, error: 'Property not found', code: 'NOT_FOUND' });

    const geom = lat && lng ? `ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326)` : 'NULL';

    const { rows } = await query(
      `INSERT INTO devices (org_id, property_id, tag_number, assembly_type, size, manufacturer,
         model_number, serial_number, hazard_classification, service_type, location_notes,
         install_date, test_frequency_months, pending_test_event, geom)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'installation',${geom}) RETURNING *`,
      [req.org.id, property_id, tag_number, assembly_type, size, manufacturer,
       model_number, serial_number, hazard_classification, service_type, location_notes,
       install_date, test_frequency_months || 12]
    );

    // Kick off USC validation asynchronously — don't block the response
    setImmediate(() => updateDeviceValidationStatus(rows[0].id));

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'Tag number already exists for this org', code: 'DUPLICATE_TAG' });
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// PUT /api/v1/devices/:id
router.put('/:id', async (req, res) => {
  try {
    const {
      assembly_type, size, manufacturer, model_number, serial_number,
      hazard_classification, service_type, location_notes, install_date,
      test_frequency_months, status, lat, lng,
    } = req.body;

    const existing = await query('SELECT id FROM devices WHERE id = $1 AND org_id = $2', [req.params.id, req.org.id]);
    if (!existing.rows[0]) return res.status(404).json({ success: false, error: 'Device not found', code: 'NOT_FOUND' });

    const geomClause = lat && lng
      ? `, geom = ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326)`
      : '';

    const { rows } = await query(
      `UPDATE devices SET
         assembly_type         = COALESCE($1, assembly_type),
         size                  = COALESCE($2, size),
         manufacturer          = COALESCE($3, manufacturer),
         model_number          = COALESCE($4, model_number),
         serial_number         = COALESCE($5, serial_number),
         hazard_classification = COALESCE($6, hazard_classification),
         service_type          = COALESCE($7, service_type),
         location_notes        = COALESCE($8, location_notes),
         install_date          = COALESCE($9, install_date),
         test_frequency_months = COALESCE($10, test_frequency_months),
         status                = COALESCE($11, status),
         updated_at            = NOW()
         ${geomClause}
       WHERE id = $12 AND org_id = $13 RETURNING *`,
      [assembly_type, size, manufacturer, model_number, serial_number,
       hazard_classification, service_type, location_notes, install_date,
       test_frequency_months, status, req.params.id, req.org.id]
    );

    // Re-validate USC status if any assembly-identifying fields changed
    const assemblyFieldsChanged = assembly_type !== undefined || size !== undefined
      || manufacturer !== undefined || model_number !== undefined;
    if (assemblyFieldsChanged) {
      setImmediate(() => updateDeviceValidationStatus(req.params.id));
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// DELETE /api/v1/devices/:id — soft delete
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE devices SET status = 'removed', updated_at = NOW()
       WHERE id = $1 AND org_id = $2 RETURNING id`,
      [req.params.id, req.org.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Device not found', code: 'NOT_FOUND' });
    res.json({ success: true, data: { id: rows[0].id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// POST /api/v1/devices/import — bulk import
router.post('/import', async (req, res) => {
  try {
    const { devices } = req.body;
    if (!Array.isArray(devices) || devices.length === 0) {
      return res.status(400).json({ success: false, error: 'devices array required', code: 'MISSING_FIELDS' });
    }

    const results = { created: 0, skipped: 0, errors: [] };

    for (const d of devices) {
      try {
        // Upsert property
        const propResult = await query(
          `INSERT INTO properties (org_id, address_line1, city, state, zip, owner_name, owner_email, owner_phone)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT DO NOTHING RETURNING id`,
          [req.org.id, d.address_line1, d.city, d.state || req.org.state, d.zip, d.owner_name, d.owner_email, d.owner_phone]
        );

        let propertyId = propResult.rows[0]?.id;
        if (!propertyId) {
          const existing = await query(
            'SELECT id FROM properties WHERE org_id=$1 AND address_line1=$2 AND city=$3',
            [req.org.id, d.address_line1, d.city]
          );
          propertyId = existing.rows[0]?.id;
        }
        if (!propertyId) { results.errors.push({ tag: d.tag_number, error: 'Could not resolve property' }); continue; }

        const insertResult = await query(
          `INSERT INTO devices (org_id, property_id, tag_number, assembly_type, size, manufacturer,
             model_number, serial_number, hazard_classification, service_type, last_test_date,
             last_test_result, next_test_due, pending_test_event)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (org_id, tag_number) DO NOTHING
           RETURNING id`,
          [req.org.id, propertyId, d.tag_number, d.assembly_type, d.size, d.manufacturer,
           d.model_number, d.serial_number, d.hazard_classification || 'low', d.service_type,
           d.last_test_date, d.last_test_result || 'not_tested', d.next_test_due,
           d.last_test_date ? null : 'initial']
        );
        results.created++;

        // Kick off USC validation asynchronously for each imported device
        if (insertResult.rows[0]?.id) {
          const importedDeviceId = insertResult.rows[0].id;
          setImmediate(() => updateDeviceValidationStatus(importedDeviceId));
        }
      } catch (e) {
        results.errors.push({ tag: d.tag_number, error: e.message });
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
