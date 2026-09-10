import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { api } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import { Card, CardTitle } from "../ui/Card";
import { Markdown } from "../ui/Markdown";
import { Skeleton } from "../ui/Skeleton";
import { CopyButton } from "../ui/CopyButton";

export function BriefCard() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["brief"], queryFn: api.brief, staleTime: 10 * 60_000, refetchInterval: 10 * 60_000, retry: 2 });
  const [open, setOpen] = useState(false);

  return (
    <Card className="lg:col-span-3">
      <CardTitle
        right={
          data ? (
            <span className="font-mono text-[11px] text-ink-3">
              written {timeAgo(data.generatedAt)} · {data.calls} API calls · {data.credits} credits
            </span>
          ) : null
        }
      >
        <span className="inline-flex items-center gap-1.5"><Sparkles size={13} className="text-gold" /> Today's brief, written by Argus</span>
      </CardTitle>
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" />
          <div className="pt-1 text-[12px] text-ink-3">Argus is reading the market for the first brief. This takes about a minute.</div>
        </div>
      )}
      {isError && <div className="text-[12.5px] text-ink-3">The brief is not available right now.</div>}
      {data && (
        <div className="relative">
          <div className={clsx("overflow-hidden transition-[max-height] duration-500", open ? "max-h-[4000px]" : "max-h-[190px]")}>
            <Markdown text={data.text} className="columns-1 lg:columns-2 lg:gap-10" />
          </div>
          {!open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#101012] to-transparent" />}
          <div className="relative mt-2 flex items-center justify-between">
            <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-[12px] text-gold hover:text-gold-2">
              <ChevronDown size={13} className={clsx("transition-transform", open && "rotate-180")} /> {open ? "Show less" : "Read the full brief"}
            </button>
            <CopyButton text={`# Argus market brief · ${new Date(data.generatedAt).toUTCString()}\n\n${data.text}`} label="Copy brief" />
          </div>
        </div>
      )}
    </Card>
  );
}
