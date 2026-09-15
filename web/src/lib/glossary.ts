/** Plain-language definitions behind every dotted-underlined term. One or two sentences each. */
export const GLOSSARY = {
  "market-cap": { term: "Market cap", text: "Price times coins in circulation, added up across every coin. It is the size of the whole crypto market." },
  volume: { term: "24h volume", text: "The dollar value traded in the last 24 hours. Rising volume means more people are acting on a move." },
  dominance: { term: "BTC dominance", text: "Bitcoin's share of the total market cap. When it falls while the market rises, money is usually moving into altcoins." },
  "fear-greed": { term: "Fear & Greed", text: "A 0 to 100 mood score built from momentum, volatility and demand. Under 40 is fearful, over 60 is greedy." },
  "altcoin-index": { term: "Altcoin Season Index", text: "How many of the top 100 coins beat Bitcoin over 90 days, as a 0 to 100 score. 75 or more is altcoin season." },
  liquidations: { term: "Liquidations", text: "Leveraged bets closed by force when the price moves against them. A wave of long liquidations can deepen a drop." },
  beta: { term: "Market beta", text: "The part of a move that comes from Bitcoin. A coin with beta 1.5 tends to move 1.5% for every 1% Bitcoin moves." },
  sector: { term: "Sector effect", text: "What the coin's category did beyond the whole market, like memes or DeFi rallying together." },
  "coin-specific": { term: "Coin-specific", text: "What is left once the market and the sector are taken out: news, listings or flows about this coin alone." },
  "market beta": { term: "Market beta", text: "The part of a move that comes from Bitcoin. A coin with beta 1.5 tends to move 1.5% for every 1% Bitcoin moves." },
  "sector rotation": { term: "Sector rotation", text: "Money moving from one category of coins to another, so one sector rises while others lag." },
  mixed: { term: "Mixed", text: "No single cause dominates: the market, the sector and the coin's own news all played a part." },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;

export function isGlossaryKey(k: string): k is GlossaryKey {
  return k in GLOSSARY;
}
