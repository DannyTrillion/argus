import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { Change } from "../ui/Change";
import { Sparkline } from "../ui/Sparkline";

export function StatTile({ label, value, change, spark, foot, children }: { label: string; value: string; change?: number | null; spark?: number[]; foot?: string; children?: ReactNode }) {
  return (
    <Card className="flex min-h-[132px] flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[12px] text-ink-2">{label}</div>
          <div className="font-display mt-1 text-[26px] font-medium leading-none tracking-tight tabular">{value}</div>
        </div>
        {change !== undefined && <Change value={change} chip />}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        {spark && spark.length > 1 ? <Sparkline data={spark} width={140} height={34} /> : <span />}
        {foot && <span className="text-[11px] text-ink-3">{foot}</span>}
        {children}
      </div>
    </Card>
  );
}
