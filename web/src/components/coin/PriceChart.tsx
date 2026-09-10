import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api, type Range } from "../../lib/api";
import { useEChart, palette, tooltipStyle, axisStyle } from "../../lib/chart";
import { usd } from "../../lib/format";
import { Card, CardTitle } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

const RANGES: Range[] = ["24h", "7d", "30d", "90d", "1y"];

export function PriceChart({ id, symbol }: { id: number; symbol: string }) {
  const [range, setRange] = useState<Range>("30d");
  const [mode, setMode] = useState<"area" | "candles">("area");
  const { data, isLoading } = useQuery({ queryKey: ["hist", id, range], queryFn: () => api.coinHistory(id, range) });
  const hasOhlc = data?.source === "ohlcv";

  const option = useMemo(() => {
    if (!data) return null;
    const c = data.candles;
    const labels = c.map((k) => (range === "24h" ? k.time_close.slice(11, 16) : k.time_close.slice(5, 10)));
    const up = (c[c.length - 1]?.close ?? 0) >= (c[0]?.close ?? 0);
    const color = up ? palette.up : palette.down;
    const base = {
      animationDuration: 500,
      grid: [{ left: 8, right: 8, top: 16, bottom: 90, containLabel: true }, { left: 8, right: 8, height: 50, bottom: 28, containLabel: true }],
      tooltip: { ...tooltipStyle, trigger: "axis", axisPointer: { type: "cross", lineStyle: { color: "rgba(255,255,255,0.2)" }, label: { backgroundColor: "#1c1c20", fontFamily: "JetBrains Mono, monospace" } } },
      xAxis: [
        { type: "category", data: labels, boundaryGap: mode === "candles", ...axisStyle, splitLine: { show: false } },
        { type: "category", gridIndex: 1, data: labels, boundaryGap: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false }, splitLine: { show: false } },
      ],
      yAxis: [
        { type: "value", scale: true, ...axisStyle, axisLabel: { ...axisStyle.axisLabel, formatter: (v: number) => usd(v, { compact: v >= 1e5 }) } },
        { type: "value", gridIndex: 1, scale: false, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false }, splitLine: { show: false } },
      ],
      dataZoom: [{ type: "inside", xAxisIndex: [0, 1] }],
      series: [
        mode === "candles" && hasOhlc
          ? {
              name: symbol,
              type: "candlestick",
              data: c.map((k) => [k.open, k.close, k.low, k.high]),
              itemStyle: { color: palette.up, color0: palette.down, borderColor: palette.up, borderColor0: palette.down },
            }
          : {
              name: symbol,
              type: "line",
              smooth: 0.2,
              showSymbol: false,
              data: c.map((k) => k.close),
              lineStyle: { color, width: 2 },
              areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: up ? "rgba(111,211,156,0.3)" : "rgba(239,111,111,0.3)" }, { offset: 1, color: "rgba(0,0,0,0)" }] } },
            },
        {
          name: "Volume",
          type: "bar",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: c.map((k, i) => ({ value: k.volume, itemStyle: { color: (c[i].close ?? 0) >= (c[i - 1]?.close ?? c[i].close) ? "rgba(111,211,156,0.35)" : "rgba(239,111,111,0.35)" } })),
          barMaxWidth: 12,
        },
      ],
    };
    return base;
  }, [data, mode, range, symbol, hasOhlc]);

  const ref = useEChart(option);

  return (
    <Card>
      <CardTitle
        right={
          <div className="flex items-center gap-2">
            {hasOhlc && (
              <div className="glass-2 pill flex p-0.5">
                {(["area", "candles"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)} className={clsx("pill px-2.5 py-1 text-[11px]", mode === m ? "bg-ink text-bg" : "text-ink-2")}>{m}</button>
                ))}
              </div>
            )}
            <div className="glass-2 pill flex p-0.5">
              {RANGES.map((r) => (
                <button key={r} onClick={() => setRange(r)} className={clsx("pill px-2.5 py-1 font-mono text-[11px] uppercase", range === r ? "bg-ink text-bg" : "text-ink-2 hover:text-ink")}>{r}</button>
              ))}
            </div>
          </div>
        }
      >
        Price {data?.source === "quotes_historical" && <span className="ml-2 text-[11px] normal-case text-ink-3">· daily closes (candles need a higher CMC plan)</span>}
      </CardTitle>
      {isLoading ? <Skeleton className="h-[380px]" /> : <div ref={ref} className="h-[380px] w-full" />}
    </Card>
  );
}
