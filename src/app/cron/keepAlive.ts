/**
 * Keeps the current Node.js process alive without scheduling any business work.
 *
 * Important:
 * - A pending Promise alone does NOT keep Node.js alive.
 * - We deliberately use a no-op timer handle as an "idle keep-alive" so PM2 `cron_restart`
 *   can restart the process on schedule.
 *
 * This is infrastructure only and must not be used for time-based job scheduling.
 */
export async function keepProcessAlive(): Promise<never> {
  return await new Promise(() => {
    // Intentionally do nothing on each tick. The timer handle exists only to keep the event loop alive.
    setInterval(() => {
      // Intentionally empty.
    }, 60_000);
  });
}

