import { buildContainer } from "../di/container";
import { INGEST_ENV } from "../../modules/news-ingestion/public";

/**
 * CLI entry-point for manually triggering the news ingestion use-case.
 *
 * Responsibilities:
 * - Parse CLI flags.
 * - Build the DI container once.
 * - Call only the orchestrator.
 *
 * Forbidden:
 * - Scraping / hashing / filtering / persistence logic (owned by the orchestrator).
 * - Instantiating adapters/orchestrators outside DI.
 */
async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const headful = args.has("--headful") || args.has("--headed");
  const slowMoMs = readNumericArgValue("--slowmo-ms");

  // Allow CLI to control scraper visibility without requiring users to set env vars in their shell.
  if (headful) process.env[INGEST_ENV.SCRAPER_HEADLESS] = "false";
  if (slowMoMs !== undefined) process.env[INGEST_ENV.SCRAPER_SLOWMO_MS] = String(slowMoMs);

  const container = buildContainer();

  if (args.has("--help") || args.has("-h")) {
    // Keep output minimal and stable for scripting.
    process.stdout.write(
      "Usage: tsx src/app/cli/newsIngestCli.ts [--dry-run] [--headful|--headed] [--slowmo-ms=200]\n",
    );
    return;
  }

  const startedAt = Date.now();
  container.logger.info("cli:news:ingestion:start", { dryRun });

  try {
    const result = await container.ingest.news.run({ dryRun });
    const durationMs = Date.now() - startedAt;

    container.logger.info("cli:news:ingestion:done", {
      durationMs,
      source: result.source,
      dryRun: result.dryRun,
      scrapedCount: result.scrapedCount,
      newItemsCount: result.newItemsCount,
      storedCount: result.storedCount,
    });
    // This is a CLI entry-point; terminate explicitly after the run finishes.
    process.exit(0);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    container.logger.error("cli:news:ingestion:error", { durationMs, error });
    process.exit(1);
  }
}

void main();

function readNumericArgValue(prefix: `--${string}`): number | undefined {
  const match = process.argv.slice(2).find((a) => a.startsWith(`${prefix}=`));
  if (!match) return undefined;
  const raw = match.slice(prefix.length + 1).trim();
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return n;
}
