/**
 * Mako ingestion runtime configuration (env vars).
 *
 * Purpose:
 * - Centralize env var keys + defaults for the Mako ingestion flow.
 * - Keep `src/app/*` free from hardcoded env var names (thin entry-points + DI).
 *
 * Compatibility:
 * - Preferred keys: `MAKO_*`
 */

export const MAKO_ENV = {
  CRON_SCHEDULE: "MAKO_CRON_SCHEDULE",
  SCRAPER_HEADLESS: "MAKO_SCRAPER_HEADLESS",
  SCRAPER_SLOWMO_MS: "MAKO_SCRAPER_SLOWMO_MS",
  USER_DATA_DIR: "MAKO_USER_DATA_DIR",
  CHROMIUM_CHANNEL: "MAKO_CHROMIUM_CHANNEL",
  USER_AGENT: "MAKO_USER_AGENT",
  LOCALE: "MAKO_LOCALE",
  TIMEZONE: "MAKO_TIMEZONE",
} as const;

export interface MakoScraperRuntimeConfig {
  readonly headless: boolean;
  readonly slowMoMs?: number;
  readonly userDataDir?: string;
  readonly chromiumChannel?: "chrome" | "msedge";
  readonly userAgent?: string;
  readonly locale?: string;
  readonly timezoneId?: string;
}

export interface MakoRuntimeConfig {
  readonly cronSchedule: string;
  readonly scraper: MakoScraperRuntimeConfig;
}

/**
 * Reads Mako ingestion config from the given environment.
 */
export function readMakoConfig(env: NodeJS.ProcessEnv): MakoRuntimeConfig {
  const cronSchedule = env[MAKO_ENV.CRON_SCHEDULE] ?? "*/5 * * * *";

  const headless = parseBooleanEnv(env[MAKO_ENV.SCRAPER_HEADLESS], true);

  const slowMoMs = parseNumberEnv(env[MAKO_ENV.SCRAPER_SLOWMO_MS]);
  const userDataDir = env[MAKO_ENV.USER_DATA_DIR];

  const chromiumChannelRaw = env[MAKO_ENV.CHROMIUM_CHANNEL];
  const chromiumChannel: "chrome" | "msedge" | undefined =
    chromiumChannelRaw === "chrome" || chromiumChannelRaw === "msedge" ? chromiumChannelRaw : undefined;

  const userAgent = env[MAKO_ENV.USER_AGENT];
  const locale = env[MAKO_ENV.LOCALE];
  const timezoneId = env[MAKO_ENV.TIMEZONE];

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

