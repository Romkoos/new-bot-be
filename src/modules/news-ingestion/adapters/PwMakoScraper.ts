import { chromium } from "playwright";
import type { Browser, BrowserContext, Frame, Page } from "playwright";
import type { ScrapedNewsItem } from "../dto/ScrapedNewsItem";
import type { NewsScraperPort } from "../ports/NewsScraperPort";
import type { PublishedAtResolverPort } from "../ports/PublishedAtResolverPort";

const URL = "https://www.mako.co.il/news-channel12";
const SEL_DRAWER_BTN = ".mc-drawer__btn";
const SEL_NEWS_CONT = ".desktop-drawer-news";
const SEL_NEWS_ITEM = `${SEL_NEWS_CONT} .mc-extendable-text__content > div > div`;
const SEL_TIME = ".mc-message-footer__time";

const T_GOTO_MS = 15_000;
const T_WAIT_CONT_MS = 15_000;
const T_CLICK_MS = 10_000;
const T_SCAN_MS = 250;

const LOCALE = "he-IL";
const TZ = "Asia/Jerusalem";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface PwMakoScraperOpts {
  /**
   * Resolver for converting the scraped `HH:mm` time string into an ISO timestamp.
   *
   * Required so the scraper can remain focused on DOM extraction while delegating timezone/rollover logic.
   */
  readonly publishedAtResolver: PublishedAtResolverPort;

  /**
   * When `true` (default), runs headless.
   * When `false`, shows the browser UI (useful for debugging).
   */
  readonly headless?: boolean;

  /**
   * Optional Playwright slow motion delay (ms) between actions.
   * Useful to visually observe the run when `headless` is disabled.
   */
  readonly slowMoMs?: number | undefined;

  /**
   * Optional user data dir for a persistent browser context.
   *
   * Use this to persist cookies/localStorage between runs (helpful for bot mitigations).
   */
  readonly userDataDir?: string;

  /**
   * Optional Chromium channel, e.g. `"chrome"` to use installed Google Chrome.
   * When unset, Playwright's bundled Chromium is used.
   */
  readonly chromiumChannel?: "chrome" | "msedge";

  /**
   * Optional user agent override to reduce headless detection / improve reliability.
   */
  readonly userAgent?: string;

  /**
   * Optional locale override.
   */
  readonly locale?: string;

  /**
   * Optional timezone override.
   */
  readonly timezoneId?: string;
}

/**
 * Playwright-based scraper for `https://www.mako.co.il/news-channel12`.
 *
 * Constraints:
 * - Infrastructure-only (browser automation).
 * - Returns normalized data only (no hashing).
 * - Does not access persistence.
 */
export class PwMakoScraper implements NewsScraperPort {
  public readonly source = "mako-channel12";

  private readonly publishedAtResolver: PublishedAtResolverPort;

  private readonly options: {
    readonly headless: boolean;
    readonly slowMoMs?: number;
    readonly userDataDir?: string;
    readonly chromiumChannel?: "chrome" | "msedge";
    readonly userAgent: string;
    readonly locale: string;
    readonly timezoneId: string;
  };

  public constructor(options: PwMakoScraperOpts) {
    this.publishedAtResolver = options.publishedAtResolver;
    this.options = {
      headless: options.headless ?? true,
      ...(options.slowMoMs !== undefined ? { slowMoMs: options.slowMoMs } : {}),
      ...(options.userDataDir !== undefined ? { userDataDir: options.userDataDir } : {}),
      ...(options.chromiumChannel !== undefined ? { chromiumChannel: options.chromiumChannel } : {}),
      userAgent: options.userAgent ?? UA,
      locale: options.locale ?? LOCALE,
      timezoneId: options.timezoneId ?? TZ,
    };
  }

  public async scrapeFirstFive(): Promise<ReadonlyArray<ScrapedNewsItem>> {
    const { ctx, close } = await createCtx(this.options);
    const page = await ctx.newPage();

    try {
      await page.goto(URL, { waitUntil: "domcontentloaded", timeout: T_GOTO_MS });
      await clickDrawer(page.frames());
      await page.waitForSelector(SEL_NEWS_CONT, { timeout: T_WAIT_CONT_MS });
      return await extractTop5(page, this.publishedAtResolver);
    } finally {
      await page.close().catch(() => undefined);
      await close().catch(() => undefined);
    }
  }
}

async function findDrawerButtonStrict(
  frames: ReadonlyArray<Frame>,
  timeoutMs: number,
): Promise<{ readonly locator: ReturnType<Frame["locator"]>; readonly frameUrl: string }> {
  const deadline = Date.now() + timeoutMs;
  let lastFrameUrls: string[] = [];

  while (Date.now() < deadline) {
    lastFrameUrls = frames.map((f) => f.url());

    for (const frame of frames) {
      const locator = frame.locator(SEL_DRAWER_BTN).first();
      const count = await frame.locator(SEL_DRAWER_BTN).count().catch(() => 0);
      if (count > 0) return { locator, frameUrl: frame.url() };
    }

    await new Promise((r) => setTimeout(r, T_SCAN_MS));
  }

  throw new Error(
    `Drawer button not found (${SEL_DRAWER_BTN}) within ${timeoutMs}ms. Frames: ${lastFrameUrls.join(", ")}`,
  );
}

async function clickDrawer(frames: ReadonlyArray<Frame>): Promise<void> {
  const { locator } = await findDrawerButtonStrict(frames, T_CLICK_MS);
  await locator.click({ timeout: T_CLICK_MS });
}

async function extractTop5(page: Page, publishedAtResolver: PublishedAtResolverPort): Promise<ScrapedNewsItem[]> {
  const loc = page.locator(SEL_NEWS_ITEM);
  const extracted = (await loc.evaluateAll(
    (nodes: Element[], timeSel: string) => {
      return nodes.slice(0, 5).map((el) => {
        const timeEl = el.querySelector(timeSel);
        const timeText = (timeEl?.textContent ?? "").trim();

        const clone = el.cloneNode(true);
        if (clone instanceof Element) {
          clone.querySelectorAll(timeSel).forEach((n) => n.remove());
        }
        const text = (clone instanceof Element ? clone.textContent : el.textContent ?? "").trim();
        return { text, timeText };
      });
    },
    SEL_TIME,
  )) as Array<{ text: string; timeText: string }>;

  return extracted
    .map((x) => ({ text: x.text, publishedAt: publishedAtResolver.resolveIsoOrNull(x.timeText) }))
    .filter((x) => x.text.length > 0);
}

async function createCtx(opts: {
  readonly headless: boolean;
  readonly slowMoMs?: number;
  readonly userDataDir?: string;
  readonly chromiumChannel?: "chrome" | "msedge";
  readonly userAgent: string;
  readonly locale: string;
  readonly timezoneId: string;
}): Promise<{ readonly ctx: BrowserContext; readonly close: () => Promise<void> }> {
  if (opts.userDataDir) {
    const ctx = await chromium.launchPersistentContext(opts.userDataDir, {
      headless: opts.headless,
      ...(opts.slowMoMs !== undefined ? { slowMo: opts.slowMoMs } : {}),
      ...(opts.chromiumChannel !== undefined ? { channel: opts.chromiumChannel } : {}),
      userAgent: opts.userAgent,
      locale: opts.locale,
      timezoneId: opts.timezoneId,
      viewport: { width: 1280, height: 720 },
    });
    return { ctx, close: () => ctx.close() };
  }

  const browser: Browser = await chromium.launch({
    headless: opts.headless,
    ...(opts.slowMoMs !== undefined ? { slowMo: opts.slowMoMs } : {}),
    ...(opts.chromiumChannel !== undefined ? { channel: opts.chromiumChannel } : {}),
  });

  const ctx = await browser.newContext({
    userAgent: opts.userAgent,
    locale: opts.locale,
    timezoneId: opts.timezoneId,
    viewport: { width: 1280, height: 720 },
  });

  return {
    ctx,
    close: async () => {
      await ctx.close();
      await browser.close();
    },
  };
}

