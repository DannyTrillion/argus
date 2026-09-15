/**
 * Turns a pasted list like "0.5 BTC, 10 SOL" or "BTC: 1\nxrp 2,500" into holdings.
 * Pure and framework-free so it can be unit tested from the server test suite.
 */
export interface ParsedHolding { symbol: string; amount: number }
export interface ParseResult { items: ParsedHolding[]; unreadable: string[] }

const NUM = String.raw`(\d[\d,]*(?:\.\d+)?|\.\d+)`;
const SYM = String.raw`\$?([a-z][a-z0-9]{0,14})`;
const AMOUNT_FIRST = new RegExp(`^${NUM}\\s*${SYM}$`, "i");
const SYMBOL_FIRST = new RegExp(`^${SYM}\\s*[:=]?\\s*${NUM}$`, "i");

export function parseHoldings(text: string): ParseResult {
  const totals = new Map<string, number>();
  const unreadable: string[] = [];
  // Split on new lines, semicolons, and commas that are not thousands separators ("2,500").
  const parts = text.split(/[\n;]+|,(?!\d{3}(?!\d))/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    let amountText: string | undefined;
    let symbol: string | undefined;
    const a = AMOUNT_FIRST.exec(part);
    const b = a ? null : SYMBOL_FIRST.exec(part);
    if (a) { amountText = a[1]; symbol = a[2]; }
    else if (b) { symbol = b[1]; amountText = b[2]; }
    const amount = amountText ? Number(amountText.replace(/,/g, "")) : NaN;
    if (!symbol || !Number.isFinite(amount) || amount <= 0) { unreadable.push(part); continue; }
    const key = symbol.toUpperCase();
    totals.set(key, (totals.get(key) ?? 0) + amount);
  }
  return { items: [...totals].map(([symbol, amount]) => ({ symbol, amount })), unreadable };
}

export interface ResolvedHolding { id: number; symbol: string; amount: number }

/** Match symbols to coins; when a ticker is shared, the highest-ranked coin wins. */
export function resolveHoldings(items: ParsedHolding[], coins: Array<{ id: number; symbol: string; cmc_rank?: number | null }>): { matched: ResolvedHolding[]; unknown: string[] } {
  const best = new Map<string, { id: number; symbol: string; rank: number }>();
  for (const c of coins) {
    const key = c.symbol.toUpperCase();
    const rank = c.cmc_rank ?? Number.MAX_SAFE_INTEGER;
    const cur = best.get(key);
    if (!cur || rank < cur.rank) best.set(key, { id: c.id, symbol: c.symbol, rank });
  }
  const matched: ResolvedHolding[] = [];
  const unknown: string[] = [];
  for (const it of items) {
    const hit = best.get(it.symbol);
    if (hit) matched.push({ id: hit.id, symbol: hit.symbol, amount: it.amount });
    else unknown.push(it.symbol);
  }
  return { matched, unknown };
}
