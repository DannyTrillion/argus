import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { Change } from "../ui/Change";
import { Sparkline } from "../ui/Sparkline";

export function StatTile({ label, value, change, spark, foot, children }: { label: string; value: string; change?: number | null; spark?: number[]; foot?: string; children?: ReactNode }) {
  return (
    <Card className="flex min-h-[132px] min-w-0 flex-col justify-between p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
        <div className="min-w-0">
          <div className="truncate text-[12px] text-ink-2">{label}</div>
          <div className="font-display mt-1 text-[22px] font-medium leading-none tracking-tight tabular sm:text-[26px]">{value}</div>
        </div>
        {change !== undefined && <div className="self-start"><Change value={change} chip /></div>}
      </div>
      <div className="mt-3 flex min-w-0 items-end justify-between gap-3">
        {spark && spark.length > 1 ? <div className="min-w-0 flex-1 max-w-[160px]"><Sparkline data={spark} width={140} height={34} fluid /></div> : <span />}
        {foot && <span className="text-[11px] text-ink-3">{foot}</span>}
        {children}
      </div>
    </Card>
  );
}
