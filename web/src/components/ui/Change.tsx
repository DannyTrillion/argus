import clsx from "clsx";
import { pct } from "../../lib/format";

export function Change({ value, className, digits = 2, chip = false }: { value: number | null | undefined; className?: string; digits?: number; chip?: boolean }) {
  const v = value ?? 0;
  const dir = value === null || value === undefined ? "flat" : v > 0 ? "up" : v < 0 ? "down" : "flat";
  return (
    <span
      className={clsx(
        "font-mono tabular",
        chip && "pill px-2 py-0.5 text-[12px]",
        dir === "up" && (chip ? "bg-up-dim text-up" : "text-up"),
        dir === "down" && (chip ? "bg-down-dim text-down" : "text-down"),
        dir === "flat" && (chip ? "bg-surface-2 text-ink-2" : "text-ink-2"),
        className,
      )}
    >
      {pct(value, digits)}
    </span>
  );
}
