'use strict';

const Queue = require('bull');
const { query } = require('../db');
const notifications = require('../services/notifications');

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
    info: (...a) => console.log('[violations-worker]', ...a),
    warn: (...a) => console.warn('[violations-worker]', ...a),
    error: (...a) => console.error('[violations-worker]', ...a),
  };
}

// ---------------------------------------------------------------------------
// Queue setup
// ---------------------------------------------------------------------------

let violationsQueue;

try {
  violationsQueue = new Queue('violations', process.env.REDIS_URL, {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  violationsQueue.on('error', (err) => {
    logger.error({ msg: 'Violations queue error', error: err.message });
  });

  violationsQueue.on('failed', (job, err) => {
    logger.error({ msg: 'Violations job failed', jobId: job.id, deviceId: job.data?.deviceId, error: err.message });
  });
} catch (err) {
  logger.error({ msg: 'Failed to connect violations queue to Redis — workers disabled', error: err.message });
  violationsQueue = null;
}

// ---------------------------------------------------------------------------
// Noncompliance fee tier thresholds that trigger notifications + fees
// ---------------------------------------------------------------------------

const OVERDUE_MILESTONES = [30, 60, 90]; // days overdue

// ---------------------------------------------------------------------------
// checkForViolations — main entry point, called daily at 7am
// ---------------------------------------------------------------------------

const checkForViolations = async () => {
  if (!violationsQueue) {
    logger.warn({ msg: 'checkForViolations skipped — queue not available' });
    return;
  }

  logger.info({ msg: 'checkForViolations started' });

  let overdueDevices;
  try {
    const result = await query(
      `SELECT
         d.id,
         d.org_id,
         d.tag_number,
         d.assembly_type,
         d.size,
         d.next_test_due,
         d.last_test_result,
         p.address_line1,
         p.city,
         p.state,
         p.owner_name,
         p.owner_email,
         p.owner_phone,
         o.fee_config
       FROM devices d
       JOIN properties p ON p.id = d.property_id
       JOIN organizations o ON o.id = d.org_id
       WHERE d.status = 'active'
         AND d.next_test_due < CURRENT_DATE`
    );
    overdueDevices = result.rows;
  } catch (err) {
    logger.error({ msg: 'checkForViolations — DB query failed', error: err.message });
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;

  let processed = 0;

  for (const device of overdueDevices) {
    try {
      const dueDate = new Date(device.next_test_due);
      dueDate.setHours(0, 0, 0, 0);
      const daysOverdue = Math.round((today - dueDate) / msPerDay);

      if (daysOverdue <= 0) continue;

      await violationsQueue.add(
        { deviceId: device.id, orgId: device.org_id, daysOverdue },
        { jobId: `violation:${device.id}:${today.toISOString().slice(0, 10)}` }
      );
      processed++;
    } catch (err) {
      logger.error({ msg: 'checkForViolations — error enqueuing device', deviceId: device.id, error: err.message });
    }
  }

  logger.info({ msg: 'checkForViolations complete', devicesScanned: overdueDevices.length, jobsEnqueued: processed });
};

// ---------------------------------------------------------------------------
// Queue processor
// ---------------------------------------------------------------------------

if (violationsQueue) {
  violationsQueue.process(async (job) => {
    const { deviceId, orgId, daysOverdue } = job.data;

    // Fetch device, property, and org data
    const deviceResult = await query(
      `SELECT
         d.id,
         d.org_id,
         d.tag_number,
         d.assembly_type,
         d.size,
         d.next_test_due,
         p.address_line1,
         p.city,
         p.state,
         p.owner_name,
         p.owner_email,
         p.owner_phone
       FROM devices d
       JOIN properties p ON p.id = d.property_id
       WHERE d.id = $1 AND d.org_id = $2`,
      [deviceId, orgId]
    );

    if (deviceResult.rows.length === 0) {
      logger.warn({ msg: 'Violations job — device not found', deviceId });
      return;
    }

    const device = deviceResult.rows[0];

    const orgResult = await query(
      `SELECT id, name, slug, fee_config FROM organizations WHERE id = $1`,
      [orgId]
    );

    if (orgResult.rows.length === 0) {
      logger.warn({ msg: 'Violations job — org not found', orgId });
      return;
    }

    const org = orgResult.rows[0];
    const feeConfig = org.fee_config || {};

    const owner = {
      owner_name: device.owner_name,
      owner_email: device.owner_email,
      owner_phone: device.owner_phone,
    };

    // ── Step 1: Create violation record at 30-day mark ───────────────────────
    if (daysOverdue >= 30) {
      const currentYear = new Date().getFullYear();

      // Use ON CONFLICT DO NOTHING to safely de-duplicate
      // Unique key: org_id + device_id + violation_type + year of issued_date
      try {
        await query(
          `INSERT INTO violations
             (org_id, device_id, violation_type, issued_date, compliance_deadline, status)
           SELECT $1, $2, 'overdue', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'open'
           WHERE NOT EXISTS (
             SELECT 1 FROM violations
             WHERE device_id = $2
               AND violation_type = 'overdue'
               AND EXTRACT(YEAR FROM issued_date) = $3
               AND status != 'resolved'
               AND status != 'waived'
           )`,
          [orgId, deviceId, currentYear]
        );
      } catch (err) {
        logger.error({ msg: 'Failed to insert violation record', deviceId, error: err.message });
      }
    }

    // ── Step 2: Create noncompliance fee rows at 30/60/90 milestones ─────────
    const noncomplianceConfig = feeConfig.noncompliance_fee;
    if (noncomplianceConfig?.enabled && Array.isArray(noncomplianceConfig.tiers)) {
      for (const tier of noncomplianceConfig.tiers) {
        // Only process this tier if daysOverdue is within a 2-day window of the threshold
        // (prevents creating the same fee on every daily run)
        if (Math.abs(daysOverdue - tier.days_overdue) > 1) continue;

        try {
          await query(
            `INSERT INTO fees
               (org_id, device_id, fee_type, fee_payer, amount, platform_fee, status, due_date)
             SELECT $1, $2, 'noncompliance', 'property_owner', $3, $4, 'pending', CURRENT_DATE + INTERVAL '30 days'
             WHERE NOT EXISTS (
               SELECT 1 FROM fees
               WHERE device_id = $2
                 AND fee_type = 'noncompliance'
                 AND amount = $3
                 AND created_at > NOW() - INTERVAL '5 days'
             )`,
            [orgId, deviceId, tier.amount, feeConfig.centriflow_platform_fee?.amount ?? 2.50]
          );
          logger.info({ msg: 'Noncompliance fee created', deviceId, tier: tier.days_overdue, amount: tier.amount });
        } catch (err) {
          logger.error({ msg: 'Failed to insert noncompliance fee', deviceId, error: err.message });
        }
      }
    }

    // ── Step 3: Send overdue notification at each milestone ───────────────────
    const isMilestone = OVERDUE_MILESTONES.some((m) => Math.abs(daysOverdue - m) <= 1);

    if (isMilestone) {
      // De-dup: skip if we already sent an overdue reminder for this device within 3 days
      const dedupResult = await query(
        `SELECT id FROM notifications_log
         WHERE device_id = $1
           AND template_type = 'test_overdue'
           AND sent_at > NOW() - INTERVAL '3 days'
         LIMIT 1`,
        [deviceId]
      );

      if (dedupResult.rows.length === 0) {
        await notifications.sendTestOverdueReminder({ device, owner, org, daysOverdue });
        logger.info({ msg: 'Overdue notification sent', deviceId, daysOverdue });
      } else {
        logger.info({ msg: 'Overdue notification dedup — skipped', deviceId, daysOverdue });
      }
    }

    logger.info({ msg: 'Violations job processed', deviceId, daysOverdue });
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { violationsQueue, checkForViolations };
