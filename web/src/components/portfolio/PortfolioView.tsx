import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Sparkles, Wallet, TriangleAlert, Trash2, Info, ClipboardPaste, Check } from "lucide-react";
import { parseHoldings, resolveHoldings } from "../../lib/parseHoldings";
import { useWatchlist } from "../../lib/watchlist";
import clsx from "clsx";
import { api, type Portfolio, type CoinRow } from "../../lib/api";
import { useHoldings } from "../../lib/holdings";
import { usd, pct } from "../../lib/format";
import { useEChart, palette, tooltipStyle, axisStyle } from "../../lib/chart";
import { Card, CardTitle } from "../ui/Card";
import { Change } from "../ui/Change";
import { Skeleton } from "../ui/Skeleton";
import { Mascot } from "../ui/Mascot";

const SECTOR_COLORS = ["#e7c46a", "#8fb7ff", "#c99cff", "#6fd39c", "#ef9f6f", "#7fd7e8", "#d78fb7"];

/** "+$1,204" / "−$380.94", rather than the "$-380.94" a plain currency format gives. */
function signedUsd(n: number): string {
  return `${n < 0 ? "−" : "+"}${usd(Math.abs(n))}`;
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="glass-2 rounded-2xl p-3.5">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className={clsx("font-display mt-1 text-[22px] font-light leading-none", tone === "up" && "text-up", tone === "down" && "text-down")}>{value}</div>
      {sub !== undefined && <div className="mt-1.5 text-[11.5px] text-ink-3">{sub}</div>}
    </div>
  );
}

/** Basket value against Bitcoin, both rebased to 100 so the shapes are comparable. */
function ValueChart({ p }: { p: Portfolio }) {
  const option = useMemo(() => {
    if (p.history.length < 3) return null;
    const base = p.history[0].value;
    const mine = p.history.map((x) => Math.round((x.value / base) * 1000) / 10);
    const btcBase = p.btc_history[0]?.value;
    const btc = btcBase ? p.btc_history.map((x) => Math.round((x.value / btcBase) * 1000) / 10) : [];
    return {
      animationDuration: 600,
      grid: { left: 8, right: 8, top: 30, bottom: 20, containLabel: true },
      tooltip: { ...tooltipStyle, trigger: "axis", valueFormatter: (v: number) => (v === null ? "—" : `${v.toFixed(1)}`) },
      legend: { top: 0, left: 0, textStyle: { color: palette.ink2, fontSize: 11 }, icon: "roundRect", itemWidth: 10, itemHeight: 10 },
      xAxis: { type: "category", data: p.history.map((x) => x.date.slice(5)), boundaryGap: false, ...axisStyle, splitLine: { show: false } },
      yAxis: { type: "value", scale: true, ...axisStyle },
      series: [
        {
          name: "Your basket",
          type: "line",
          smooth: 0.2,
          showSymbol: false,
          data: mine,
          lineStyle: { color: palette.gold, width: 2.2 },
          itemStyle: { color: palette.gold },
          areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(231,196,106,0.18)" }, { offset: 1, color: "rgba(231,196,106,0)" }] } },
        },
        ...(btc.length
          ? [{ name: "Bitcoin", type: "line", smooth: 0.2, showSymbol: false, data: btc, lineStyle: { color: "#8fb7ff", width: 1.5, type: "dashed" }, itemStyle: { color: "#8fb7ff" } }]
          : []),
      ],
    };
  }, [p]);
  const ref = useEChart(option);
  if (!option) return null;
  return (
    <Card className="lg:col-span-2">
      <CardTitle right={<span className="text-[11px] text-ink-3">rebased to 100 · {p.risk?.days ?? p.history.length} days</span>}>Your basket vs Bitcoin</CardTitle>
      <div ref={ref} className="h-[280px] w-full" />
      {p.risk && (
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Return", `${p.risk.return_pct > 0 ? "+" : ""}${p.risk.return_pct}%`],
            ["Volatility", `${p.risk.annualized_volatility_pct}%`],
            ["Max drawdown", `${p.risk.max_drawdown_pct}%`],
            ["Correlation to BTC", p.risk.correlation_to_btc === null ? "—" : String(p.risk.correlation_to_btc)],
          ].map(([k, v]) => (
            <div key={k} className="glass-2 rounded-xl p-2.5 text-center">
              <div className="text-[10.5px] text-ink-3">{k}</div>
              <div className="mt-0.5 font-mono text-[13px]">{v}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AttributionCard({ p }: { p: Portfolio }) {
  const a = p.attribution;
  if (!a) return null;
  const parts = [
    { label: "Market beta", value: a.market_component_pct ?? 0, color: "#8fb7ff" },
    { label: "Sector", value: a.sector_excess_pct ?? 0, color: "#c99cff" },
    { label: "What you hold", value: a.coin_specific_pct ?? 0, color: palette.gold },
  ];
  const scale = Math.max(0.5, ...parts.map((x) => Math.abs(x.value)), Math.abs(a.total_pct));
  return (
    <Card>
      <CardTitle right={<span className="pill bg-gold-dim px-2 py-0.5 font-mono text-[10.5px] text-gold">{a.read}</span>}>Why your portfolio moved</CardTitle>
      <div className="space-y-2.5">
        {parts.map((x) => (
          <div key={x.label}>
            <div className="mb-1 flex items-center justify-between text-[11.5px]">
              <span className="text-ink-2">{x.label}</span>
              <span className="font-mono" style={{ color: x.color }}>{pct(x.value, 2)}</span>
            </div>
            <div className="relative h-2 w-full rounded-full bg-surface-2">
              <div className="absolute inset-y-0 left-1/2 w-px bg-line-2" />
              <motion.div
                className="absolute inset-y-0 rounded-full"
                style={{ background: x.color, left: x.value >= 0 ? "50%" : undefined, right: x.value < 0 ? "50%" : undefined }}
                initial={{ width: 0 }}
                animate={{ width: `${(Math.abs(x.value) / scale) * 50}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-2">{a.read_text}</p>
      <div className="mt-2 font-mono text-[10.5px] text-ink-3">BTC {pct(a.btc_change_pct, 2)} · basket beta {a.beta_to_btc ?? "—"}</div>
    </Card>
  );
}

function ExposureCard({ p }: { p: Portfolio }) {
  const c = p.concentration;
  const heavy = c.top1_pct >= 50 || c.effective_positions < 2;
  return (
    <Card>
      <CardTitle right={<span className="font-mono text-[11px] text-ink-3">{p.positions.length} positions</span>}>Concentration and sectors</CardTitle>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Largest", `${c.top1_pct}%`],
          ["Top three", `${c.top3_pct}%`],
          ["Effective", String(c.effective_positions)],
        ].map(([k, v]) => (
          <div key={k} className="glass-2 rounded-xl p-2.5 text-center">
            <div className="text-[10.5px] text-ink-3">{k}</div>
            <div className="mt-0.5 font-mono text-[13px]">{v}</div>
          </div>
        ))}
      </div>
      {heavy && (
        <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-down-dim px-3 py-2 text-[11.5px] text-down">
          <TriangleAlert size={13} className="mt-0.5 shrink-0" />
          <span>
            {c.top1_pct}% of this portfolio sits in one position. Its effective spread is {c.effective_positions} positions, so the basket behaves like a much smaller one.
          </span>
        </div>
      )}
      {p.sectors.length > 0 && (
        <div className="mt-4 space-y-2">
          {p.sectors.map((s, i) => (
            <div key={s.name}>
              <div className="mb-1 flex items-center justify-between text-[11.5px]">
                <span className="text-ink-2">{s.name}</span>
                <span className="font-mono text-ink-3">
                  {s.weight_pct}%{s.change_24h_pct !== null && <span className={clsx("ml-1.5", s.change_24h_pct >= 0 ? "text-up" : "text-down")}>{pct(s.change_24h_pct, 1)}</span>}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
                  initial={{ width: 0 }}
                  animate={{ width: `${s.weight_pct}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AmountInput({ id, symbol, value, onChange }: { id: number; symbol: string; value: number | undefined; onChange: (amount: number | null) => void }) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    setText(value === undefined ? "" : String(value));
  }, [value, id]);
  return (
    <div className="glass-2 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5">
      <input
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(/[^0-9.]/g, "");
          setText(next);
          const n = Number(next);
          onChange(next === "" || !Number.isFinite(n) || n <= 0 ? null : n);
        }}
        inputMode="decimal"
        placeholder="0"
        aria-label={`Amount of ${symbol}`}
        className="w-[86px] bg-transparent text-right font-mono text-[13px] text-ink placeholder:text-ink-3 focus:outline-none"
      />
      <span className="font-mono text-[11px] text-ink-3">{symbol}</span>
    </div>
  );
}

export function PortfolioView({ coins, watchIds }: { coins: CoinRow[]; watchIds: number[] }) {
  const holdings = useHoldings();
  const [debounced, setDebounced] = useState(holdings.list);

  // Typing an amount should not fire a request per keystroke.
  const fingerprint = holdings.list.map((h) => `${h.id}:${h.amount}`).sort().join(",");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(holdings.list), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["portfolio", debounced.map((h) => `${h.id}:${h.amount}`).sort().join(",")],
    queryFn: () => api.portfolio(debounced),
    enabled: debounced.length > 0,
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });

  const byId = useMemo(() => new Map(coins.map((c) => [c.id, c])), [coins]);
  // Everything worth showing an amount box for: what you already hold, plus your watchlist.
  const editorIds = useMemo(() => {
    const ids = [...holdings.list.map((h) => h.id), ...watchIds];
    return [...new Set(ids)];
  }, [holdings.list, watchIds]);

  const askUrl = data
    ? `/analyst?q=${encodeURIComponent("Analyse my portfolio: what is driving it, where is the risk concentrated, and what should I watch?")}`
    : "/analyst";

  if (holdings.count === 0) {
    return (
      <div className="space-y-4">
        <Card className="hud">
          <div className="flex flex-col items-start gap-5 p-2 sm:flex-row sm:items-center">
            <Mascot size={104} className="scan shrink-0 rounded-full" />
            <div>
              <div className="font-display text-[24px] font-light leading-tight">
                Tell me what you hold. <span className="text-glow">I'll tell you why it moved.</span>
              </div>
              <p className="mt-2 max-w-[620px] text-[13.5px] leading-relaxed text-ink-2">
                Put an amount next to any coin below and Argus prices the basket, splits today's move into market beta, sector and the part that is specific to what you own, and measures how concentrated you are. Amounts stay in this browser. No wallet, no signature, nothing stored on the server.
              </p>
            </div>
          </div>
        </Card>
        <HoldingsEditor ids={editorIds} byId={byId} holdings={holdings} positions={[]} />
      </div>
    );
  }

  if (isLoading || !data) return <Skeleton className="h-[420px]" />;

  const up = (data.change_24h_pct ?? 0) >= 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
            <Wallet size={13} className="text-gold" /> {data.positions.length} positions · in this browser only
            {isFetching && <span className="text-ink-3">· updating</span>}
          </div>
          <div className="font-display mt-1 text-[38px] font-light leading-none tracking-tight sm:text-[44px]">{usd(data.total_value_usd)}</div>
        </div>
        <Link to={askUrl} className="pill inline-flex items-center gap-2 bg-gold px-4 py-2.5 text-[13px] font-medium text-bg hover:bg-gold-2">
          <Sparkles size={14} /> Ask Argus about this
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="24 hours"
          value={data.change_24h_usd === null ? "—" : signedUsd(data.change_24h_usd)}
          tone={up ? "up" : "down"}
          sub={<Change value={data.change_24h_pct} className="text-[11.5px]" />}
        />
        <Tile label="7 days" value={data.change_7d_pct === null ? "—" : pct(data.change_7d_pct, 2)} sub={data.change_7d_usd === null ? undefined : signedUsd(data.change_7d_usd)} />
        <Tile
          label="vs holding Bitcoin"
          value={data.vs_btc_pct === null ? "—" : pct(data.vs_btc_pct, 2)}
          sub={data.vs_btc_pct === null ? undefined : data.vs_btc_pct >= 0 ? "you did better" : "you did worse"}
        />
        <Tile label="vs the whole market" value={data.vs_market_pct === null ? "—" : pct(data.vs_market_pct, 2)} sub="total cap, 24h" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ValueChart p={data} />
        <AttributionCard p={data} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ExposureCard p={data} />
        <Card className="lg:col-span-2">
          <CardTitle right={<span className="text-[11px] text-ink-3">points of the 24h move</span>}>What moved your value</CardTitle>
          {data.contributors.up.length === 0 && data.contributors.down.length === 0 ? (
            <div className="py-6 text-center text-[12.5px] text-ink-3">No position moved enough to matter today.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {(["up", "down"] as const).map((side) => (
                <div key={side}>
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-ink-3">{side === "up" ? "Added" : "Took away"}</div>
                  <div className="space-y-2">
                    {data.contributors[side].length === 0 && <div className="text-[12px] text-ink-3">Nothing</div>}
                    {data.contributors[side].map((c) => (
                      <div key={c.id} className="glass-2 flex items-center gap-2.5 rounded-xl px-3 py-2">
                        <img src={`https://s2.coinmarketcap.com/static/img/coins/32x32/${c.id}.png`} alt="" className="h-6 w-6 rounded-full bg-surface-2" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] font-medium">{c.symbol}</div>
                          <div className="font-mono text-[10.5px] text-ink-3">{c.weight_pct}% of book</div>
                        </div>
                        <div className="text-right">
                          <div className={clsx("font-mono text-[12.5px]", side === "up" ? "text-up" : "text-down")}>{pct(c.contribution_24h_pp, 2)}</div>
                          <div className="font-mono text-[10.5px] text-ink-3">{pct(c.change_24h_pct, 1)} price</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <HoldingsEditor ids={editorIds} byId={byId} holdings={holdings} positions={data.positions} />

      <div className="flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-ink-3">
        <Info size={13} className="mt-0.5 shrink-0" />
        <div>{data.caveats.join(" ")}</div>
      </div>
    </div>
  );
}

function HoldingsEditor({
  ids,
  byId,
  holdings,
  positions,
}: {
  ids: number[];
  byId: Map<number, CoinRow>;
  holdings: ReturnType<typeof useHoldings>;
  positions: Portfolio["positions"];
}) {
  const posById = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions]);
  const [pasting, setPasting] = useState(false);
  const rows = ids
    .map((id) => {
      const coin = byId.get(id);
      const pos = posById.get(id);
      return {
        id,
        symbol: coin?.symbol ?? pos?.symbol ?? String(id),
        name: coin?.name ?? pos?.name ?? `Coin ${id}`,
        price: coin?.quote.price ?? pos?.price ?? null,
        value: pos?.value_usd ?? null,
        weight: pos?.weight_pct ?? null,
        held: holdings.map[id] !== undefined,
      };
    })
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.symbol.localeCompare(b.symbol));

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <CardTitle className="mb-0">Your holdings</CardTitle>
        <div className="flex items-center gap-2">
          <button onClick={() => setPasting((x) => !x)} aria-expanded={pasting} className="glass-2 pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] text-ink-2 hover:text-gold">
            <ClipboardPaste size={12} /> Paste a list
          </button>
          {holdings.count > 0 && (
            <button onClick={holdings.clear} className="glass-2 pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] text-ink-3 hover:text-down">
              <Trash2 size={12} /> Clear all
            </button>
          )}
        </div>
      </div>
      {pasting && <PastePanel byId={byId} holdings={holdings} onDone={() => setPasting(false)} />}
      <div className="mt-3 divide-y divide-line">
        {rows.length === 0 && (
          <div className="p-6 text-center text-[13px] text-ink-3">
            Star a few coins on{" "}
            <Link to="/explore" className="text-gold hover:underline">
              Explore
            </Link>{" "}
            and they will appear here with an amount box.
          </div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2 sm:px-4">
            <img src={`https://s2.coinmarketcap.com/static/img/coins/32x32/${r.id}.png`} alt="" className="h-7 w-7 shrink-0 rounded-full bg-surface-2" />
            <Link to={`/coin/${r.id}`} className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium">
                {r.name} <span className="text-ink-3">{r.symbol}</span>
              </div>
              <div className="truncate font-mono text-[11px] text-ink-3">
                {r.price === null ? "—" : usd(r.price)}
                {r.weight !== null && <span> · {r.weight}% of book</span>}
              </div>
            </Link>
            {r.value !== null && <div className="hidden shrink-0 text-right font-mono text-[12.5px] sm:block">{usd(r.value)}</div>}
            <AmountInput id={r.id} symbol={r.symbol} value={holdings.map[r.id]} onChange={(amount) => holdings.set(r.id, amount)} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Paste "0.5 BTC, 10 SOL" instead of typing amounts row by row. Previews matches before adding. */
function PastePanel({ byId, holdings, onDone }: { byId: Map<number, CoinRow>; holdings: ReturnType<typeof useHoldings>; onDone: () => void }) {
  const [text, setText] = useState("");
  const wl = useWatchlist();
  const parsed = useMemo(() => parseHoldings(text), [text]);
  const resolved = useMemo(() => resolveHoldings(parsed.items, [...byId.values()]), [parsed, byId]);
  const misses = [...resolved.unknown, ...parsed.unreadable];

  const apply = () => {
    for (const m of resolved.matched) {
      holdings.set(m.id, m.amount);
      if (!wl.has(m.id)) wl.toggle(m.id);
    }
    onDone();
  };

  return (
    <div className="mx-4 mt-3 rounded-2xl border border-line bg-surface-2 p-3.5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        autoFocus
        spellCheck={false}
        placeholder={"0.5 BTC, 10 SOL\n2,500 XRP"}
        aria-label="Paste your holdings"
        className="w-full resize-y bg-transparent font-mono text-[13px] text-ink placeholder:text-ink-3 focus:outline-none"
      />
      {text.trim() && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
          {resolved.matched.map((m) => (
            <span key={m.id} className="pill bg-up-dim px-2 py-0.5 font-mono text-up">{m.amount} {m.symbol}</span>
          ))}
          {misses.map((u) => (
            <span key={u} className="pill bg-down-dim px-2 py-0.5 font-mono text-down" title="Not recognised, or not in the top 200">{u}</span>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[11.5px] text-ink-3">Amount and symbol, separated by commas or new lines. Matches the top 200 coins and replaces amounts you already had.</span>
        <div className="flex shrink-0 justify-end gap-2">
          <button onClick={onDone} className="pill px-3 py-1.5 text-[12px] text-ink-2 hover:text-ink">Cancel</button>
          <button onClick={apply} disabled={resolved.matched.length === 0} className="pill inline-flex items-center gap-1.5 bg-gold px-3.5 py-1.5 text-[12px] font-medium text-bg hover:bg-gold-2 disabled:opacity-50">
            <Check size={13} /> {resolved.matched.length > 0 ? `Add ${resolved.matched.length}` : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
