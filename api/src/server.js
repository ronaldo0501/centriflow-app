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

  console.log('[server] Cron workers scheduled (reminders: 6am, violations: 7am)');
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
