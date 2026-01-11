/**
 * Public API for the content preparation module.
 *
 * Other layers (app entry-points, other modules) must import only from this file
 * and must not deep-import module internals.
 */
export { PrepareContentOrchestrator } from "../application/PrepareContentOrchestrator";

export type { PrepareContentResult } from "../dto/PrepareContentResult";
export type { NewsItemToPrepare } from "../dto/NewsItemToPrepare";

export type { ContentProcessorPort } from "../ports/ContentProcessorPort";
export type {
  ContentPreparationRepositoryPort,
  PersistPreparedContentInput,
  PersistPreparedContentResult,
} from "../ports/ContentPreparationRepositoryPort";

