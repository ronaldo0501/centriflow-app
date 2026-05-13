'use strict';

const { query } = require('../db');

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

let logger;
try {
  logger = require('winston').createLogger({
    level: 'info',
    format: require('winston').format.combine(
      require('winston').format.timestamp(),
      require('winston').format.json()
    ),
    transports: [new require('winston').transports.Console()],
  });
} catch (_) {
  logger = {
    info: (...a) => console.log('[usc-list]', ...a),
    warn: (...a) => console.warn('[usc-list]', ...a),
    error: (...a) => console.error('[usc-list]', ...a),
  };
}

// ---------------------------------------------------------------------------
// CSV parser — manual implementation (csv-parse not in package.json)
// ---------------------------------------------------------------------------

/**
 * Parse a CSV string into an array of objects keyed by the header row.
 * Handles basic quoted fields. Returns [] on empty / header-only input.
 */
function parseCSVText(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse a single CSV line respecting double-quoted fields
  const parseLine = (line) => {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped double-quote inside quoted field
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const rawHeaders = parseLine(lines[0]);
  // Normalize header names: lowercase, strip non-alphanumeric (keep spaces → _)
  const headers = rawHeaders.map(h =>
    h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  );

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (vals[idx] || '').trim();
    });
    // Skip fully empty rows
    if (Object.values(row).every(v => !v)) continue;
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Size normalization
// Standardises: '3/4 "', '3/4"', '3/4 inch' → '3/4"'
// ---------------------------------------------------------------------------

function normalizeSize(raw) {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/\s*inch(es)?/gi, '"')
    .replace(/\s*in\b/gi, '"')
    .replace(/\s+"/, '"')   // remove space before closing quote character
    .replace(/’|”|`/g, '"') // curly quotes → straight
    .trim();
}

// ---------------------------------------------------------------------------
// importFromCSV
// ---------------------------------------------------------------------------

/**
 * Parse USC FCCCHR (or state-equivalent) CSV and upsert into assembly_approved_models.
 *
 * Expected CSV columns (case-insensitive, spaces ok):
 *   Assembly Type, Manufacturer, Model Number, Size, Orientation,
 *   Approval Date, Renewal Date, Lead Free
 *
 * @param {string} csvText  Raw CSV text
 * @param {string} listSource  'usc' | 'ca' | 'sc' | 'ny' | 'tx'  (default 'usc')
 * @returns {{ inserted: number, updated: number, removed: number, errors: string[] }}
 */
async function importFromCSV(csvText, listSource = 'usc') {
  const counts = { inserted: 0, updated: 0, removed: 0, errors: [] };

  let rows;
  try {
    rows = parseCSVText(csvText);
  } catch (err) {
    counts.errors.push(`CSV parse failed: ${err.message}`);
    return counts;
  }

  if (rows.length === 0) {
    counts.errors.push('No data rows found in CSV');
    return counts;
  }

  const today = new Date().toISOString().slice(0, 10);

  // Track the unique keys we successfully processed so we can mark others inactive
  const processedKeys = new Set();

  for (const row of rows) {
    try {
      // Map CSV column names to our schema — try multiple possible header variants
      const assemblyType = (
        row.assembly_type || row.type || row.assembly || ''
      ).trim().toUpperCase();

      const manufacturer = (row.manufacturer || row.mfr || row.brand || '').trim();
      const modelNumber  = (row.model_number || row.model || row.model_no || '').trim();
      const rawSize      = row.size || row.nominal_size || '';
      const size         = normalizeSize(rawSize);
      const orientation  = (row.orientation || '').trim() || null;

      // Parse dates — accept YYYY-MM-DD or MM/DD/YYYY
      const parseDate = (val) => {
        if (!val) return null;
        const v = val.trim();
        if (!v || v.toLowerCase() === 'n/a') return null;
        // MM/DD/YYYY → YYYY-MM-DD
        const mdy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
        return v;
      };

      const approvalDate = parseDate(row.approval_date || row.date_approved || row.approved);
      const renewalDate  = parseDate(row.renewal_date  || row.date_renewal  || row.expires);
      const isLeadFree   = /^(yes|true|1|y)$/i.test(
        (row.lead_free || row.leadfree || row.is_lead_free || '').trim()
      );

      if (!assemblyType || !manufacturer || !modelNumber || !size) {
        counts.errors.push(
          `Skipping row — missing required fields: type=${assemblyType} mfr=${manufacturer} model=${modelNumber} size=${rawSize}`
        );
        continue;
      }

      const key = `${listSource}|${assemblyType}|${manufacturer.toLowerCase()}|${modelNumber.toLowerCase()}|${size}`;
      processedKeys.add(key);

      const result = await query(
        `INSERT INTO assembly_approved_models
           (list_source, assembly_type, manufacturer, model_number, size,
            orientation, approval_date, renewal_date, is_lead_free, is_current, list_updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10)
         ON CONFLICT (list_source, assembly_type, manufacturer, model_number, size)
         DO UPDATE SET
           orientation    = EXCLUDED.orientation,
           approval_date  = EXCLUDED.approval_date,
           renewal_date   = EXCLUDED.renewal_date,
           is_lead_free   = EXCLUDED.is_lead_free,
           is_current     = TRUE,
           list_updated_at = EXCLUDED.list_updated_at
         RETURNING (xmax = 0) AS was_inserted`,
        [listSource, assemblyType, manufacturer, modelNumber, size,
         orientation, approvalDate, renewalDate, isLeadFree, today]
      );

      if (result.rows[0]?.was_inserted) {
        counts.inserted++;
      } else {
        counts.updated++;
      }
    } catch (err) {
      counts.errors.push(`Row error: ${err.message}`);
    }
  }

  // Mark rows not in this import as inactive (handles removals from the USC list)
  try {
    const removeResult = await query(
      `UPDATE assembly_approved_models
       SET is_current = FALSE
       WHERE list_source = $1
         AND is_current = TRUE
         AND list_updated_at < $2`,
      [listSource, today]
    );
    counts.removed = removeResult.rowCount || 0;
  } catch (err) {
    counts.errors.push(`Failed to mark removed rows: ${err.message}`);
  }

  logger.info({
    msg: 'importFromCSV complete',
    listSource,
    ...counts,
  });

  return counts;
}

// ---------------------------------------------------------------------------
// validateAssembly
// ---------------------------------------------------------------------------

/**
 * Check whether a device's assembly is on an approved list.
 *
 * Returns { approved: boolean|null, isLeadFree: boolean|null, match: object|null }
 * Never throws — returns nulls on DB error or missing inputs.
 *
 * @param {{ assemblyType, manufacturer, modelNumber, size, orgApprovedSources }}
 */
async function validateAssembly({ assemblyType, manufacturer, modelNumber, size, orgApprovedSources }) {
  // Can't validate without enough info
  if (!manufacturer || !modelNumber || !assemblyType || !size) {
    return { approved: null, isLeadFree: null, match: null };
  }

  const sources = Array.isArray(orgApprovedSources) && orgApprovedSources.length > 0
    ? orgApprovedSources
    : ['usc'];

  try {
    // Normalize size for comparison
    const normalizedSize = normalizeSize(size);

    // Fuzzy manufacturer match: device might store "Watts Regulator" while list says "Watts"
    // We split on the first word of the manufacturer and use LIKE
    const mfrFirstWord = manufacturer.trim().split(/\s+/)[0];

    const result = await query(
      `SELECT id, list_source, assembly_type, manufacturer, model_number, size,
              is_lead_free, approval_date, renewal_date
       FROM assembly_approved_models
       WHERE list_source = ANY($1)
         AND is_current = TRUE
         AND UPPER(assembly_type) = UPPER($2)
         AND LOWER(manufacturer) LIKE LOWER($3)
         AND LOWER(model_number) = LOWER($4)
       LIMIT 10`,
      [sources, assemblyType, `${mfrFirstWord}%`, modelNumber.trim()]
    );

    if (result.rows.length === 0) {
      return { approved: false, isLeadFree: null, match: null };
    }

    // Filter by size (normalize both sides)
    const sizeMatch = result.rows.find(
      r => normalizeSize(r.size) === normalizedSize
    );

    if (!sizeMatch) {
      return { approved: false, isLeadFree: null, match: null };
    }

    return {
      approved: true,
      isLeadFree: sizeMatch.is_lead_free ?? null,
      match: sizeMatch,
    };
  } catch (err) {
    logger.error({ msg: 'validateAssembly DB error', error: err.message });
    return { approved: null, isLeadFree: null, match: null };
  }
}

// ---------------------------------------------------------------------------
// updateDeviceValidationStatus
// ---------------------------------------------------------------------------

/**
 * Re-validate a single device and update usc_approved + is_lead_free.
 * Never throws.
 *
 * @param {string} deviceId  UUID
 * @returns {{ approved: boolean|null, isLeadFree: boolean|null, match: object|null }}
 */
async function updateDeviceValidationStatus(deviceId) {
  try {
    const deviceResult = await query(
      `SELECT d.assembly_type, d.manufacturer, d.model_number, d.size, d.org_id
       FROM devices d
       WHERE d.id = $1`,
      [deviceId]
    );

    if (!deviceResult.rows[0]) {
      logger.warn({ msg: 'updateDeviceValidationStatus — device not found', deviceId });
      return { approved: null, isLeadFree: null, match: null };
    }

    const device = deviceResult.rows[0];

    const orgResult = await query(
      `SELECT approved_list_sources FROM organizations WHERE id = $1`,
      [device.org_id]
    );

    const orgApprovedSources = orgResult.rows[0]?.approved_list_sources || ['usc'];

    const validationResult = await validateAssembly({
      assemblyType: device.assembly_type,
      manufacturer: device.manufacturer,
      modelNumber:  device.model_number,
      size:         device.size,
      orgApprovedSources,
    });

    // Only update if we got a definitive answer (not null)
    if (validationResult.approved !== null) {
      await query(
        `UPDATE devices
         SET usc_approved = $1,
             is_lead_free = $2,
             updated_at   = NOW()
         WHERE id = $3`,
        [validationResult.approved, validationResult.isLeadFree, deviceId]
      );

      logger.info({
        msg: 'Device validation updated',
        deviceId,
        approved: validationResult.approved,
        isLeadFree: validationResult.isLeadFree,
      });
    }

    return validationResult;
  } catch (err) {
    logger.error({ msg: 'updateDeviceValidationStatus error', deviceId, error: err.message });
    return { approved: null, isLeadFree: null, match: null };
  }
}

// ---------------------------------------------------------------------------
// seedSampleData
// ---------------------------------------------------------------------------

/**
 * Insert a representative set of common approved assemblies for dev/demo use.
 * Uses the same upsert pattern as importFromCSV.
 *
 * @returns {number} Number of rows inserted/updated
 */
async function seedSampleData() {
  const today = new Date().toISOString().slice(0, 10);

  // ~20 common USC-approved assemblies
  const assemblies = [
    // Watts 009M2 (RP) — multiple sizes
    { assembly_type: 'RP', manufacturer: 'Watts', model_number: '009M2', size: '3/4"', is_lead_free: true },
    { assembly_type: 'RP', manufacturer: 'Watts', model_number: '009M2', size: '1"',   is_lead_free: true },
    { assembly_type: 'RP', manufacturer: 'Watts', model_number: '009M2', size: '1-1/2"', is_lead_free: true },
    { assembly_type: 'RP', manufacturer: 'Watts', model_number: '009M2', size: '2"',   is_lead_free: true },
    // Febco 850 (DC)
    { assembly_type: 'DC', manufacturer: 'Febco', model_number: '850',   size: '3/4"', is_lead_free: true },
    { assembly_type: 'DC', manufacturer: 'Febco', model_number: '850',   size: '1"',   is_lead_free: true },
    { assembly_type: 'DC', manufacturer: 'Febco', model_number: '850',   size: '1-1/2"', is_lead_free: false },
    { assembly_type: 'DC', manufacturer: 'Febco', model_number: '850',   size: '2"',   is_lead_free: false },
    // Ames 4000SS (RP)
    { assembly_type: 'RP', manufacturer: 'Ames',  model_number: '4000SS', size: '3/4"', is_lead_free: true },
    { assembly_type: 'RP', manufacturer: 'Ames',  model_number: '4000SS', size: '1"',   is_lead_free: true },
    // Wilkins 975XL (RP)
    { assembly_type: 'RP', manufacturer: 'Wilkins', model_number: '975XL', size: '3/4"', is_lead_free: true },
    { assembly_type: 'RP', manufacturer: 'Wilkins', model_number: '975XL', size: '1"',   is_lead_free: true },
    // Conbraco 40-200 (DC)
    { assembly_type: 'DC', manufacturer: 'Conbraco', model_number: '40-200', size: '3/4"', is_lead_free: false },
    { assembly_type: 'DC', manufacturer: 'Conbraco', model_number: '40-200', size: '1"',   is_lead_free: false },
    // Watts 007M2 (DC)
    { assembly_type: 'DC', manufacturer: 'Watts', model_number: '007M2', size: '3/4"', is_lead_free: true },
    { assembly_type: 'DC', manufacturer: 'Watts', model_number: '007M2', size: '1"',   is_lead_free: true },
    // Febco 765 (PVB)
    { assembly_type: 'PVB', manufacturer: 'Febco', model_number: '765',   size: '3/4"', is_lead_free: true },
    { assembly_type: 'PVB', manufacturer: 'Febco', model_number: '765',   size: '1"',   is_lead_free: true },
    // Watts 800M4 (PVB)
    { assembly_type: 'PVB', manufacturer: 'Watts', model_number: '800M4', size: '3/4"', is_lead_free: true },
    { assembly_type: 'PVB', manufacturer: 'Watts', model_number: '800M4', size: '1"',   is_lead_free: true },
  ];

  let count = 0;
  for (const a of assemblies) {
    try {
      await query(
        `INSERT INTO assembly_approved_models
           (list_source, assembly_type, manufacturer, model_number, size,
            is_lead_free, is_current, list_updated_at)
         VALUES ('usc', $1, $2, $3, $4, $5, TRUE, $6)
         ON CONFLICT (list_source, assembly_type, manufacturer, model_number, size)
         DO UPDATE SET
           is_lead_free    = EXCLUDED.is_lead_free,
           is_current      = TRUE,
           list_updated_at = EXCLUDED.list_updated_at`,
        [a.assembly_type, a.manufacturer, a.model_number, a.size, a.is_lead_free, today]
      );
      count++;
    } catch (err) {
      logger.error({ msg: 'seedSampleData row error', assembly: a, error: err.message });
    }
  }

  logger.info({ msg: 'seedSampleData complete', count });
  return count;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  importFromCSV,
  validateAssembly,
  updateDeviceValidationStatus,
  seedSampleData,
};
