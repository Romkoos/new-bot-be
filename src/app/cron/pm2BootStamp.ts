import fs from "node:fs";
import path from "node:path";

const BOOT_STAMP_FILENAME = "news-bot-be.pm2-boot.stamp";

/**
 * Writes a "PM2 boot stamp" file to the PM2 home directory (when available).
 *
 * This is used to prevent cron entry points from executing their jobs immediately
 * on the initial PM2 start (when multiple cron processes start in parallel).
 */
export function writePm2BootStamp(env: NodeJS.ProcessEnv): void {
  const pm2Home = env.PM2_HOME;
  if (!pm2Home) return;

  const filePath = path.join(pm2Home, BOOT_STAMP_FILENAME);
  fs.writeFileSync(filePath, new Date().toISOString(), { encoding: "utf8" });
}

/**
 * Returns the boot stamp age in milliseconds, or null if not available.
 */
export function readPm2BootStampAgeMs(env: NodeJS.ProcessEnv): number | null {
  const pm2Home = env.PM2_HOME;
  if (!pm2Home) return null;

  const filePath = path.join(pm2Home, BOOT_STAMP_FILENAME);
  try {
    const stat = fs.statSync(filePath);
    return Date.now() - stat.mtimeMs;
  } catch {
    return null;
  }
}

