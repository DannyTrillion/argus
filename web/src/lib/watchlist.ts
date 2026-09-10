/** Watchlist stored in localStorage as an array of CMC ids. */
import { useCallback, useEffect, useState } from "react";

const KEY = "argus.watchlist";
const DEFAULTS = [1, 1027, 5426];

function read(): number[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)) : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

const listeners = new Set<() => void>();
function write(ids: number[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function useWatchlist() {
  const [ids, setIds] = useState<number[]>(read);
  useEffect(() => {
    const l = () => setIds(read());
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const has = useCallback((id: number) => ids.includes(id), [ids]);
  const toggle = useCallback((id: number) => {
    const cur = read();
    write(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }, []);
  return { ids, has, toggle };
}
