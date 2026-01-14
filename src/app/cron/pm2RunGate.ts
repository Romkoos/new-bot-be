/**
 * Determines whether a cron entry point should execute its job on *this* process start.
 *
 * Why this exists:
 * - With PM2, `pm2 start` / VM reboot may start multiple cron processes at once.
 * - We need boot-time sequencing to be owned by `bootSequence.ts`, not by parallel starts.
 * - PM2 provides restart metadata via `process.env.pm2_env` (JSON string) including `restart_time`.
 *
 * Behavior:
 * - If not running under PM2 (no `pm2_env`), return `true` (run normally).
 * - If running under PM2 and `restart_time` is a number:
 *   - `restart_time === 0` → initial start → return `false` (skip run; stay alive for cron_restart).
 *   - `restart_time > 0`  → restart (including `cron_restart`) → return `true`.
 * - If `pm2_env` exists but cannot be parsed or has no `restart_time`, return `true`.
 */
export function shouldRunCronJobOnProcessStart(env: NodeJS.ProcessEnv): boolean {
  const pm2EnvRaw = env.pm2_env;
  if (!pm2EnvRaw) return true;

  try {
    const parsed = JSON.parse(pm2EnvRaw) as { restart_time?: unknown };
    const restartTime = parsed.restart_time;
    if (typeof restartTime === "number") return restartTime > 0;
    return true;
  } catch {
    return true;
  }
}

