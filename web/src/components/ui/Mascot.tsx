import clsx from "clsx";

/**
 * Argus, the owl. `glow` adds the golden halo; `thinking` pulses it, used while the
 * analyst is reading the market.
 */
export function Mascot({ size = 96, glow = true, thinking = false, className }: { size?: number; glow?: boolean; thinking?: boolean; className?: string }) {
  const src = size > 200 ? "/mascot-512.png" : "/mascot-160.png";
  return (
    <div className={clsx("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {glow && (
        <div
          className={clsx("absolute inset-0 rounded-full", thinking && "animate-pulse")}
          style={{ background: "radial-gradient(circle at 50% 42%, rgba(231,196,106,0.45), rgba(231,196,106,0.08) 45%, transparent 70%)", filter: "blur(6px)" }}
        />
      )}
      <img src={src} alt="Argus the owl" width={size} height={size} className="relative select-none" draggable={false} />
    </div>
  );
}
