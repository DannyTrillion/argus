/** Semi-circular gauge for 0-100 indices (Fear & Greed, Altcoin Season). */
export function Gauge({ value, label, size = 120, color = "#e7c46a" }: { value: number; label: string; size?: number; color?: string }) {
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const start = Math.PI;
  const end = 0;
  const v = Math.max(0, Math.min(100, value)) / 100;
  const arc = (from: number, to: number) => {
    const x1 = cx + r * Math.cos(from);
    const y1 = cy - r * Math.sin(from);
    const x2 = cx + r * Math.cos(to);
    const y2 = cy - r * Math.sin(to);
    const large = Math.abs(from - to) > Math.PI ? 1 : 0;
    return `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2}`;
  };
  const angle = start - (start - end) * v;
  return (
    <svg width={size} height={size / 2 + 26} viewBox={`0 0 ${size} ${size / 2 + 26}`}>
      <path d={arc(start, end)} stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d={arc(start, angle)} stroke={color} strokeWidth="8" fill="none" strokeLinecap="round" />
      <text x={cx} y={cy - 2} textAnchor="middle" fill="#f2f0ea" fontFamily="Outfit, sans-serif" fontSize="26" fontWeight="500">{Math.round(value)}</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fill="#b7b3a9" fontFamily="Inter, sans-serif" fontSize="11">{label}</text>
    </svg>
  );
}
