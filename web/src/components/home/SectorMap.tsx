import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useEChart, tooltipStyle } from "../../lib/chart";
import { usd, pct } from "../../lib/format";
import { Card, CardTitle } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

function heat(change: number): string {
  const c = Math.max(-12, Math.min(12, change)) / 12;
  if (c >= 0) return `rgba(111,211,156,${0.12 + c * 0.55})`;
  return `rgba(239,111,111,${0.12 + -c * 0.55})`;
}

export function SectorMap() {
  const { data, isLoading } = useQuery({ queryKey: ["sectors"], queryFn: api.sectors });

  const option = useMemo(() => {
    if (!data) return null;
    return {
      tooltip: {
        ...tooltipStyle,
        formatter: (p: { name: string; data: { cap: number; change: number; tokens?: number; volumeChange?: number } }) =>
          `<b>${p.name}</b><br/>Market cap ${usd(p.data.cap, { compact: true })}<br/>24h ${pct(p.data.change)} · Volume ${pct(p.data.volumeChange)}<br/><span style="color:#77746c">${p.data.tokens ?? "?"} tokens</span>`,
      },
      series: [
        {
          type: "treemap",
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          width: "100%",
          height: "100%",
          top: 0, left: 0, right: 0, bottom: 0,
          itemStyle: { borderColor: "#0a0a0b", borderWidth: 2, gapWidth: 2, borderRadius: 8 },
          label: {
            show: true,
            color: "#f2f0ea",
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            formatter: (p: { name: string; data: { change: number } }) => `{n|${p.name}}\n{c|${pct(p.data.change, 1)}}`,
            rich: { n: { fontSize: 12, lineHeight: 16, color: "#f2f0ea" }, c: { fontSize: 11, lineHeight: 14, color: "#b7b3a9", fontFamily: "JetBrains Mono, monospace" } },
          },
          upperLabel: { show: false },
          // Area scales with sqrt(market cap) so Layer 1 does not swallow the map.
          data: data.map((s) => ({
            name: s.name,
            value: Math.sqrt(s.market_cap ?? 0),
            cap: s.market_cap ?? 0,
            change: s.market_cap_change ?? 0,
            volumeChange: s.volume_change ?? 0,
            tokens: s.num_tokens,
            itemStyle: { color: heat(s.market_cap_change ?? 0) },
          })),
        },
      ],
    };
  }, [data]);

  const ref = useEChart(option);

  return (
    <Card className="h-full">
      <CardTitle right={<span className="text-[11px] text-ink-3">size ∝ market cap · colour = 24h change</span>}>Sector map</CardTitle>
      {isLoading ? <Skeleton className="h-[320px]" /> : <div ref={ref} className="h-[320px] w-full" />}
    </Card>
  );
}
