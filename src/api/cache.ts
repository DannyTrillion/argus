/**
 * Tiny memoization layer for API routes. Keeps one value per key for `ttlMs`,
 * dedupes concurrent requests for the same key, and serves stale data while a
 * refresh is in flight so the UI never blocks on CoinMarketCap latency.
 */
interface Entry<T> {
  value: T;
  expires: number;
  updatedAt: number;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return hit ? hit.value : pending;

  const p = fn()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs, updatedAt: Date.now() });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  // Stale-while-revalidate: return the old value immediately if we have one.
  if (hit) {
    p.catch(() => undefined);
    return hit.value;
  }
  return p;
}

export function cachedAt(key: string): number | null {
  return store.get(key)?.updatedAt ?? null;
}

export const MINUTE = 60_000;
