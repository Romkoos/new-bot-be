import { loadEnvFiles } from "../config/loadEnv";
import { buildContainer } from "../di/container";

/**
 * CLI entry-point for manually triggering the publishing use-case.
 *
 * Responsibilities:
 * - Load `.env` / `.env.local` (if present).
 * - Parse CLI flags.
 * - Build the DI container once.
 * - Call only the orchestrator.
 */
async function main(): Promise<void> {
  loadEnvFiles();

  const args = new Set(process.argv.slice(2));
  if (args.has("--help") || args.has("-h")) {
    // Keep output minimal and stable for scripting.
    process.stdout.write("Usage: tsx src/app/cli/publishDigestCli.ts\n");
    return;
  }

  const container = buildContainer();

  const startedAt = Date.now();
  container.logger.info("cli:publishing:digest:start", {});

  try {
    const result = await container.publishing.publishDigest.run();
    const durationMs = Date.now() - startedAt;

    container.logger.info("cli:publishing:digest:done", {
      ...result,
      durationMs,
    });

    process.exit(0);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    container.logger.error("cli:publishing:digest:error", { durationMs, error });
    process.exit(1);
  }
}

void main();

