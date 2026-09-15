/**
 * Owner-only controls. When ARGUS_ADMIN_TOKEN is set, switches that change what the
 * deployment spends (pausing automation, forcing a brief) need it in `x-admin-token`.
 * With no token configured, as in local development, everything is allowed.
 */
import { timingSafeEqual } from "node:crypto";

export const ADMIN_HEADER = "x-admin-token";

export function adminToken(): string | null {
  const t = process.env.ARGUS_ADMIN_TOKEN?.trim();
  return t ? t : null;
}

export function adminAllowed(header: string | undefined, token: string | null = adminToken()): boolean {
  if (!token) return true;
  if (!header) return false;
  const a = Buffer.from(header.trim());
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
