/**
 * Result type used by the `news-filtering` module to keep error handling explicit.
 *
 * This is intentionally string-based (no error classes) so it can be easily mapped
 * to HTTP status codes at the API entry point layer.
 */
export type FiltersResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

