/**
 * The proof of the pitch, right under the pulse tiles: what Argus caught on its own,
 * and a quantified explanation of any move. Both lead into the Analyst.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Radar, SplitSquareHorizontal, Sparkles, RefreshCw, ArrowRight, Search, KeyRound } from "lucide-react";
import { getAnthropicKey, onKeyChange } from "../../lib/keys";
import clsx from "clsx";
import { api, type Explanation } from "../../lib/api";
import { usd, pct, timeAgo } from "../../lib/format";
import { Skeleton } from "../ui/Skeleton";
import { Change } from "../ui/Change";
import { StoryCoverflow } from "./StoryCoverflow";

/** 240 -> "4h", 90 -> "90 min". */
function every(min?: number): string {
  const m = min ?? 240;
  return m % 60 === 0 ? `${m / 60}h` : `${m} min`;
}

function NoticedFeed() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["findings"], queryFn: api.findings, refetchInterval: 60_000 });
  const [ownKey, setOwnKey] = useState(Boolean(getAnthropicKey()));
  useEffect(() => onKeyChange(() => setOwnKey(Boolean(getAnthropicKey()))), []);
  const [explain, setExplain] = useState(false);
  const scanNow = useMutation({ mutationFn: api.scanNow, onSuccess: (d) => { qc.setQueryData(["findings"], d); void qc.invalidateQueries({ queryKey: ["stream"] }); } });
  const busy = scanNow.isPending || Boolean(data?.scanning);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-ink-3">
        <span>
          {data?.paused ? <span className="pill mr-1.5 bg-down-dim px-2 py-0.5 text-down">automation paused</span> : null}
          Scans 200 coins, sectors, liquidations, dominance and sentiment every {every(data?.intervalMinutes)}
          {data?.lastScanAt ? ` · last scan ${timeAgo(data.lastScanAt)}` : ""} · brief every 4h
        </span>
        <button
          data-tour="scan"
          onClick={() => (ownKey ? scanNow.mutate() : setExplain((x) => !x))}
          disabled={busy}
          aria-expanded={!ownKey ? explain : undefined}
          className="glass-2 pill flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] text-ink-2 hover:text-ink disabled:opacity-60"
        >
          {ownKey ? <RefreshCw size={11} className={busy ? "animate-spin" : ""} /> : <KeyRound size={11} className="text-gold" />}
          {busy ? "Scanning" : "Scan now"}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {explain && !ownKey && (
          <motion.div
            key="scan-explain"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="glass-2 mb-4 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-dim text-gold"><KeyRound size={15} /></span>
                <div>
                  <div className="text-[13.5px] font-medium text-ink">Scan on demand with your own key</div>
                  <p className="mt-0.5 max-w-[560px] text-[12.5px] leading-relaxed text-ink-3">
                    Argus scans by itself every {every(data?.intervalMinutes)}. To scan right now, add your Anthropic key. It stays in your browser, is used only for your request, and is never stored in a database.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => setExplain(false)} className="pill px-3 py-1.5 text-[12px] text-ink-2 hover:text-ink">Not now</button>
                <Link to="/keys" className="pill bg-gold px-3.5 py-1.5 text-[12px] font-medium text-bg hover:bg-gold-2">Add my key</Link>
              </div>
            </div>
          </motion.div>
        )}
        {scanNow.isError && (
          <motion.div key="scan-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-3 text-[12px] text-down">
            {(scanNow.error as Error).message}
          </motion.div>
        )}
      </AnimatePresence>
      <StoryCoverflow />
    </div>
  );
}

function AttributionBar({ e }: { e: Explanation }) {
  const parts = [
    { label: "Market beta", value: e.market_component_pct ?? 0, color: "#8fb7ff" },
    { label: e.sector ? `${e.sector.name} sector` : "Sector", value: e.sector?.excess_pct ?? 0, color: "#c99cff" },
    { label: "Coin-specific", value: e.coin_specific_pct ?? 0, color: "#e7c46a" },
  ];
  const scale = Math.max(1, ...parts.map((p) => Math.abs(p.value)), Math.abs(e.coin_change_pct));
  return (
    <div className="space-y-2.5">
      {parts.map((p) => (
        <div key={p.label}>
          <div className="mb-1 flex items-center justify-between text-[11.5px]">
            <span className="text-ink-2">{p.label}</span>
            <span className="font-mono" style={{ color: p.color }}>{pct(p.value, 2)}</span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-surface-2">
            <div className="absolute inset-y-0 left-1/2 w-px bg-line-2" />
            <motion.div
              className="absolute inset-y-0 rounded-full"
              style={{ background: p.color, left: p.value >= 0 ? "50%" : undefined, right: p.value < 0 ? "50%" : undefined }}
              initial={{ width: 0 }}
              animate={{ width: `${(Math.abs(p.value) / scale) * 50}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MoveExplainer() {
  const movers = useQuery({ queryKey: ["movers"], queryFn: api.movers });
  const [symbol, setSymbol] = useState<string | null>(null);
  const [window, setWindow] = useState<"1h" | "24h" | "7d">("24h");
  const [typed, setTyped] = useState("");
  const chips = useMemo(() => {
    if (!movers.data) return [];
    return [...movers.data.gainers.slice(0, 3), ...movers.data.losers.slice(0, 3)];
  }, [movers.data]);
  const active = symbol ?? chips[0]?.symbol ?? "BTC";
  const { data, isLoading, error } = useQuery({ queryKey: ["explain", active, window], queryFn: () => api.explain(active, window), staleTime: 2 * 60_000 });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <div className="mb-2 text-[11.5px] text-ink-3">Pick a mover, or type any symbol.</div>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button key={c.id} onClick={() => setSymbol(c.symbol)} className={clsx("pill flex items-center gap-1.5 px-2.5 py-1 text-[12px]", active === c.symbol ? "bg-ink text-bg" : "glass-2 text-ink-2 hover:text-ink")}>
              <img src={`https://s2.coinmarketcap.com/static/img/coins/32x32/${c.id}.png`} alt="" className="h-4 w-4 rounded-full" />
              {c.symbol} <Change value={c.quote.percent_change_24h} className={clsx("text-[11px]", active === c.symbol && "text-bg")} />
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { setSymbol(typed.trim().toUpperCase()); setTyped(""); } }} className="mt-3 flex gap-2">
          <div className="glass-2 pill flex flex-1 items-center gap-2 px-3 py-1.5">
            <Search size={13} className="text-ink-3" />
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="e.g. HYPE" className="w-full bg-transparent text-[13px] placeholder:text-ink-3 focus:outline-none" />
          </div>
          <div className="glass-2 pill flex p-0.5">
            {(["1h", "24h", "7d"] as const).map((w) => (
              <button type="button" key={w} onClick={() => setWindow(w)} className={clsx("pill px-2.5 py-1 font-mono text-[11px]", window === w ? "bg-ink text-bg" : "text-ink-2")}>{w}</button>
            ))}
          </div>
        </form>
        <p className="mt-4 text-[12px] leading-relaxed text-ink-3">
          Beta comes from 30 daily closes against BTC. Sector is CoinMarketCap's category average. Whatever the two don't explain is coin-specific. A decomposition, not a cause; the analyst adds the narrative.
        </p>
      </div>
      <div className="glass-2 rounded-2xl p-4">
        {isLoading && <Skeleton className="h-[220px]" />}
        {error && <div className="text-[12.5px] text-down">Could not explain {active}: {error instanceof Error ? error.message : "unknown error"}</div>}
        {data && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <img src={`https://s2.coinmarketcap.com/static/img/coins/64x64/${data.id}.png`} alt="" className="h-7 w-7 rounded-full" />
                  <div className="font-display text-[22px] font-medium leading-none">{data.symbol} <span className={data.coin_change_pct >= 0 ? "text-up" : "text-down"}>{pct(data.coin_change_pct, 2)}</span></div>
                </div>
                <div className="mt-1 font-mono text-[11px] text-ink-3">{usd(data.price)} · cap {usd(data.market_cap, { compact: true })} · vol {usd(data.volume_24h, { compact: true })} · {data.window}</div>
              </div>
              <span className="pill bg-gold-dim px-2.5 py-1 text-[11px] text-gold">{data.read}</span>
            </div>
            <div className="mt-4"><AttributionBar e={data} /></div>
            <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
              <div className="rounded-xl bg-surface-2 p-2"><div className="text-ink-3">BTC {data.window}</div><div>{pct(data.btc_change_pct, 2)}</div></div>
              <div className="rounded-xl bg-surface-2 p-2"><div className="text-ink-3">beta · corr</div><div>{data.beta_to_btc ?? "—"} · {data.correlation_to_btc ?? "—"}</div></div>
              <div className="rounded-xl bg-surface-2 p-2"><div className="text-ink-3">liq 24h</div><div>{data.leverage?.coin_liquidations_usd ? `${usd(data.leverage.coin_liquidations_usd, { compact: true })} · ${data.leverage.long_share_pct}% L` : "—"}</div></div>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-2">{data.read_text}</p>
            <Link to={`/analyst?q=${encodeURIComponent(`Why is ${data.symbol} moving today? Use explain_move and add the narrative.`)}`} className="pill mt-4 inline-flex items-center gap-1.5 bg-gold px-3.5 py-1.5 text-[12.5px] font-medium text-bg hover:bg-gold-2">
              <Sparkles size={13} /> Ask Argus why <ArrowRight size={13} />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export function Spotlight() {
  const [tab, setTab] = useState<"noticed" | "explain">("noticed");
  const tabs = [
    { key: "noticed" as const, label: "Argus noticed", icon: Radar, hint: "What the agent caught on its own" },
    { key: "explain" as const, label: "Move explainer", icon: SplitSquareHorizontal, hint: "Why a coin moved, in numbers" },
  ];
  return (
    <section className="glass hud p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="glass-2 pill flex p-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={clsx("pill relative flex items-center gap-2 px-4 py-2 text-[13px] font-medium transition-colors", tab === t.key ? "text-bg" : "text-ink-2 hover:text-ink")}>
              {tab === t.key && <motion.span layoutId="spot-tab" className="absolute inset-0 rounded-full bg-gold" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <t.icon size={14} className="relative" /> <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="text-[12px] text-ink-3">{tabs.find((t) => t.key === tab)?.hint}</div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {tab === "noticed" ? <NoticedFeed /> : <MoveExplainer />}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
