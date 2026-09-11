/**
 * System status for the /status screen and judges: plan tier, credit usage,
 * which endpoint families the current plan allows, brief state, model.
 */
import * as cmc from "../cmc/endpoints.js";
import { CmcApiError } from "../cmc/http.js";
import { memo, MINUTE } from "../api/cache.js";
import { config } from "../config.js";
import { currentBrief } from "./brief.js";
import { getSettings } from "./settings.js";

export interface Capability {
  name: string;
  endpoint: string;
  ok: boolean;
  note?: string;
}

async function probe(name: string, endpoint: string, fn: () => Promise<unknown>): Promise<Capability> {
  try {
    await fn();
    return { name, endpoint, ok: true };
  } catch (err) {
    if (err instanceof CmcApiError) return { name, endpoint, ok: false, note: err.errorCode === 1006 ? "not on current plan" : err.message };
    return { name, endpoint, ok: false, note: err instanceof Error ? err.message : String(err) };
  }
}

export function status() {
  return memo("status", 10 * MINUTE, async () => {
    const key = config.keyless ? null : await cmc.keyInfo().catch(() => null);
    const caps = await Promise.all([
      probe("Quotes and listings", "/v3/cryptocurrency/quotes/latest", () => cmc.quotes({ ids: [1] })),
      probe("Global metrics", "/v1/global-metrics/quotes/latest", () => cmc.globalMetrics()),
      probe("Fear & Greed", "/v3/fear-and-greed/latest", () => cmc.fearGreedLatest()),
      probe("Altcoin Season", "/v1/altcoin-season-index/latest", () => cmc.altcoinSeason()),
      probe("Categories", "/v1/cryptocurrency/categories", () => cmc.categories({ limit: 1 })),
      probe("Historical quotes", "/v3/cryptocurrency/quotes/historical", () => cmc.quotesHistorical({ id: 1, count: 2 })),
      probe("OHLCV candles", "/v2/cryptocurrency/ohlcv/historical", () =>
        cmc.ohlcv({ id: 1, count: 2 }).then((s) => {
          if (s.source !== "ohlcv") throw new CmcApiError(403, 1006, "plan", "/v2/cryptocurrency/ohlcv/historical");
        }),
      ),
      probe("Trending", "/v1/cryptocurrency/trending/latest", () => cmc.trending({ limit: 1 })),
      probe("Price performance", "/v2/cryptocurrency/price-performance-stats/latest", () => cmc.pricePerformance({ ids: [1], periods: ["24h"] })),
      probe("Liquidations", "/v5/derivatives/liquidations/quotes/latest", () => cmc.liquidations()),
      probe("News", "/v1/content/latest", () => cmc.news({ limit: 1 })),
    ]);
    const brief = currentBrief();
    return {
      model: config.model,
      automationModel: config.automationModel,
      automationPaused: getSettings().automationPaused,
      keyless: config.keyless,
      plan: key?.plan ?? null,
      usage: key?.usage ?? null,
      capabilities: caps,
      brief: brief ? { generatedAt: brief.generatedAt, calls: brief.calls, credits: brief.credits, durationMs: brief.durationMs } : null,
      checkedAt: new Date().toISOString(),
    };
  });
}
