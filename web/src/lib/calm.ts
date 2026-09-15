/**
 * Calm mode: carousels stop sliding on their own. An explicit choice wins; otherwise
 * Argus follows the operating system's "reduce motion" setting.
 */
import { useEffect, useState } from "react";

const KEY = "argus.calm";
const EVENT = "argus:calm";
const QUERY = "(prefers-reduced-motion: reduce)";

function systemReduced(): boolean {
  try { return window.matchMedia(QUERY).matches; } catch { return false; }
}

/** true or false when the person chose; null when following the system. */
export function getCalmSetting(): boolean | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
}

export function setCalm(on: boolean | null): void {
  try {
    if (on === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, on ? "1" : "0");
  } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useCalm(): boolean {
  const read = () => getCalmSetting() ?? systemReduced();
  const [calm, setState] = useState(read);
  useEffect(() => {
    const update = () => setState(read());
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    let mq: MediaQueryList | null = null;
    try { mq = window.matchMedia(QUERY); mq.addEventListener("change", update); } catch { /* old browsers */ }
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
      mq?.removeEventListener("change", update);
    };
  }, []);
  return calm;
}
