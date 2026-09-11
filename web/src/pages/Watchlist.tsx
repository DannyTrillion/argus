import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Star, X, Wallet, ListChecks } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";
import { usd, pct } from "../lib/format";
import { useWatchlist } from "../lib/watchlist";
import { useHoldings } from "../lib/holdings";
import { PortfolioView } from "../components/portfolio/PortfolioView";
import { useEChart, palette, tooltipStyle, axisStyle } from "../lib/chart";
import { Change } from "../components/ui/Change";
import { Sparkline } from "../components/ui/Sparkline";
import { Card, CardTitle } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { Mascot } from "../components/ui/Mascot";

function CompareChart({ symbols, days }: { symbols: string[]; days: number }) {
  const { data, isLoading } = useQuery({ queryKey: ["compare", symbols.join(","), days], queryFn: () => api.compare(symbols, days), enabled: symbols.length >= 1 });

  const lineOption = useMemo(() => {
    if (!data) return null;
    return {
      animationDuration: 500,
      grid: { left: 8, right: 8, top: 28, bottom: 24, containLabel: true },
      tooltip: { ...tooltipStyle, trigger: "axis", valueFormatter: (v: number) => (v === null ? "—" : `${v.toFixed(1)}`) },
      legend: { top: 0, left: 0, textStyle: { color: palette.ink2, fontSize: 11 }, icon: "roundRect", itemWidth: 10, itemHeight: 10 },
      xAxis: { type: "category", data: data.normalized.map((p) => p.date.slice(5)), boundaryGap: false, ...axisStyle, splitLine: { show: false } },
      yAxis: { type: "value", scale: true, ...axisStyle, axisLabel: { ...axisStyle.axisLabel, formatter: (v: number) => `${v}` } },
      series: data.stats.map((s, i) => ({
        name: s.symbol,
        type: "line",
        smooth: 0.2,
        showSymbol: false,
        data: data.normalized.map((p) => p.values[s.symbol]),
        lineStyle: { color: palette.series[i % palette.series.length], width: i === 0 ? 2.2 : 1.6 },
        itemStyle: { color: palette.series[i % palette.series.length] },
      })),
    };
  }, [data]);

  const heatOption = useMemo(() => {
    if (!data) return null;
    const syms = data.stats.map((s) => s.symbol);
    return {
      grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
      tooltip: { ...tooltipStyle, formatter: (p: { data: [number, number, number | null] }) => `${syms[p.data[0]]} × ${syms[p.data[1]]}: <b>${p.data[2] === null ? "—" : p.data[2].toFixed(2)}</b>` },
      xAxis: { type: "category", data: syms, ...axisStyle, splitLine: { show: false } },
      yAxis: { type: "category", data: syms, ...axisStyle, splitLine: { show: false } },
      visualMap: { show: false, min: -1, max: 1, inRange: { color: ["#ef6f6f", "#1a1a1d", "#6fd39c"] } },
      series: [{
        type: "heatmap",
        data: data.correlation.map((c) => [syms.indexOf(c.a), syms.indexOf(c.b), c.r]),
        label: { show: true, color: "#f2f0ea", fontFamily: "JetBrains Mono, monospace", fontSize: 11, formatter: (p: { data: [number, number, number | null] }) => (p.data[2] === null ? "—" : p.data[2].toFixed(2)) },
        itemStyle: { borderColor: "#0a0a0b", borderWidth: 2, borderRadius: 6 },
      }],
    };
  }, [data]);

  const lineRef = useEChart(lineOption);
  const heatRef = useEChart(heatOption);

  if (isLoading || !data) return <Skeleton className="h-[360px]" />;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardTitle right={<span className="text-[11px] text-ink-3">rebased to 100 · {days} days</span>}>Relative performance</CardTitle>
        <div ref={lineRef} className="h-[320px] w-full" />
      </Card>
      <Card>
        <CardTitle right={<span className="text-[11px] text-ink-3">daily returns</span>}>Correlation</CardTitle>
        <div ref={heatRef} className="h-[240px] w-full" />
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {data.stats.map((s) => (
            <div key={s.symbol} className="glass-2 rounded-xl p-2">
              <div className="font-mono text-[11px] text-ink-3">{s.symbol}</div>
              <div className="font-mono text-[12.5px]">{s.annualized_volatility_pct.toFixed(0)}% vol</div>
              <div className="font-mono text-[11px] text-down">{pct(s.max_drawdown_pct, 1)} dd</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function Watchlist() {
  const wl = useWatchlist();
  const holdings = useHoldings();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "portfolio" ? "portfolio" : "watchlist";
  const { data, isLoading } = useQuery({ queryKey: ["coins", 200], queryFn: () => api.coins(200), refetchInterval: 60_000 });
  const [selected, setSelected] = useState<number[]>([]);
  const [days, setDays] = useState(90);

  const rows = useMemo(() => {
    if (!data) return [];
    const byId = new Map(data.coins.map((c) => [c.id, c]));
    return wl.ids.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [data, wl.ids]);

  const compareIds = selected.length >= 2 ? selected : rows.slice(0, Math.min(4, rows.length)).map((c) => c.id);
  const compareSymbols = compareIds.map((id) => rows.find((c) => c.id === id)?.symbol).filter((s): s is string => Boolean(s));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] text-ink-2">
            {view === "portfolio" ? `${holdings.count} held · never leaves this device` : `${rows.length} coins · saved on this device`}
          </div>
          <h1 className="font-display mt-1 text-[34px] font-light leading-tight tracking-tight">{view === "portfolio" ? "Portfolio" : "Watchlist"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass-2 pill flex p-0.5">
            {([["watchlist", "Watchlist", ListChecks], ["portfolio", "Portfolio", Wallet]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setParams(key === "portfolio" ? { view: "portfolio" } : {}, { replace: true })}
                className={clsx("pill flex items-center gap-1.5 px-3 py-1.5 text-[12px]", view === key ? "bg-ink text-bg" : "text-ink-2 hover:text-ink")}
              >
                <Icon size={13} /> {label}
                {key === "portfolio" && holdings.count > 0 && view !== "portfolio" && <span className="ml-0.5 font-mono text-[10px] text-gold">{holdings.count}</span>}
              </button>
            ))}
          </div>
          {view === "watchlist" && (
            <div className="glass-2 pill flex p-0.5">
              {[30, 90, 365].map((d) => (
                <button key={d} onClick={() => setDays(d)} className={clsx("pill px-3 py-1 font-mono text-[11px]", days === d ? "bg-ink text-bg" : "text-ink-2")}>{d === 365 ? "1Y" : `${d}D`}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {view === "portfolio" ? (
        isLoading ? <Skeleton className="h-[420px]" /> : <PortfolioView coins={data?.coins ?? []} watchIds={wl.ids} />
      ) : (
      <>

      <Card className="p-0">
        {isLoading ? (
          <Skeleton className="m-4 h-40" />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center text-[13px] text-ink-3">
            <Mascot size={88} />
            <div>Nothing here yet. Star coins on the Explore page and I will keep an eye on them.</div>
            <Link to="/explore" className="pill mt-1 bg-gold px-3.5 py-1.5 text-[12px] font-medium text-bg hover:bg-gold-2">Open Explore</Link>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((c) => {
              const on = selected.includes(c.id);
              return (
                <div key={c.id} className="flex items-center gap-2.5 px-3 py-3 hover:bg-surface-2 sm:gap-3 sm:px-4">
                  <button
                    onClick={() => setSelected((s) => (on ? s.filter((x) => x !== c.id) : s.length < 6 ? [...s, c.id] : s))}
                    className={clsx("h-4 w-4 shrink-0 rounded border", on ? "border-gold bg-gold" : "border-line-2")}
                    aria-label="Select for comparison"
                  />
                  <img src={`https://s2.coinmarketcap.com/static/img/coins/32x32/${c.id}.png`} alt="" className="h-7 w-7 shrink-0 rounded-full bg-surface-2" />
                  <Link to={`/coin/${c.id}`} className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{c.name} <span className="text-ink-3">{c.symbol}</span></div>
                    <div className="truncate font-mono text-[11px] text-ink-3">{usd(c.quote.market_cap, { compact: true })} · {usd(c.quote.volume_24h, { compact: true })} vol</div>
                  </Link>
                  <div className="hidden md:block"><Sparkline data={c.sparkline} width={110} height={30} /></div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-[13px]">{usd(c.quote.price)}</div>
                    <div className="flex justify-end gap-2">
                      <Change value={c.quote.percent_change_24h} className="text-[11.5px]" />
                      <Change value={c.quote.percent_change_7d} className="hidden text-[11.5px] sm:inline" />
                    </div>
                  </div>
                  <button onClick={() => wl.toggle(c.id)} className="ml-0.5 shrink-0 text-ink-3 hover:text-down" aria-label="Remove"><X size={14} /></button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {compareSymbols.length >= 2 && (
        <>
          <div className="flex items-center gap-2 text-[12px] text-ink-3">
            <Star size={12} className="text-gold" /> Comparing {compareSymbols.join(", ")}. Tick boxes above to choose up to six.
          </div>
          <CompareChart symbols={compareSymbols} days={days} />
        </>
      )}
      </>
      )}
    </div>
  );
}
