import clsx from "clsx";
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("shimmer rounded-xl", className)} />;
}
