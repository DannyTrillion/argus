import { useState } from "react";
import { Bell, Check } from "lucide-react";
import clsx from "clsx";
import { useAlerts, ensureNotificationPermission } from "../../lib/alerts";

export function AlertButton({ coinId, symbol, price }: { coinId: number; symbol: string; price: number | null }) {
  const { alerts, add } = useAlerts();
  const [open, setOpen] = useState(false);
  const [op, setOp] = useState<"above" | "below">("above");
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const mine = alerts.filter((a) => a.kind === "price" && a.coinId === coinId && !a.triggeredAt);

  const submit = async () => {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return;
    add({ kind: "price", coinId, symbol, op, value: v });
    setValue("");
    setSaved(true);
    setTimeout(() => { setSaved(false); setOpen(false); }, 900);
    void ensureNotificationPermission();
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className={clsx("glass-2 flex h-11 items-center gap-2 rounded-full px-4 text-[13px]", mine.length ? "text-gold" : "text-ink-2 hover:text-ink")} aria-label="Price alert">
        <Bell size={15} fill={mine.length ? "currentColor" : "none"} /> {mine.length ? `${mine.length} alert${mine.length > 1 ? "s" : ""}` : "Alert me"}
      </button>
      {open && (
        <div className="glass absolute right-0 top-[calc(100%+8px)] z-30 w-[260px] p-3">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-ink-3">Notify me when {symbol} is</div>
          <div className="flex gap-2">
            <div className="glass-2 pill flex p-0.5">
              {(["above", "below"] as const).map((o) => (
                <button key={o} onClick={() => setOp(o)} className={clsx("pill px-2.5 py-1 text-[12px]", op === o ? "bg-ink text-bg" : "text-ink-2")}>{o}</button>
              ))}
            </div>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              inputMode="decimal"
              placeholder={price ? String(Math.round(price * (op === "above" ? 1.05 : 0.95) * 100) / 100) : "price"}
              className="glass-2 pill min-w-0 flex-1 bg-transparent px-3 py-1 font-mono text-[12.5px] focus:outline-none"
            />
          </div>
          <button onClick={submit} className="pill mt-2 flex w-full items-center justify-center gap-1.5 bg-gold py-1.5 text-[12.5px] font-medium text-bg hover:bg-gold-2">
            {saved ? <><Check size={13} /> Saved</> : "Set alert"}
          </button>
          <div className="mt-2 text-[11px] text-ink-3">Checked every minute while Argus is open.</div>
        </div>
      )}
    </div>
  );
}
