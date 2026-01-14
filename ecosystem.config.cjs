/**
 * PM2 ecosystem config for this repo.
 *
 * Cron scheduling is owned by PM2 via `cron_restart`.
 * The application runtime must not schedule cron jobs in-process.
 *
 * Notes:
 * - `cron_restart` requires the application to be running to receive restarts.
 * - `autorestart: false` preserves the previous behavior: if a cron process crashes, it stays down.
 * - These scripts assume the project has been built (`npm run build`) and `dist/` exists.
 */
module.exports = {
  apps: [
    {
      name: "cron:boot-sequence",
      script: "dist/app/cron/bootSequence.js",
      autorestart: false,
      watch: false,
      exec_mode: "fork",
      instances: 1,
      time: true,
    },
    {
      name: "cron:health",
      script: "dist/app/cron/healthCron.js",
      cron_restart: "* * * * *",
      autorestart: false,
      watch: false,
      exec_mode: "fork",
      instances: 1,
      time: true,
    },
    {
      name: "cron:news:ingest",
      script: "dist/app/cron/newsIngestCron.js",
      cron_restart: "*/5 * * * *",
      autorestart: false,
      watch: false,
      exec_mode: "fork",
      instances: 1,
      time: true,
      env: {
        // Keep the log `{ schedule }` aligned with PM2 `cron_restart`.
        INGEST_CRON_SCHEDULE: "*/5 * * * *",
      },
    },
    {
      name: "cron:publishing:digest",
      script: "dist/app/cron/publishingCron.js",
      cron_restart: "0,30 * * * *",
      autorestart: false,
      watch: false,
      exec_mode: "fork",
      instances: 1,
      time: true,
      env: {
        // Keep the log `{ schedule }` aligned with PM2 `cron_restart`.
        PUBLISHING_CRON_SCHEDULE: "0,30 * * * *",
      },
    },
  ],
};

