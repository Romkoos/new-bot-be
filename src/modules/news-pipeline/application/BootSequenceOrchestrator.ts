import type { NewsIngestOrch, NewsIngestResult } from "../../news-ingestion/public";
import type { PublishDigestOrchestrator, PublishDigestResult } from "../../publishing/public";

export interface BootSequenceDeps {
  /**
   * News ingestion use-case entry point.
   */
  readonly ingest: NewsIngestOrch;

  /**
   * Digest publishing use-case entry point.
   */
  readonly publishDigest: PublishDigestOrchestrator;
}

export type BootSequenceStepResult<T> =
  | {
      readonly ok: true;
      readonly durationMs: number;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly durationMs: number;
      readonly errorMessage: string;
    };

export interface BootSequenceResult {
  /**
   * Total runtime of the whole boot sequence.
   */
  readonly durationMs: number;

  /**
   * Ingest → publishing (strict ordering).
   */
  readonly ingest: BootSequenceStepResult<NewsIngestResult>;
  readonly publishing: BootSequenceStepResult<PublishDigestResult>;
}

/**
 * Boot-time pipeline orchestrator.
 *
 * Owns the cross-module flow:
 *
 * ingest → publishing
 *
 * Design notes:
 * - This orchestrator is the single owner of ordering.
 * - It depends on other modules only through their Public APIs.
 * - It records step-level success/failure and continues through the sequence even if a step fails,
 *   so the caller can decide how to log/alert.
 */
export class BootSequenceOrchestrator {
  public constructor(private readonly deps: BootSequenceDeps) {}

  public async run(): Promise<BootSequenceResult> {
    const startedAt = Date.now();

    const ingest = await runAsyncStep(() => this.deps.ingest.run({ dryRun: false }));
    const publishing = await runAsyncStep(() => this.deps.publishDigest.run());

    const durationMs = Date.now() - startedAt;

    return {
      durationMs,
      ingest,
      publishing,
    };
  }
}

async function runAsyncStep<T>(fn: () => Promise<T>): Promise<BootSequenceStepResult<T>> {
  const startedAt = Date.now();
  try {
    const value = await fn();
    const durationMs = Date.now() - startedAt;
    return { ok: true, durationMs, value };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    return { ok: false, durationMs, errorMessage: toErrorMessage(error) };
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

