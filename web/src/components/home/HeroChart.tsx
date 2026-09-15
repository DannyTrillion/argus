import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "../../lib/api";
import { useEChart, palette, tooltipStyle, axisStyle } from "../../lib/chart";
import { usd } from "../../lib/format";
import { Card, CardTitle } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { ExplainButton } from "../ui/Explain";

const RANGES = [30, 90, 365] as const;

export function HeroChart() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(90);
  const { data, isLoading } = useQuery({ queryKey: ["history", days], queryFn: () => api.history(days) });

  const option = useMemo(() => {
    if (!data) return null;
    const pts = data.global;
    return {
      animationDuration: 600,
      grid: { left: 8, right: 8, top: 24, bottom: 28, containLabel: true },
      tooltip: {
        ...tooltipStyle,
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: "rgba(255,255,255,0.2)" } },
        formatter: (params: Array<{ axisValue: string; seriesName: string; data: number; color: string }>) =>
          `<div style="color:#b7b3a9;margin-bottom:4px">${params[0].axisValue}</div>` +
          params.map((p) => `<div><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin-right:6px"></span>${p.seriesName}: <b>${p.seriesName.includes("dominance") ? p.data.toFixed(2) + "%" : usd(p.data)}</b></div>`).join(""),
      },
      legend: { top: 0, right: 0, textStyle: { color: palette.ink2, fontSize: 11 }, itemWidth: 10, itemHeight: 10, icon: "roundRect" },
      xAxis: { type: "category", boundaryGap: false, data: pts.map((p) => p.timestamp.slice(0, 10)), ...axisStyle, splitLine: { show: false }, axisLabel: { ...axisStyle.axisLabel, formatter: (v: string) => v.slice(5) } },
      yAxis: [
        { type: "value", scale: true, ...axisStyle, axisLabel: { ...axisStyle.axisLabel, formatter: (v: number) => usd(v, { compact: true }) } },
        { type: "value", scale: true, ...axisStyle, splitLine: { show: false }, axisLabel: { ...axisStyle.axisLabel, formatter: (v: number) => `${v.toFixed(1)}%` } },
      ],
      series: [
        {
          name: "Total market cap",
          type: "line",
          smooth: 0.25,
          showSymbol: false,
          data: pts.map((p) => p.total_market_cap),
          lineStyle: { color: palette.gold, width: 2 },
          itemStyle: { color: palette.gold },
          areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(231,196,106,0.35)" }, { offset: 1, color: "rgba(231,196,106,0)" }] } },
        },
        {
          name: "BTC dominance",
          type: "line",
          yAxisIndex: 1,
          smooth: 0.25,
          showSymbol: false,
          data: pts.map((p) => p.btc_dominance),
          lineStyle: { color: "#8fb7ff", width: 1.5, type: "dashed" },
          itemStyle: { color: "#8fb7ff" },
        },
      ],
    };
  }, [data]);

  const ref = useEChart(option);
  // Live reading for the explainer, from the same series the chart draws.
  const pts = data?.global ?? [];
  const chartLive = pts.length > 1
    ? { extra: { days, capChangePct: (pts[pts.length - 1].total_market_cap / pts[0].total_market_cap - 1) * 100, domChangePts: pts[pts.length - 1].btc_dominance - pts[0].btc_dominance } }
    : undefined;

  return (
    <Card className="hud h-full">
      <CardTitle
        right={
          <div className="flex items-center gap-2">
          <ExplainButton topic="chart" live={chartLive} />
          <div className="glass-2 pill flex p-0.5">
            {RANGES.map((r) => (
              <button key={r} onClick={() => setDays(r)} className={clsx("pill px-3 py-1 font-mono text-[11px]", days === r ? "bg-ink text-bg" : "text-ink-2 hover:text-ink")}>
                {r === 365 ? "1Y" : `${r}D`}
              </button>
            ))}
          </div>
          </div>
        }
      >
        Total market cap and BTC dominance
      </CardTitle>
      {isLoading ? <Skeleton className="h-[300px]" /> : <div ref={ref} className="h-[300px] w-full" />}
    </Card>
  );
}
