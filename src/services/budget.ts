/**
 * CoinMarketCap credit budget. When the key is on a Basic-sized plan (event access reverts
 * to Basic when submissions close, and judging runs after that), Argus switches itself into
 * lean mode: caches last ten times longer, scheduled work pauses as the day's budget runs
 * low, and once it is spent the site keeps serving the last data it fetched.
 *
 * Daily budget = credits left this month, spread over the days left in the month or until
 * BUDGET_UNTIL (for example the end of judging), whichever comes first.
 */
import * as cmc from "../cmc/endpoints.js";
import { onCall } from "../cmc/http.js";
import { BASIC_PLAN, plan, setPlan } from "../cmc/plan.js";
import { config } from "../config.js";

const DAY = 86_400_000;

/** Whole days from now until the end of the month, or until `until` if that is sooner. At least 1. */
export function daysLeft(now: number, until?: string | null): number {
  const d = new Date(now);
  let end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  const u = until ? Date.parse(until) : NaN;
  if (Number.isFinite(u) && u > now) end = Math.min(end, u);
  return Math.max(1, Math.ceil((end - now) / DAY));
}

export function dailyBudget(creditsLeftIncludingToday: number, now: number, until?: string | null): number {
  return Math.max(0, Math.floor(creditsLeftIncludingToday / daysLeft(now, until)));
}

export function isLeanPlan(limitMonthly: number | null | undefined): boolean {
  return typeof limitMonthly === "number" && limitMonthly <= 50_000;
}

const UNTIL = process.env.BUDGET_UNTIL?.trim() || null;
const OVERRIDE = process.env.CMC_LEAN; // "1" forces lean, "0" forces normal

const state = {
  limitMonthly: null as number | null,
  rateLimitMinute: null as number | null,
  usedToday: 0,
  leftMonth: null as number | null,
  day: "",
  budgetToday: null as number | null,
  checkedAt: null as string | null,
};

function apply(now = Date.now()): void {
  const lean = OVERRIDE === "1" ? true : OVERRIDE === "0" ? false : plan.simulateBasic || isLeanPlan(state.limitMonthly);
  const pressure = state.budgetToday ? state.usedToday / state.budgetToday : 0;
  setPlan({
    lean,
    frozen: lean && state.budgetToday !== null && pressure >= 1,
    ttlScale: lean ? 10 : 1,
    rateLimitMinute: state.rateLimitMinute,
  });
  void now;
}

export async function refreshBudget(now = Date.now()): Promise<void> {
  if (config.keyless) return;
  try {
    const info = await cmc.keyInfo();
    const usedToday = info.usage?.current_day?.credits_used ?? 0;
    const usedMonth = info.usage?.current_month?.credits_used ?? 0;
    let limit = info.plan?.credit_limit_monthly ?? null;
    let rate = info.plan?.rate_limit_minute ?? null;
    let left = info.usage?.current_month?.credits_left ?? (limit !== null ? limit - usedMonth : null);
    if (plan.simulateBasic) {
      limit = BASIC_PLAN.limitMonthly;
      rate = BASIC_PLAN.rateLimitMinute;
      left = Math.max(0, BASIC_PLAN.limitMonthly - usedMonth);
    }
    const day = new Date(now).toISOString().slice(0, 10);
    state.limitMonthly = limit;
    state.rateLimitMinute = rate;
    state.usedToday = usedToday;
    state.leftMonth = left;
    state.day = day;
    // Today's allowance counts what was already spent today, so it does not shrink as the day goes on.
    state.budgetToday = left !== null ? dailyBudget(left + usedToday, now, UNTIL) : null;
    state.checkedAt = new Date(now).toISOString();
  } catch (err) {
    console.warn("[budget] could not read CoinMarketCap key info:", err instanceof Error ? err.message : err);
  }
  apply(now);
}

/** Scheduled work that may be skipped to protect the day's budget. */
export function budgetAllows(kind: "scan" | "brief"): boolean {
  if (!plan.lean || !state.budgetToday) return true;
  const pressure = state.usedToday / state.budgetToday;
  return kind === "scan" ? pressure < 0.6 : pressure < 0.8;
}

export function budgetFrozen(): boolean {
  return plan.frozen;
}

export function budgetSummary() {
  return {
    lean: plan.lean,
    simulateBasic: plan.simulateBasic,
    frozen: plan.frozen,
    limitMonthly: state.limitMonthly,
    rateLimitMinute: state.rateLimitMinute,
    usedToday: state.usedToday,
    budgetToday: state.budgetToday,
    until: UNTIL,
    checkedAt: state.checkedAt,
  };
}

let timer: NodeJS.Timeout | null = null;

export function startBudget(): void {
  if (timer || config.keyless) return;
  // Count credits as they are spent between key-info checks, so pressure is current.
  onCall((r) => {
    if (r.cached || !r.creditCount) return;
    const today = new Date().toISOString().slice(0, 10);
    if (state.day && state.day !== today) { state.day = today; state.usedToday = 0; }
    state.usedToday += r.creditCount;
    apply();
  });
  void refreshBudget();
  timer = setInterval(() => void refreshBudget(), 10 * 60_000);
  timer.unref();
}
