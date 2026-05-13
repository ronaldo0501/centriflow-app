require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Start HTTP server
// ---------------------------------------------------------------------------

const server = app.listen(PORT, () => {
  console.log(`CentriFlow API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  startWorkers();
});

// ---------------------------------------------------------------------------
// Background workers + cron scheduling
// ---------------------------------------------------------------------------

const startWorkers = () => {
  let cron;
  let scheduleReminders;
  let checkForViolations;
  let triggerRefresh;

  try {
    cron = require('node-cron');
  } catch (err) {
    console.error('[server] node-cron not available — cron jobs disabled:', err.message);
    return;
  }

  try {
    ({ scheduleReminders } = require('./workers/reminder-scheduler'));
  } catch (err) {
    console.error('[server] Failed to load reminder-scheduler:', err.message);
  }

  try {
    ({ checkForViolations } = require('./workers/violations-worker'));
  } catch (err) {
    console.error('[server] Failed to load violations-worker:', err.message);
  }

  try {
    ({ triggerRefresh } = require('./workers/usc-refresh-worker'));
  } catch (err) {
    console.error('[server] Failed to load usc-refresh-worker:', err.message);
  }

  // ── Daily reminder scan — 6:00 AM ────────────────────────────────────────
  if (scheduleReminders) {
    cron.schedule('0 6 * * *', async () => {
      console.log('[cron] Running scheduleReminders');
      try {
        await scheduleReminders();
      } catch (err) {
        console.error('[cron] scheduleReminders error:', err.message);
      }
    });

    // Run once at startup so reminders fire immediately on first deploy
    scheduleReminders().catch((err) => {
      console.error('[startup] scheduleReminders error:', err.message);
    });
  }

  // ── Daily violations check — 7:00 AM ─────────────────────────────────────
  if (checkForViolations) {
    cron.schedule('0 7 * * *', async () => {
      console.log('[cron] Running checkForViolations');
      try {
        await checkForViolations();
      } catch (err) {
        console.error('[cron] checkForViolations error:', err.message);
      }
    });

    // Run once at startup
    checkForViolations().catch((err) => {
      console.error('[startup] checkForViolations error:', err.message);
    });
  }

  // ── Monthly USC list refresh — 1st of every month at midnight ────────────
  if (triggerRefresh) {
    cron.schedule('0 0 1 * *', async () => {
      console.log('[cron] Running USC list refresh');
      try {
        await triggerRefresh();
      } catch (err) {
        console.error('[cron] triggerRefresh error:', err.message);
      }
    });

    // Run once at startup to ensure dev/demo has sample data
    triggerRefresh().catch((err) => {
      console.error('[startup] triggerRefresh error:', err.message);
    });
  }

  console.log('[server] Cron workers scheduled (reminders: 6am, violations: 7am, usc-refresh: 1st of month)');
};

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

const shutdown = () => {
  console.log('[server] Shutting down gracefully...');
  server.close(() => {
    console.log('[server] HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
