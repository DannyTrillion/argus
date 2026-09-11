/**
 * Holdings: how much of each coin the person owns, kept in this browser only.
 *
 * Stored as { [cmcId]: amount } in localStorage, sent with portfolio requests and with
 * questions to the analyst, never persisted on the server. Clearing site data removes them.
 */
import { useCallback, useEffect, useState } from "react";

const KEY = "argus.holdings";

export interface Holding {
  id: number;
  amount: number;
}

function read(): Record<number, number> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const id = Number(k);
      const amount = Number(v);
      if (Number.isInteger(id) && id > 0 && Number.isFinite(amount) && amount > 0) out[id] = amount;
    }
    return out;
  } catch {
    return {};
  }
}

const listeners = new Set<() => void>();

function write(map: Record<number, number>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l());
}

/** Holdings as the API wants them. Safe to call outside React. */
export function getHoldings(): Holding[] {
  return Object.entries(read()).map(([id, amount]) => ({ id: Number(id), amount }));
}

export function useHoldings() {
  const [map, setMap] = useState<Record<number, number>>(read);
  useEffect(() => {
    const l = () => setMap(read());
    listeners.add(l);
    window.addEventListener("storage", l);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", l);
    };
  }, []);

  const set = useCallback((id: number, amount: number | null) => {
    const cur = read();
    if (amount === null || !Number.isFinite(amount) || amount <= 0) delete cur[id];
    else cur[id] = amount;
    write(cur);
  }, []);

  const clear = useCallback(() => write({}), []);

  const list: Holding[] = Object.entries(map).map(([id, amount]) => ({ id: Number(id), amount }));
  return { map, list, set, clear, count: list.length };
}
