/**
 * Thin ECharts wrapper: one hook that owns the instance, resizes with its
 * container, and re-applies options when they change. Tree-shaken imports keep
 * the bundle to the chart types Argus uses.
 */
import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { LineChart, BarChart, CandlestickChart, TreemapChart, HeatmapChart } from "echarts/charts";
import { GridComponent, TooltipComponent, DataZoomComponent, VisualMapComponent, MarkLineComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([LineChart, BarChart, CandlestickChart, TreemapChart, HeatmapChart, GridComponent, TooltipComponent, DataZoomComponent, VisualMapComponent, MarkLineComponent, LegendComponent, CanvasRenderer]);

export const palette = {
  gold: "#e7c46a",
  gold2: "#f3d68b",
  up: "#6fd39c",
  down: "#ef6f6f",
  ink: "#f2f0ea",
  ink2: "#b7b3a9",
  ink3: "#77746c",
  line: "rgba(255,255,255,0.08)",
  series: ["#e7c46a", "#8fb7ff", "#6fd39c", "#ef6f6f", "#c99cff", "#7fd6d6", "#f0a35e", "#b7b3a9"],
};

export const tooltipStyle = {
  backgroundColor: "rgba(16,16,18,0.92)",
  borderColor: "rgba(255,255,255,0.12)",
  borderWidth: 1,
  padding: [8, 12],
  textStyle: { color: "#f2f0ea", fontFamily: "JetBrains Mono, monospace", fontSize: 12 },
  extraCssText: "border-radius: 12px; backdrop-filter: blur(12px); box-shadow: 0 10px 30px rgba(0,0,0,.5);",
} as const;

export const axisStyle = {
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: palette.ink3, fontFamily: "JetBrains Mono, monospace", fontSize: 11 },
  splitLine: { lineStyle: { color: palette.line } },
} as const;

export function useEChart(option: EChartsCoreOption | null) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  // Callback ref: the chart container often mounts after a loading skeleton, so we
  // must initialize whenever the element appears, not only on first render.
  useEffect(() => {
    if (!el) return;
    const instance = echarts.init(el, undefined, { renderer: "canvas" });
    chart.current = instance;
    if (option) instance.setOption(option, { notMerge: true });
    const ro = new ResizeObserver(() => instance.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      instance.dispose();
      chart.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el]);

  useEffect(() => {
    if (option && chart.current) chart.current.setOption(option, { notMerge: true });
  }, [option]);

  return setEl;
}
