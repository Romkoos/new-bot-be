import { readPm2BootStampAgeMs } from "./pm2BootStamp";

/**
 * Determines whether a cron entry point should execute its job on *this* process start.
 *
 * Why this exists:
 * - With PM2, a `pm2 start` (or VM reboot) starts multiple cron processes in parallel.
 * - We need deterministic boot-time ordering to be owned by the boot-sequence orchestrator,
 *   not by parallel "run-on-start" behavior of individual cron apps.
 * - PM2 can provide restart metadata via `process.env.pm2_env` (JSON string) including `restart_time`.
 *
 * Behavior:
 * - If not running under PM2 (no `pm2_env`), return `true` (run normally).
 * - If running under PM2 and `restart_time` is a number:
 *   - `restart_time === 0` → initial start → return `false` (skip run; stay alive for cron_restart).
 *   - `restart_time > 0`  → restart (including `cron_restart`) → return `true`.
 * - If `pm2_env` exists but cannot be parsed or has no `restart_time`, return `true`.
 *
 * Note:
 * - If PM2 does not inject `pm2_env` in a given environment, we cannot reliably distinguish initial start
 *   from restart. In that case, this function uses a short-lived boot stamp to skip the initial PM2 start.
 */
export function shouldRunCronJobOnProcessStart(env: NodeJS.ProcessEnv): boolean {
  // Preferred signal on Windows: a PM2_HOME boot stamp written by the boot-sequence process.
  // We only treat the stamp as valid for a short window to avoid skipping real scheduled runs.
  const bootStampAgeMs = readPm2BootStampAgeMs(env);
  if (bootStampAgeMs != null) {
    // If the cron process starts shortly after the boot-sequence stamp was written, treat it as "initial start".
    if (bootStampAgeMs < 30_000) return false;
  }

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

