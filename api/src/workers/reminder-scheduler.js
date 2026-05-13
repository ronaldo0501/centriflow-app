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
    info: (...a) => console.log('[reminder-scheduler]', ...a),
    warn: (...a) => console.warn('[reminder-scheduler]', ...a),
    error: (...a) => console.error('[reminder-scheduler]', ...a),
  };
}

// ---------------------------------------------------------------------------
// Queue setup
// ---------------------------------------------------------------------------

let reminderQueue;

try {
  reminderQueue = new Queue('reminders', process.env.REDIS_URL, {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  reminderQueue.on('error', (err) => {
    logger.error({ msg: 'Reminder queue error', error: err.message });
  });

  reminderQueue.on('failed', (job, err) => {
    logger.error({ msg: 'Reminder job failed', jobId: job.id, deviceId: job.data.deviceId, error: err.message });
  });
} catch (err) {
  logger.error({ msg: 'Failed to connect reminder queue to Redis — workers disabled', error: err.message });
  reminderQueue = null;
}

// ---------------------------------------------------------------------------
// Reminder thresholds (days until due)
// ---------------------------------------------------------------------------

const REMINDER_THRESHOLDS = [90, 60, 30, 7]; // days before due date
const DEDUP_WINDOW_DAYS = 3; // don't re-send same template within this many days

// ---------------------------------------------------------------------------
// scheduleReminders — scans all active devices and enqueues reminder jobs
// ---------------------------------------------------------------------------

const scheduleReminders = async () => {
  if (!reminderQueue) {
    logger.warn({ msg: 'scheduleReminders skipped — queue not available' });
    return;
  }

  logger.info({ msg: 'scheduleReminders started' });

  let devices;
  try {
    const result = await query(
      `SELECT
         d.id,
         d.org_id,
         d.tag_number,
         d.assembly_type,
         d.size,
         d.next_test_due,
         d.status,
         p.address_line1,
         p.city,
         p.state,
         p.owner_name,
         p.owner_email,
         p.owner_phone
       FROM devices d
       JOIN properties p ON p.id = d.property_id
       WHERE d.status = 'active'
         AND d.next_test_due IS NOT NULL`
    );
    devices = result.rows;
  } catch (err) {
    logger.error({ msg: 'scheduleReminders — DB query failed', error: err.message });
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let enqueued = 0;

  for (const device of devices) {
    try {
      const dueDate = new Date(device.next_test_due);
      dueDate.setHours(0, 0, 0, 0);
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysUntilDue = Math.round((dueDate - today) / msPerDay);

      // Check if this device falls within ±1 day of a reminder threshold
      const matchedThreshold = REMINDER_THRESHOLDS.find(
        (t) => Math.abs(daysUntilDue - t) <= 1
      );

      if (matchedThreshold === undefined) continue;

      // Only send "due" reminders for future due dates; overdue handled by violations worker
      if (daysUntilDue < 0) continue;

      const templateType = 'test_due';

      // De-duplication check — skip if same template was sent for this device in the last DEDUP_WINDOW_DAYS
      const dedupResult = await query(
        `SELECT id FROM notifications_log
         WHERE device_id = $1
           AND template_type = $2
           AND sent_at > NOW() - INTERVAL '${DEDUP_WINDOW_DAYS} days'
         LIMIT 1`,
        [device.id, templateType]
      );

      if (dedupResult.rows.length > 0) {
        logger.info({ msg: 'Reminder dedup — skipping', deviceId: device.id, daysUntilDue });
        continue;
      }

      // Enqueue the job
      await reminderQueue.add(
        { deviceId: device.id, orgId: device.org_id, daysUntilDue },
        { jobId: `reminder:${device.id}:${matchedThreshold}d` }
      );
      enqueued++;
    } catch (err) {
      logger.error({ msg: 'scheduleReminders — error processing device', deviceId: device.id, error: err.message });
      // Continue to next device
    }
  }

  logger.info({ msg: 'scheduleReminders complete', devicesScanned: devices.length, jobsEnqueued: enqueued });
};

// ---------------------------------------------------------------------------
// Queue processor
// ---------------------------------------------------------------------------

if (reminderQueue) {
  reminderQueue.process(async (job) => {
    const { deviceId, orgId, daysUntilDue } = job.data;

    // Fetch device + property info
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
      logger.warn({ msg: 'Reminder job — device not found', deviceId });
      return;
    }

    const device = deviceResult.rows[0];

    // Fetch org
    const orgResult = await query(
      `SELECT id, name, slug FROM organizations WHERE id = $1`,
      [orgId]
    );

    if (orgResult.rows.length === 0) {
      logger.warn({ msg: 'Reminder job — org not found', orgId });
      return;
    }

    const org = orgResult.rows[0];

    // Build owner object from property columns
    const owner = {
      owner_name: device.owner_name,
      owner_email: device.owner_email,
      owner_phone: device.owner_phone,
    };

    await notifications.sendTestDueReminder({ device, owner, org, daysUntilDue });

    logger.info({ msg: 'Reminder job processed', deviceId, daysUntilDue });
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { reminderQueue, scheduleReminders };
