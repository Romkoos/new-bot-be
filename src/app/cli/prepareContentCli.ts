import { buildContainer } from "../di/container";

/**
 * CLI entry-point for manually triggering the content preparation use-case.
 *
 * Responsibilities:
 * - Parse CLI flags.
 * - Build the DI container once.
 * - Call only the orchestrator.
 *
 * Forbidden:
 * - Querying storage directly (owned by the orchestrator/repository).
 * - Processing logic (owned by the processor adapter).
 * - Instantiating adapters/orchestrators outside DI.
 */
async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const container = buildContainer();

  if (args.has("--help") || args.has("-h")) {
    // Keep output minimal and stable for scripting.
    process.stdout.write("Usage: tsx src/app/cli/prepareContentCli.ts\n");
    return;
  }

  const startedAt = Date.now();
  container.logger.info("cli:content:prepare:start", {});

  try {
    const result = await container.contentPreparation.prepare.run();
    const durationMs = Date.now() - startedAt;

    container.logger.info("cli:content:prepare:done", {
      ...result,
      durationMs,
    });

    // This is a CLI entry-point; terminate explicitly after the run finishes.
    process.exit(0);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    container.logger.error("cli:content:prepare:error", { durationMs, error });
    process.exit(1);
  }
}

void main();

