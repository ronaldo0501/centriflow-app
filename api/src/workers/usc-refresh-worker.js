'use strict';

const Queue = require('bull');

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
    info: (...a) => console.log('[usc-refresh-worker]', ...a),
    warn: (...a) => console.warn('[usc-refresh-worker]', ...a),
    error: (...a) => console.error('[usc-refresh-worker]', ...a),
  };
}

// ---------------------------------------------------------------------------
// Queue setup — same fault-tolerant pattern as reminder-scheduler.js
// ---------------------------------------------------------------------------

let uscRefreshQueue;

try {
  uscRefreshQueue = new Queue('usc-refresh', process.env.REDIS_URL, {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  uscRefreshQueue.on('error', (err) => {
    logger.error({ msg: 'USC refresh queue error', error: err.message });
  });

  uscRefreshQueue.on('failed', (job, err) => {
    logger.error({ msg: 'USC refresh job failed', jobId: job.id, error: err.message });
  });

  uscRefreshQueue.on('completed', (job, result) => {
    logger.info({ msg: 'USC refresh job completed', jobId: job.id, result });
  });
} catch (err) {
  logger.error({ msg: 'Failed to connect USC refresh queue to Redis — worker disabled', error: err.message });
  uscRefreshQueue = null;
}

// ---------------------------------------------------------------------------
// triggerRefresh — enqueues a refresh job
// ---------------------------------------------------------------------------

/**
 * Add a USC list refresh job to the queue.
 * In production this would download the latest CSV from fccchr.usc.edu.
 * Currently calls seedSampleData() to ensure local data stays fresh.
 *
 * @returns {Promise<void>}
 */
const triggerRefresh = async () => {
  if (!uscRefreshQueue) {
    logger.warn({ msg: 'triggerRefresh skipped — queue not available' });
    // Fall back to direct seed so startup still populates data
    try {
      const { seedSampleData } = require('../services/usc-list');
      const count = await seedSampleData();
      logger.info({ msg: 'triggerRefresh fallback seed complete', count });
    } catch (err) {
      logger.error({ msg: 'triggerRefresh fallback seed error', error: err.message });
    }
    return;
  }

  try {
    // Deduplicate: only one refresh job at a time
    await uscRefreshQueue.add(
      { triggeredAt: new Date().toISOString() },
      { jobId: 'usc-refresh-singleton', removeOnComplete: true }
    );
    logger.info({ msg: 'USC refresh job queued' });
  } catch (err) {
    logger.error({ msg: 'triggerRefresh — failed to enqueue job', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// Queue processor
// ---------------------------------------------------------------------------

if (uscRefreshQueue) {
  uscRefreshQueue.process(async (job) => {
    logger.info({ msg: 'USC refresh job started', jobId: job.id });

    const { seedSampleData } = require('../services/usc-list');

    const count = await seedSampleData();

    logger.info({ msg: 'USC refresh job finished', count });
    return { count };
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { uscRefreshQueue, triggerRefresh };
