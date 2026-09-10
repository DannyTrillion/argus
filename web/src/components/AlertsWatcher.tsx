/**
 * Mounted once in the shell. Re-evaluates local alerts every minute against the
 * overview and top-200 data, fires browser notifications, and shows a toast.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { BellRing, X } from "lucide-react";
import { api } from "../lib/api";
import { evaluate, describeAlert, type Alert } from "../lib/alerts";
import { Mascot } from "./ui/Mascot";

export function AlertsWatcher() {
  const overview = useQuery({ queryKey: ["overview"], queryFn: api.overview, refetchInterval: 60_000 });
  const coins = useQuery({ queryKey: ["coins", 200], queryFn: () => api.coins(200), refetchInterval: 60_000 });
  const [toasts, setToasts] = useState<Alert[]>([]);

  useEffect(() => {
    if (!overview.data || !coins.data) return;
    const prices = new Map(coins.data.coins.map((c) => [c.id, c.quote.price ?? NaN]));
    const fired = evaluate({ prices, fearGreed: overview.data.fearGreed.value, btcDominance: overview.data.global.btc_dominance });
    if (fired.length === 0) return;
    setToasts((t) => [...t, ...fired]);
    for (const a of fired) {
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Argus alert", { body: `${describeAlert(a)} · now ${a.triggeredValue}`, icon: "/mascot-160.png" });
        }
      } catch { /* ignore */ }
    }
  }, [overview.data, coins.data]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((x) => x.slice(1)), 8000);
    return () => clearTimeout(t);
  }, [toasts]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-40 flex w-[min(360px,calc(100vw-32px))] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((a) => (
          <motion.div key={a.id + (a.triggeredAt ?? "")} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass pointer-events-auto flex items-start gap-3 p-3">
            <Mascot size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gold"><BellRing size={12} /> Alert</div>
              <div className="text-[13px]">{describeAlert(a)}</div>
              <div className="font-mono text-[11px] text-ink-3">now {a.kind === "price" ? `$${a.triggeredValue?.toLocaleString("en-US", { maximumFractionDigits: 4 })}` : a.triggeredValue}</div>
            </div>
            <button onClick={() => setToasts((x) => x.filter((y) => y !== a))} className="text-ink-3 hover:text-ink" aria-label="Dismiss"><X size={14} /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
