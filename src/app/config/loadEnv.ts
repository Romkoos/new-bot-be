import { config as dotenvConfig } from "dotenv";
import { existsSync } from "node:fs";

/**
 * Loads environment variables from `.env` and `.env.local` if present.
 *
 * Load order (later overrides earlier):
 * - `.env`
 * - `.env.local`
 *
 * Notes:
 * - This repo intentionally keeps env loading in the app layer (entry points/config),
 *   not inside business modules.
 * - `.env` files are gitignored (see `.gitignore`), so secrets must not be committed.
 */
export function loadEnvFiles(): void {
  loadIfExists(".env");
  loadIfExists(".env.local");
}

function loadIfExists(path: string): void {
  if (!existsSync(path)) return;
  dotenvConfig({ path, override: true, quiet: true });
}

