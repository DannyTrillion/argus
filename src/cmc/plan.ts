/**
 * Plan-aware knobs read by the HTTP client and the route cache, written by services/budget.ts.
 * No imports on purpose, so nothing that reads it can form an import cycle.
 */
export interface PlanState {
  /** A Basic-sized plan (or CMC_LEAN=1): cache longer, schedule less, stay inside a daily budget. */
  lean: boolean;
  /** Today's CoinMarketCap budget is spent: serve the last data rather than fetch more. */
  frozen: boolean;
  /** Multiplier applied to every cache lifetime. */
  ttlScale: number;
  rateLimitMinute: number | null;
  /** Rehearsal switch: behave as if the key were on the free Basic plan. */
  simulateBasic: boolean;
}

export const plan: PlanState = {
  lean: false,
  frozen: false,
  ttlScale: 1,
  rateLimitMinute: null,
  simulateBasic: process.env.CMC_SIMULATE_BASIC === "1",
};

export function setPlan(p: Partial<PlanState>): void {
  Object.assign(plan, p);
}

/** Endpoint families the free Basic plan does not include (per coinmarketcap.com/api/pricing). */
export const BASIC_EXCLUDED: RegExp[] = [/^\/v\d\/derivatives\//, /^\/v\d\/content\//, /^\/v\d\/rwa/i];

export const BASIC_PLAN = { limitMonthly: 15_000, rateLimitMinute: 50 };
