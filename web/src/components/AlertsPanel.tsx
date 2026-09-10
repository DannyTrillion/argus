/**
 * Slide-over panel listing local alerts, with a form for market-level alerts.
 */
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Trash2, RotateCcw, X, Plus } from "lucide-react";
import clsx from "clsx";
import { useAlerts, describeAlert, ensureNotificationPermission, type AlertKind } from "../lib/alerts";
import { Mascot } from "./ui/Mascot";

export function AlertsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { alerts, add, remove, reset } = useAlerts();
  const [kind, setKind] = useState<AlertKind>("fear_greed");
  const [op, setOp] = useState<"above" | "below">("below");
  const [value, setValue] = useState("");
  const [perm, setPerm] = useState<boolean | null>(null);

  const submit = async () => {
    const v = Number(value);
    if (!Number.isFinite(v)) return;
    add({ kind, op, value: v });
    setValue("");
    setPerm(await ensureNotificationPermission());
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[rgba(6,6,8,0.55)] backdrop-blur-sm" onClick={onClose} />
          <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 32 }} className="glass absolute bottom-3 right-3 top-3 flex w-[min(400px,calc(100vw-24px))] flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-2 font-display text-[18px]"><Bell size={16} className="text-gold" /> Alerts</div>
              <button onClick={onClose} className="text-ink-3 hover:text-ink" aria-label="Close"><X size={16} /></button>
            </div>
            <div className="scroll-thin flex-1 overflow-y-auto p-4">
              {alerts.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-[13px] text-ink-3">
                  <Mascot size={72} />
                  No alerts yet. Add one below, or use "Alert me" on any coin page.
                </div>
              )}
              <div className="space-y-2">
                {alerts.map((a) => (
                  <div key={a.id} className={clsx("glass-2 flex items-center gap-3 rounded-2xl px-3 py-2.5", a.triggeredAt && "border-gold/40")}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px]">{describeAlert(a)}</div>
                      <div className="font-mono text-[11px] text-ink-3">{a.triggeredAt ? `fired ${new Date(a.triggeredAt).toLocaleString()} at ${a.triggeredValue}` : "watching · checks every minute"}</div>
                    </div>
                    {a.triggeredAt && <button onClick={() => reset(a.id)} className="text-ink-3 hover:text-ink" title="Re-arm" aria-label="Re-arm"><RotateCcw size={14} /></button>}
                    <button onClick={() => remove(a.id)} className="text-ink-3 hover:text-down" aria-label="Delete"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-line p-4">
              <div className="mb-2 text-[11px] uppercase tracking-wider text-ink-3">Market alert</div>
              <div className="flex flex-wrap gap-2">
                <select value={kind} onChange={(e) => setKind(e.target.value as AlertKind)} className="glass-2 pill bg-transparent px-3 py-1.5 text-[12.5px]">
                  <option value="fear_greed" className="bg-bg">Fear & Greed</option>
                  <option value="btc_dominance" className="bg-bg">BTC dominance %</option>
                </select>
                <select value={op} onChange={(e) => setOp(e.target.value as "above" | "below")} className="glass-2 pill bg-transparent px-3 py-1.5 text-[12.5px]">
                  <option value="below" className="bg-bg">below</option>
                  <option value="above" className="bg-bg">above</option>
                </select>
                <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={kind === "fear_greed" ? "e.g. 40" : "e.g. 60"} className="glass-2 pill w-[92px] bg-transparent px-3 py-1.5 font-mono text-[12.5px] focus:outline-none" />
                <button onClick={submit} className="pill flex items-center gap-1 bg-gold px-3 py-1.5 text-[12.5px] font-medium text-bg hover:bg-gold-2"><Plus size={13} /> Add</button>
              </div>
              {perm === false && <div className="mt-2 text-[11.5px] text-ink-3">Browser notifications are blocked; alerts will still show inside Argus.</div>}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
