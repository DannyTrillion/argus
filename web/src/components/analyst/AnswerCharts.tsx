/**
 * Renders charts for structured tool results attached to an analyst answer.
 * Each chartable tool has a small renderer; unknown shapes are ignored.
 */
import { useMemo } from "react";
import type { ReactNode } from "react";
import type { Step } from "../../lib/chat";
import { useEChart, palette, tooltipStyle, axisStyle } from "../../lib/chart";
import { usd, pct } from "../../lib/format";

interface SeriesStat { symbol: string; total_return_pct: number; annualized_volatility_pct: number; max_drawdown_pct: number; correlation_with_first: number | null; days: number }
interface GlobalPoint { timestamp: string; btc_dominance: number; total_market_cap: number }
interface FearGreed { latest: { value: number; value_classification: string }; history?: Array<{ value: number; timestamp?: string }> }
interface Liq { total: { long_liquidations_1h: number; short_liquidations_1h: number; long_liquidations_4h: number; short_liquidations_4h: number; long_liquidations_24h: number; short_liquidations_24h: number } }
interface Ohlcv { symbol: string; candles: Array<{ time_close: string; close: number; volume: number }>; source?: string }
interface Explain { symbol: string; window: string; coin_change_pct: number; btc_change_pct: number; beta_to_btc: number | null; market_component_pct: number | null; sector: { name: string; excess_pct: number } | null; coin_specific_pct: number | null; read: string }

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="glass-2 rounded-2xl p-3">
      <div className="mb-1 text-[11px] uppercase tracking-wider text-ink-3">{title}</div>
      {children}
    </div>
  );
}

function RiskBars({ stats }: { stats: SeriesStat[] }) {
  const option = useMemo(() => ({
    grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
    tooltip: { ...tooltipStyle, trigger: "axis", valueFormatter: (v: number) => `${v.toFixed(1)}%` },
    legend: { top: 0, left: 0, textStyle: { color: palette.ink2, fontSize: 11 }, icon: "roundRect", itemWidth: 10, itemHeight: 10 },
    xAxis: { type: "category", data: stats.map((s) => s.symbol), ...axisStyle, splitLine: { show: false } },
    yAxis: { type: "value", ...axisStyle, axisLabel: { ...axisStyle.axisLabel, formatter: (v: number) => `${v}%` } },
    series: [
      { name: `Return ${stats[0]?.days ?? ""}d`, type: "bar", data: stats.map((s) => s.total_return_pct), itemStyle: { color: palette.gold, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 26 },
      { name: "Ann. volatility", type: "bar", data: stats.map((s) => s.annualized_volatility_pct), itemStyle: { color: "#8fb7ff", borderRadius: [4, 4, 0, 0] }, barMaxWidth: 26 },
      { name: "Max drawdown", type: "bar", data: stats.map((s) => s.max_drawdown_pct), itemStyle: { color: palette.down, borderRadius: [0, 0, 4, 4] }, barMaxWidth: 26 },
    ],
  }), [stats]);
  const ref = useEChart(option);
  return (
    <Frame title="Return, volatility and drawdown">
      <div ref={ref} className="h-[220px] w-full" />
      <div className="mt-1 flex flex-wrap gap-1.5">
        {stats.map((s) => (
          <span key={s.symbol} className="pill bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-2">
            {s.symbol} · corr {s.correlation_with_first === null ? "—" : s.correlation_with_first.toFixed(2)}
          </span>
        ))}
      </div>
    </Frame>
  );
}

function GlobalLine({ points }: { points: GlobalPoint[] }) {
  const option = useMemo(() => ({
    grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
    tooltip: { ...tooltipStyle, trigger: "axis" },
    legend: { top: 0, left: 0, textStyle: { color: palette.ink2, fontSize: 11 }, icon: "roundRect", itemWidth: 10, itemHeight: 10 },
    xAxis: { type: "category", data: points.map((p) => p.timestamp.slice(5, 10)), boundaryGap: false, ...axisStyle, splitLine: { show: false } },
    yAxis: [
      { type: "value", scale: true, ...axisStyle, axisLabel: { ...axisStyle.axisLabel, formatter: (v: number) => usd(v, { compact: true }) } },
      { type: "value", scale: true, ...axisStyle, splitLine: { show: false }, axisLabel: { ...axisStyle.axisLabel, formatter: (v: number) => `${v.toFixed(1)}%` } },
    ],
    series: [
      { name: "Total cap", type: "line", smooth: 0.2, showSymbol: false, data: points.map((p) => p.total_market_cap), lineStyle: { color: palette.gold, width: 2 }, itemStyle: { color: palette.gold }, areaStyle: { color: "rgba(231,196,106,0.12)" } },
      { name: "BTC dominance", type: "line", yAxisIndex: 1, smooth: 0.2, showSymbol: false, data: points.map((p) => p.btc_dominance), lineStyle: { color: "#8fb7ff", width: 1.5, type: "dashed" }, itemStyle: { color: "#8fb7ff" } },
    ],
  }), [points]);
  const ref = useEChart(option);
  return <Frame title="Total market cap and BTC dominance"><div ref={ref} className="h-[220px] w-full" /></Frame>;
}

function FearLine({ fg }: { fg: FearGreed }) {
  const hist = useMemo(() => [...(fg.history ?? [])].reverse(), [fg.history]);
  const option = useMemo(() => ({
    grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
    tooltip: { ...tooltipStyle, trigger: "axis" },
    xAxis: { type: "category", data: hist.map((h) => (h.timestamp ?? "").slice(5, 10)), boundaryGap: false, ...axisStyle, splitLine: { show: false } },
    yAxis: { type: "value", min: 0, max: 100, ...axisStyle },
    series: [{ name: "Fear & Greed", type: "line", smooth: 0.3, showSymbol: false, data: hist.map((h) => h.value), lineStyle: { color: palette.gold, width: 2 }, areaStyle: { color: "rgba(231,196,106,0.12)" }, markLine: { silent: true, symbol: "none", lineStyle: { color: "rgba(255,255,255,0.15)", type: "dashed" }, data: [{ yAxis: 25 }, { yAxis: 75 }] } }],
  }), [hist]);
  const ref = useEChart(hist.length < 2 ? null : option);
  if (hist.length < 2) return null;
  return <Frame title={`Fear & Greed · now ${fg.latest.value} (${fg.latest.value_classification})`}><div ref={ref} className="h-[180px] w-full" /></Frame>;
}

function LiqBars({ liq }: { liq: Liq }) {
  const t = liq.total;
  const option = useMemo(() => {
    const rows = [["1h", t.long_liquidations_1h, t.short_liquidations_1h], ["4h", t.long_liquidations_4h, t.short_liquidations_4h], ["24h", t.long_liquidations_24h, t.short_liquidations_24h]] as const;
    return {
      grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
      tooltip: { ...tooltipStyle, trigger: "axis", valueFormatter: (v: number) => usd(v, { compact: true }) },
      legend: { top: 0, left: 0, textStyle: { color: palette.ink2, fontSize: 11 }, icon: "roundRect", itemWidth: 10, itemHeight: 10 },
      xAxis: { type: "value", splitNumber: 3, ...axisStyle, axisLabel: { ...axisStyle.axisLabel, formatter: (v: number) => usd(v, { compact: true }) } },
      yAxis: { type: "category", data: rows.map((r) => r[0]), ...axisStyle, splitLine: { show: false } },
      series: [
        { name: "Longs liquidated", type: "bar", stack: "a", data: rows.map((r) => r[1]), itemStyle: { color: palette.down }, barMaxWidth: 18 },
        { name: "Shorts liquidated", type: "bar", stack: "a", data: rows.map((r) => r[2]), itemStyle: { color: palette.up, borderRadius: [0, 4, 4, 0] }, barMaxWidth: 18 },
      ],
    };
  }, [t]);
  const ref = useEChart(option);
  return <Frame title="Liquidations by window"><div ref={ref} className="h-[170px] w-full" /></Frame>;
}

function PriceLine({ s }: { s: Ohlcv }) {
  const option = useMemo(() => {
    const up = (s.candles[s.candles.length - 1]?.close ?? 0) >= (s.candles[0]?.close ?? 0);
    return {
      grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
      tooltip: { ...tooltipStyle, trigger: "axis", valueFormatter: (v: number) => usd(v) },
      xAxis: { type: "category", data: s.candles.map((c) => c.time_close.slice(5, 10)), boundaryGap: false, ...axisStyle, splitLine: { show: false } },
      yAxis: { type: "value", scale: true, ...axisStyle, axisLabel: { ...axisStyle.axisLabel, formatter: (v: number) => usd(v, { compact: v >= 1e5 }) } },
      series: [{ name: s.symbol, type: "line", smooth: 0.2, showSymbol: false, data: s.candles.map((c) => c.close), lineStyle: { color: up ? palette.up : palette.down, width: 2 }, areaStyle: { color: up ? "rgba(111,211,156,0.15)" : "rgba(239,111,111,0.15)" } }],
    };
  }, [s]);
  const ref = useEChart(option);
  const first = s.candles[0]?.close;
  const last = s.candles[s.candles.length - 1]?.close;
  return <Frame title={`${s.symbol} · ${s.candles.length} periods · ${first && last ? pct((last / first - 1) * 100) : ""}`}><div ref={ref} className="h-[180px] w-full" /></Frame>;
}

function Attribution({ e }: { e: Explain }) {
  const parts = [
    { label: "Market beta", value: e.market_component_pct ?? 0, color: "#8fb7ff" },
    { label: e.sector ? `${e.sector.name} sector` : "Sector", value: e.sector?.excess_pct ?? 0, color: "#c99cff" },
    { label: "Coin-specific", value: e.coin_specific_pct ?? 0, color: palette.gold },
  ];
  const scale = Math.max(1, ...parts.map((p) => Math.abs(p.value)), Math.abs(e.coin_change_pct));
  return (
    <Frame title={`${e.symbol} ${pct(e.coin_change_pct, 2)} over ${e.window} · ${e.read}`}>
      <div className="space-y-2.5 py-1">
        {parts.map((p) => (
          <div key={p.label}>
            <div className="mb-1 flex items-center justify-between text-[11.5px]"><span className="text-ink-2">{p.label}</span><span className="font-mono" style={{ color: p.color }}>{pct(p.value, 2)}</span></div>
            <div className="relative h-2 w-full rounded-full bg-surface-2">
              <div className="absolute inset-y-0 left-1/2 w-px bg-line-2" />
              <div className="absolute inset-y-0 rounded-full" style={{ background: p.color, width: `${(Math.abs(p.value) / scale) * 50}%`, left: p.value >= 0 ? "50%" : undefined, right: p.value < 0 ? "50%" : undefined }} />
            </div>
          </div>
        ))}
        <div className="font-mono text-[10.5px] text-ink-3">BTC {pct(e.btc_change_pct, 2)} · beta {e.beta_to_btc ?? "—"}</div>
      </div>
    </Frame>
  );
}

export function AnswerCharts({ steps }: { steps: Step[] }) {
  const items: ReactNode[] = [];
  steps.forEach((s, i) => {
    if (!s.ok || !s.data) return;
    const d = s.data as unknown;
    if (s.name === "analyze_series" && Array.isArray(d) && d.length > 0 && "annualized_volatility_pct" in (d[0] as object)) items.push(<RiskBars key={i} stats={d as SeriesStat[]} />);
    else if (s.name === "get_global_metrics_history" && Array.isArray(d) && d.length > 2) items.push(<GlobalLine key={i} points={d as GlobalPoint[]} />);
    else if (s.name === "get_fear_greed" && d && typeof d === "object" && "latest" in d) items.push(<FearLine key={i} fg={d as FearGreed} />);
    else if (s.name === "get_liquidations" && d && typeof d === "object" && "total" in d) items.push(<LiqBars key={i} liq={d as Liq} />);
    else if (s.name === "get_ohlcv" && d && typeof d === "object" && "candles" in d && (d as Ohlcv).candles.length > 2) items.push(<PriceLine key={i} s={d as Ohlcv} />);
    else if (s.name === "explain_move" && d && typeof d === "object" && "coin_change_pct" in d) items.push(<Attribution key={i} e={d as Explain} />);
  });
  if (items.length === 0) return null;
  return <div className="mt-4 grid gap-3 md:grid-cols-2">{items}</div>;
}
