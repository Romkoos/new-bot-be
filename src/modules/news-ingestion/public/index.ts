export { MakoIngestOrch } from "../application/MakoIngestOrch";

export type { MakoIngestResult } from "../dto/MakoIngestResult";
export type { MakoScrapedItem } from "../dto/MakoScrapedItem";

export type { MakoScraperPort } from "../ports/MakoScraperPort";
export type { NewsItemHasherPort, NewsItemHashInput } from "../ports/NewsItemHasherPort";
export type { NewsItemsRepositoryPort, NewNewsItemToStore, InsertManyResult } from "../ports/NewsItemsRepositoryPort";

export { MAKO_ENV, readMakoConfig } from "./makoEnv";
export type { MakoRuntimeConfig, MakoScraperRuntimeConfig } from "./makoEnv";
