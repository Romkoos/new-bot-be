import { DateTime } from "luxon";
import type { PublishedAtResolverPort } from "../ports/PublishedAtResolverPort";

const DEFAULT_TZ = "Asia/Jerusalem";

export interface PublishedAtResolverOpts {
  /**
   * IANA timezone identifier used as the source of truth for interpreting scraped `HH:mm`.
   *
   * Default: `Asia/Jerusalem`.
   */
  readonly timezoneId?: string;

  /**
   * Optional "now" provider for deterministic testing.
   *
   * If unset, the system clock is used.
   */
  readonly now?: () => DateTime;
}

/**
 * Timezone-aware `publishedAt` resolver for sources that provide only an `HH:mm` string.
 *
 * Midnight rollover rule (timezone-driven):
 * - If the scraped time is in `23:00–23:59` and the current time in the configured timezone is in `00:00–00:59`,
 *   the publication date is considered "yesterday" (in that timezone).
 */
export class PublishedAtResolver implements PublishedAtResolverPort {
  private readonly timezoneId: string;
  private readonly now: () => DateTime;

  public constructor(opts: PublishedAtResolverOpts = {}) {
    this.timezoneId = opts.timezoneId ?? DEFAULT_TZ;
    this.now = opts.now ?? (() => DateTime.now());
  }

  public resolveIsoOrNull(timeText: string): string | null {
    const trimmed = timeText.trim();
    if (!trimmed) return null;

    // Be tolerant: extract the first HH:mm occurrence (site might add whitespace/markers).
    const match = /(\d{1,2}):(\d{2})/.exec(trimmed);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23) return null;
    if (minutes < 0 || minutes > 59) return null;

    const nowZoned = this.now().setZone(this.timezoneId);
    if (!nowZoned.isValid) return null;

    // Build "today HH:mm" in the configured timezone.
    let publishedZoned = nowZoned
      .startOf("day")
      .set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

    if (!publishedZoned.isValid) return null;

    // Midnight rollover rule: scraped 23:xx but now is 00:xx → interpret as yesterday.
    if (hours === 23 && nowZoned.hour === 0) {
      publishedZoned = publishedZoned.minus({ days: 1 });
    }

    // Persist in canonical ISO UTC form, matching previous `Date#toISOString()` behavior.
    return publishedZoned.toUTC().toISO() ?? null;
  }
}

