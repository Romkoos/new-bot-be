/**
 * Publishing runtime configuration (env vars).
 *
 * Purpose:
 * - Centralize env var keys + defaults for publishing execution.
 * - Keep `src/app/*` free from hardcoded env var names (thin entry-points + DI).
 */
export const PUBLISH_ENV = {
  CRON_SCHEDULE: "PUBLISHING_CRON_SCHEDULE",
} as const;

export interface PublishingRuntimeConfig {
  readonly cronSchedule: string;
}

/**
 * Reads publishing runtime config from the given environment.
 */
export function readPublishingConfig(env: NodeJS.ProcessEnv): PublishingRuntimeConfig {
  return {
    // Twice per hour (minute 0 and 30).
    cronSchedule: env[PUBLISH_ENV.CRON_SCHEDULE] ?? "0,30 * * * *",
  };
}

