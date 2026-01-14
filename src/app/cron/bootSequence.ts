import { buildContainer } from "../di/container";
import { loadEnvFiles } from "../config/loadEnv";
import { writePm2BootStamp } from "./pm2BootStamp";

/**
 * Boot-time cron sequence entry point.
 *
 * Scheduling responsibility is owned by PM2. This script is intended to be started by PM2
 * on system/PM2 start (including VM reboot), and it exits after completing the sequence.
 *
 * Forbidden:
 * - Business logic (owned by orchestrators).
 * - In-process time scheduling.
 */
async function main(): Promise<void> {
  loadEnvFiles();
  writePm2BootStamp(process.env);
  const container = buildContainer();

  try {
    const result = await container.newsPipeline.bootSequence.run();
    container.logger.info("cron:boot-sequence:done", result);
    process.exit(0);
  } catch (error) {
    container.logger.error("cron:boot-sequence:error", { error });
    process.exit(1);
  }
}

void main();

