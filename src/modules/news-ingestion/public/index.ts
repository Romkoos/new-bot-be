export { NewsIngestOrch } from "../application/NewsIngestOrch";

export type { NewsIngestResult } from "../dto/NewsIngestResult";
export type { ScrapedNewsItem } from "../dto/ScrapedNewsItem";

export type { NewsScraperPort } from "../ports/NewsScraperPort";
export type { NewsItemHasherPort, NewsItemHashInput } from "../ports/NewsItemHasherPort";
export type { NewsItemsRepositoryPort, NewNewsItemToStore, InsertManyResult } from "../ports/NewsItemsRepositoryPort";
export type { PublishedAtResolverPort } from "../ports/PublishedAtResolverPort";

export { INGEST_ENV, readIngestionConfig } from "./ingestionEnv";
export type { IngestRuntimeConfig, IngestScraperRuntimeConfig } from "./ingestionEnv";
