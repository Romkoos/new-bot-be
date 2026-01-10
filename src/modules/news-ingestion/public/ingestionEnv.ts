/**
 * News ingestion runtime configuration (env vars).
 *
 * Purpose:
 * - Centralize env var keys + defaults for ingestion execution.
 * - Keep `src/app/*` free from hardcoded env var names (thin entry-points + DI).
 */

export const INGEST_ENV = {
  CRON_SCHEDULE: "INGEST_CRON_SCHEDULE",
  SCRAPER_HEADLESS: "INGEST_SCRAPER_HEADLESS",
  SCRAPER_SLOWMO_MS: "INGEST_SCRAPER_SLOWMO_MS",
  USER_DATA_DIR: "INGEST_USER_DATA_DIR",
  CHROMIUM_CHANNEL: "INGEST_CHROMIUM_CHANNEL",
  USER_AGENT: "INGEST_USER_AGENT",
  LOCALE: "INGEST_LOCALE",
  TIMEZONE: "INGEST_TIMEZONE",
} as const;

export interface IngestScraperRuntimeConfig {
  readonly headless: boolean;
  readonly slowMoMs?: number;
  readonly userDataDir?: string;
  readonly chromiumChannel?: "chrome" | "msedge";
  readonly userAgent?: string;
  readonly locale?: string;
  readonly timezoneId?: string;
}

export interface IngestRuntimeConfig {
  readonly cronSchedule: string;
  readonly scraper: IngestScraperRuntimeConfig;
}

/**
 * Reads ingestion runtime config from the given environment.
 */
export function readIngestionConfig(env: NodeJS.ProcessEnv): IngestRuntimeConfig {
  const cronSchedule = env[INGEST_ENV.CRON_SCHEDULE] ?? "*/5 * * * *";

  const headless = parseBooleanEnv(env[INGEST_ENV.SCRAPER_HEADLESS], true);

  const slowMoMs = parseNumberEnv(env[INGEST_ENV.SCRAPER_SLOWMO_MS]);
  const userDataDir = env[INGEST_ENV.USER_DATA_DIR];

  const chromiumChannelRaw = env[INGEST_ENV.CHROMIUM_CHANNEL];
  const chromiumChannel: "chrome" | "msedge" | undefined =
    chromiumChannelRaw === "chrome" || chromiumChannelRaw === "msedge" ? chromiumChannelRaw : undefined;

  const userAgent = env[INGEST_ENV.USER_AGENT];
  const locale = env[INGEST_ENV.LOCALE];
  const timezoneId = env[INGEST_ENV.TIMEZONE];

  return {
    cronSchedule,
    scraper: {
      headless,
      ...(slowMoMs !== undefined ? { slowMoMs } : {}),
      ...(userDataDir ? { userDataDir } : {}),
      ...(chromiumChannel ? { chromiumChannel } : {}),
      ...(userAgent ? { userAgent } : {}),
      ...(locale ? { locale } : {}),
      ...(timezoneId ? { timezoneId } : {}),
    },
  };
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return defaultValue;
}

function parseNumberEnv(value: string | undefined): number | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

