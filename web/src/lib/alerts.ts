/**
 * Local alerts. Stored in localStorage, evaluated in the browser against the same
 * live data the screens already fetch, delivered as browser notifications and an
 * in-app toast. No server state.
 */
import { useCallback, useEffect, useState } from "react";

export type AlertKind = "price" | "fear_greed" | "btc_dominance";
export interface Alert {
  id: string;
  kind: AlertKind;
  coinId?: number;
  symbol?: string;
  op: "above" | "below";
  value: number;
  createdAt: string;
  triggeredAt?: string;
  triggeredValue?: number;
}

const KEY = "argus.alerts.v1";
const listeners = new Set<() => void>();

export function readAlerts(): Alert[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Alert[]) : [];
  } catch {
    return [];
  }
}

export function writeAlerts(list: Alert[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>(readAlerts);
  useEffect(() => {
    const l = () => setAlerts(readAlerts());
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const add = useCallback((a: Omit<Alert, "id" | "createdAt">) => {
    writeAlerts([...readAlerts(), { ...a, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  }, []);
  const remove = useCallback((id: string) => writeAlerts(readAlerts().filter((a) => a.id !== id)), []);
  const reset = useCallback((id: string) => writeAlerts(readAlerts().map((a) => (a.id === id ? { ...a, triggeredAt: undefined, triggeredValue: undefined } : a))), []);
  return { alerts, add, remove, reset };
}

export function describeAlert(a: Alert): string {
  const target = a.kind === "price" ? `$${a.value.toLocaleString("en-US", { maximumFractionDigits: 6 })}` : a.kind === "btc_dominance" ? `${a.value}%` : `${a.value}`;
  const subject = a.kind === "price" ? a.symbol ?? "price" : a.kind === "btc_dominance" ? "BTC dominance" : "Fear & Greed";
  return `${subject} ${a.op} ${target}`;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try { return (await Notification.requestPermission()) === "granted"; } catch { return false; }
}

/** Evaluate alerts against fresh values. Returns the alerts that fired this pass. */
export function evaluate(values: { prices: Map<number, number>; fearGreed?: number; btcDominance?: number }): Alert[] {
  const list = readAlerts();
  const fired: Alert[] = [];
  const now = new Date().toISOString();
  const next = list.map((a) => {
    if (a.triggeredAt) return a;
    const current = a.kind === "price" ? (a.coinId !== undefined ? values.prices.get(a.coinId) : undefined) : a.kind === "fear_greed" ? values.fearGreed : values.btcDominance;
    if (current === undefined) return a;
    const hit = a.op === "above" ? current >= a.value : current <= a.value;
    if (!hit) return a;
    const t = { ...a, triggeredAt: now, triggeredValue: current };
    fired.push(t);
    return t;
  });
  if (fired.length) writeAlerts(next);
  return fired;
}
