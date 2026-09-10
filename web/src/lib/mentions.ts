import type { Coin } from "./api";

/** Expand "@SOL" into an unambiguous asset reference the model can act on. */
export function expandMentions(text: string, coins: Coin[] | undefined): string {
  if (!coins) return text;
  return text.replace(/@([A-Za-z0-9.]{1,12})/g, (m, sym: string) => {
    const c = coins.find((x) => x.symbol.toLowerCase() === sym.toLowerCase());
    return c ? `${c.symbol} (CoinMarketCap id ${c.id})` : m;
  });
}

/** Undo the expansion for display. */
export function stripMentions(text: string): string {
  return text.replace(/\s\(CoinMarketCap id \d+\)/g, "");
}
