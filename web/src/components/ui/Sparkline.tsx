/** Inline SVG sparkline. No chart library needed for something this small. */
export function Sparkline({ data, width = 96, height = 28, color, strokeWidth = 1.5, fill = true }: { data: number[]; width?: number; height?: number; color?: string; strokeWidth?: number; fill?: boolean }) {
  const pts = data.filter((n) => Number.isFinite(n));
  if (pts.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const step = width / (pts.length - 1);
  const coords = pts.map((v, i) => [i * step, height - 2 - ((v - min) / span) * (height - 4)] as const);
  const d = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const c = color ?? (pts[pts.length - 1] >= pts[0] ? "#6fd39c" : "#ef6f6f");
  const id = `sp${Math.round(min * 1000)}${pts.length}${width}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      {fill && (
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={c} stopOpacity="0.28" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={c} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
