/**
 * Thin, typed HTTP layer over the CoinMarketCap Pro API.
 *
 * Responsibilities:
 *  - attach the API key header
 *  - build query strings without leaking undefined values
 *  - surface CMC's own error envelope as a typed error
 *  - keep a short in-memory cache so repeated agent tool calls do not burn credits
 *  - record every real call (endpoint, status, credits) for the "evidence" panel
 */
import { config } from "../config.js";

export interface CmcStatus {
  timestamp: string;
  error_code: number;
  error_message: string | null;
  elapsed: number;
  credit_count: number;
  notice?: string | null;
}

export interface CmcEnvelope<T> {
  status: CmcStatus;
  data: T;
}

export class CmcApiError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly errorCode: number,
    message: string,
    public readonly endpoint: string,
  ) {
    super(`CMC ${endpoint} failed (${httpStatus}/${errorCode}): ${message}`);
    this.name = "CmcApiError";
  }
}

/** One recorded API call. Kept in memory and exposed to the UI as proof of live data. */
export interface CallRecord {
  id: number;
  endpoint: string;
  query: Record<string, string>;
  httpStatus: number;
  creditCount: number;
  elapsedMs: number;
  cached: boolean;
  at: string;
  /** Truncated preview of the response body, for the evidence panel. */
  preview: string;
}

type Listener = (record: CallRecord) => void;

const listeners = new Set<Listener>();
const callLog: CallRecord[] = [];
let nextId = 1;

export function onCall(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recentCalls(limit = 50): CallRecord[] {
  return callLog.slice(-limit);
}

type Primitive = string | number | boolean | undefined | null;
export type Query = Record<string, Primitive | Primitive[]>;

function buildQuery(query: Query): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined || raw === null) continue;
    const value = Array.isArray(raw)
      ? raw.filter((v) => v !== undefined && v !== null).join(",")
      : String(raw);
    if (value === "") continue;
    out[key] = value;
  }
  return out;
}

interface CacheEntry {
  expires: number;
  body: CmcEnvelope<unknown>;
}
const cache = new Map<string, CacheEntry>();

function record(partial: Omit<CallRecord, "id" | "at">): CallRecord {
  const rec: CallRecord = { id: nextId++, at: new Date().toISOString(), ...partial };
  callLog.push(rec);
  if (callLog.length > 500) callLog.shift();
  for (const l of listeners) l(rec);
  return rec;
}

function preview(body: unknown): string {
  const text = JSON.stringify(body);
  return text.length > 600 ? text.slice(0, 600) + "…" : text;
}

/**
 * GET a CMC endpoint. `path` is the versioned path, e.g. "/v1/cryptocurrency/listings/latest".
 */
export async function cmcGet<T>(path: string, query: Query = {}): Promise<CmcEnvelope<T>> {
  const params = buildQuery(query);
  // new URL(path, base) would drop a base path like /public-api, so concatenate explicitly.
  const url = new URL(config.cmcBaseUrl.replace(/\/$/, "") + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const cacheKey = url.toString();

  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) {
    record({
      endpoint: path,
      query: params,
      httpStatus: 200,
      creditCount: 0,
      elapsedMs: 0,
      cached: true,
      preview: preview(hit.body.data),
    });
    return hit.body as CmcEnvelope<T>;
  }

  const started = performance.now();
  const headers: Record<string, string> = { Accept: "application/json", "Accept-Encoding": "deflate, gzip" };
  if (!config.keyless) headers["X-CMC_PRO_API_KEY"] = config.cmcApiKey;
  const res = await fetch(url, { headers });
  const elapsedMs = Math.round(performance.now() - started);

  let body: CmcEnvelope<T> | undefined;
  try {
    body = (await res.json()) as CmcEnvelope<T>;
  } catch {
    body = undefined;
  }

  // v1/v2 endpoints return error_code as a number, v3 endpoints as the string "0". Normalize.
  const errorCode = Number(body?.status?.error_code ?? (res.ok ? 0 : res.status));
  if (!res.ok || !body || errorCode !== 0) {
    const code = Number.isFinite(errorCode) ? errorCode : -1;
    const message = body?.status?.error_message ?? res.statusText ?? "unknown error";
    record({
      endpoint: path,
      query: params,
      httpStatus: res.status,
      creditCount: body?.status?.credit_count ?? 0,
      elapsedMs,
      cached: false,
      preview: message,
    });
    throw new CmcApiError(res.status, code, message, path);
  }

  cache.set(cacheKey, { expires: Date.now() + config.cacheTtlSeconds * 1000, body });
  record({
    endpoint: path,
    query: params,
    httpStatus: res.status,
    creditCount: body.status.credit_count,
    elapsedMs,
    cached: false,
    preview: preview(body.data),
  });
  return body;
}

/** Clear the response cache. Useful in tests and when forcing fresh data. */
export function clearCache(): void {
  cache.clear();
}
