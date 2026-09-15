import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { Change } from "../ui/Change";
import { Sparkline } from "../ui/Sparkline";
import { AskButton } from "../ui/AskButton";

export function StatTile({ label, value, change, spark, foot, ask, children }: { label: ReactNode; value: string; change?: number | null; spark?: number[]; foot?: string; ask?: string; children?: ReactNode }) {
  return (
    <Card className="glass-hover flex min-h-[132px] min-w-0 flex-col justify-between p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
        <div className="min-w-0">
          {/* No truncate here: it would clip the glossary button's focus ring and underline. */}
          <div className="text-[12px] leading-snug text-ink-2">{label}</div>
          <div className="font-display mt-1 text-[22px] font-medium leading-none tracking-tight tabular sm:text-[26px]">{value}</div>
        </div>
        {change !== undefined && <div className="self-start"><Change value={change} chip /></div>}
      </div>
      <div className="mt-3 flex min-w-0 items-end justify-between gap-2">
        {spark && spark.length > 1 ? <div className="min-w-0 flex-1 max-w-[160px]"><Sparkline data={spark} width={140} height={34} fluid /></div> : <span />}
        {foot && <span className="hidden text-[11px] text-ink-3 sm:inline">{foot}</span>}
        {children}
        {ask && <AskButton q={ask} className="-mb-1 -mr-1.5" />}
      </div>
    </Card>
  );
}
