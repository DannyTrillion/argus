import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { Change } from "../ui/Change";
import { Sparkline } from "../ui/Sparkline";

export function StatTile({ label, value, change, spark, foot, children }: { label: string; value: string; change?: number | null; spark?: number[]; foot?: string; children?: ReactNode }) {
  return (
    <Card className="flex min-h-[132px] min-w-0 flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[12px] text-ink-2">{label}</div>
          <div className="font-display mt-1 text-[26px] font-medium leading-none tracking-tight tabular">{value}</div>
        </div>
        {change !== undefined && <Change value={change} chip />}
      </div>
      <div className="mt-3 flex min-w-0 items-end justify-between gap-3">
        {spark && spark.length > 1 ? <div className="min-w-0 flex-1 max-w-[160px]"><Sparkline data={spark} width={140} height={34} fluid /></div> : <span />}
        {foot && <span className="text-[11px] text-ink-3">{foot}</span>}
        {children}
      </div>
    </Card>
  );
}
