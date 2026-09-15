/**
 * Caps on analyst questions answered with this site's shared Anthropic key, so a public
 * link cannot run up the bill. Visitors who bring their own key are never limited.
 * Counts live in memory and reset on restart; the daily cap resets at midnight UTC.
 */
export const LIMITS = {
  perHour: Number(process.env.ANALYST_SHARED_PER_HOUR ?? 6),
  perDay: Number(process.env.ANALYST_SHARED_PER_DAY ?? 40),
};

const hits = new Map<string, number[]>();
let day = "";
let dayCount = 0;

export type Gate = { ok: true; remainingToday: number } | { ok: false; reason: "hour" | "day"; message: string };

export function takeSharedQuestion(visitor: string, now = Date.now(), limits = LIMITS): Gate {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) { day = today; dayCount = 0; }
  if (dayCount >= limits.perDay) {
    return { ok: false, reason: "day", message: "The shared analyst has answered all its questions for today. Add your own Anthropic key on the Keys page to keep asking." };
  }
  const recent = (hits.get(visitor) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= limits.perHour) {
    return { ok: false, reason: "hour", message: `You have asked ${limits.perHour} questions on the shared key this hour. Try again later, or add your own Anthropic key on the Keys page.` };
  }
  recent.push(now);
  hits.set(visitor, recent);
  dayCount += 1;
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 3_600_000)) hits.delete(k);
  return { ok: true, remainingToday: limits.perDay - dayCount };
}

export function sharedQuestionsToday(now = Date.now()): number {
  return new Date(now).toISOString().slice(0, 10) === day ? dayCount : 0;
}

/** Test helper. */
export function resetLimits(): void {
  hits.clear();
  day = "";
  dayCount = 0;
}
