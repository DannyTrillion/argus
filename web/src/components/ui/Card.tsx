import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("glass p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={clsx("mb-3 flex items-center justify-between gap-3", className)}>
      <h3 className="text-[13px] font-medium tracking-wide text-ink-2">{children}</h3>
      {right}
    </div>
  );
}
