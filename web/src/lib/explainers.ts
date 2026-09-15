/**
 * Stored explainers behind every Explain button. Instant and free: no network, no model.
 * Each topic says what the number is, how to read it, what moves it, and turns the live
 * value already on screen into one plain sentence with simple, published thresholds.
 * Pure and framework-free so the reading rules are unit tested.
 */
export type ExplainTopic = "market-cap" | "volume" | "dominance" | "fear-greed" | "altcoin-index" | "chart" | "movers" | "liquidations";

export interface Live {
  value?: number | null;
  change?: number | null;
  extra?: Record<string, number | string | null | undefined>;
}

export type Tone = "down" | "gold" | "up" | "blue";
export interface Zone { from: number; to: number; label: string; tone: Tone }

export interface Explainer {
  title: string;
  what: string;
  howToRead: string[];
  moves: string[];
  scale?: { min: number; max: number; zones: Zone[] };
  read: (live: Live) => string | null;
}

const has = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n);

export function compactUsd(n: number): string {
  const a = Math.abs(n);
  const f = (v: number, s: string) => `$${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)}${s}`;
  if (a >= 1e12) return f(n / 1e12, "T");
  if (a >= 1e9) return f(n / 1e9, "B");
  if (a >= 1e6) return f(n / 1e6, "M");
  if (a >= 1e3) return f(n / 1e3, "K");
  return `$${n.toFixed(0)}`;
}

function signed(n: number, digits = 2, unit = "%"): string {
  if (Math.abs(n) < 0.005) return `flat`;
  return `${n > 0 ? "up" : "down"} ${Math.abs(n).toFixed(digits)}${unit}`;
}

export function zoneFor(scale: NonNullable<Explainer["scale"]>, v: number): Zone {
  return scale.zones.find((z) => v >= z.from && v <= z.to) ?? scale.zones[scale.zones.length - 1];
}

const FEAR_GREED_SCALE = {
  min: 0,
  max: 100,
  zones: [
    { from: 0, to: 24, label: "Extreme fear", tone: "down" as const },
    { from: 25, to: 44, label: "Fear", tone: "down" as const },
    { from: 45, to: 55, label: "Neutral", tone: "gold" as const },
    { from: 56, to: 75, label: "Greed", tone: "up" as const },
    { from: 76, to: 100, label: "Extreme greed", tone: "up" as const },
  ],
};

const ALT_SCALE = {
  min: 0,
  max: 100,
  zones: [
    { from: 0, to: 25, label: "Bitcoin season", tone: "blue" as const },
    { from: 26, to: 74, label: "Mixed", tone: "gold" as const },
    { from: 75, to: 100, label: "Altcoin season", tone: "up" as const },
  ],
};

const DOMINANCE_SCALE = {
  min: 30,
  max: 75,
  zones: [
    { from: 30, to: 44.99, label: "Altcoin-heavy", tone: "up" as const },
    { from: 45, to: 54.99, label: "Balanced", tone: "gold" as const },
    { from: 55, to: 75, label: "Bitcoin-led", tone: "blue" as const },
  ],
};

export const EXPLAINERS: Record<ExplainTopic, Explainer> = {
  "market-cap": {
    title: "Total market cap",
    what: "The value of every coin added together: each coin's price times the coins in circulation. It is the size of the whole crypto market.",
    howToRead: ["Under 1% in a day is quiet for crypto.", "1% to 3% is a normal day.", "Over 3% is a big day, usually led by Bitcoin and Ethereum."],
    moves: ["Bitcoin and Ethereum, which are most of the total", "Big news: regulation, ETFs, rate decisions", "Money arriving through stablecoins"],
    read: ({ value, change }) => {
      if (!has(value)) return null;
      const size = has(change) ? (Math.abs(change) < 1 ? "A quiet day." : Math.abs(change) <= 3 ? "A normal move for crypto." : "A big day for crypto.") : "";
      return `The whole market is worth ${compactUsd(value)}${has(change) ? `, ${signed(change)} on the day` : ""}. ${size}`.trim();
    },
  },
  volume: {
    title: "24h volume",
    what: "The dollar value of all trades in the last 24 hours. It shows how many people are acting, not just watching.",
    howToRead: ["A move on rising volume is more convincing than one on thin volume.", "Volume up more than 25% on the day means something is drawing traders in.", "Falling volume in a rally can mean the move is running out of buyers."],
    moves: ["Sharp price moves and liquidations", "News and listings", "Weekends and holidays, which are usually quieter"],
    read: ({ value, change }) => {
      if (!has(value)) return null;
      const mood = has(change) ? (change > 25 ? "Activity is surging: a move or news is pulling traders in." : change < -25 ? "Activity is fading: traders are sitting this out." : "Normal activity.") : "";
      return `${compactUsd(value)} traded in 24 hours${has(change) ? `, ${signed(change, 1)} on yesterday` : ""}. ${mood}`.trim();
    },
  },
  dominance: {
    title: "BTC dominance",
    what: "Bitcoin's share of the total crypto market cap. It tells you whether money is concentrated in Bitcoin or spread across altcoins.",
    howToRead: ["Above 55%: a Bitcoin-led market, altcoins usually lag.", "45% to 55%: balanced.", "Falling dominance while the market rises usually means money is moving into altcoins."],
    moves: ["Bitcoin outperforming or lagging everything else", "Risk appetite: nervous markets retreat to Bitcoin", "Stablecoin supply, which counts in the total but is not Bitcoin"],
    scale: DOMINANCE_SCALE,
    read: ({ value, change }) => {
      if (!has(value)) return null;
      const z = zoneFor(DOMINANCE_SCALE, value);
      const note = z.label === "Bitcoin-led" ? "That is a Bitcoin-led market: altcoins usually lag in this range." : z.label === "Balanced" ? "That is a balanced market." : "Altcoins hold an unusually large share.";
      return `Bitcoin is ${value.toFixed(1)}% of the market${has(change) ? `, ${signed(change)} on the day` : ""}. ${note}`;
    },
  },
  "fear-greed": {
    title: "Fear & Greed",
    what: "A 0 to 100 score of the market's mood, built from price momentum, volatility and demand. It measures emotion, not value.",
    howToRead: ["0 to 24 extreme fear, 25 to 44 fear, 45 to 55 neutral, 56 to 75 greed, 76 to 100 extreme greed.", "Extremes tend not to last: very fearful markets have often been near local lows, very greedy ones near local highs.", "It is a mood gauge, not a timing signal. Moods can stay extreme for weeks."],
    moves: ["Fast price moves in either direction", "Volatility spikes", "Headlines that change risk appetite"],
    scale: FEAR_GREED_SCALE,
    read: ({ value }) => {
      if (!has(value)) return null;
      const z = zoneFor(FEAR_GREED_SCALE, value);
      const note: Record<string, string> = {
        "Extreme fear": "Traders are scared. Moments like this have often been near local lows, but fear can last.",
        Fear: "Traders are cautious and quick to sell.",
        Neutral: "No strong mood either way.",
        Greed: "Traders are confident and buying dips.",
        "Extreme greed": "Euphoria. Markets are often stretched here and pullbacks can be sharp.",
      };
      return `${Math.round(value)} is ${z.label}. ${note[z.label]}`;
    },
  },
  "altcoin-index": {
    title: "Altcoin Season Index",
    what: "How many of the top 100 coins have beaten Bitcoin over the last 90 days, as a 0 to 100 score. Stablecoins and wrapped tokens are left out.",
    howToRead: ["75 or more: altcoin season, most big coins are beating Bitcoin.", "25 or less: Bitcoin season, Bitcoin is beating most of them.", "In between: a mixed market where only some sectors outperform."],
    moves: ["Bitcoin's own 90-day return, the bar everything is measured against", "Sector rallies, such as memes, AI or DeFi", "Money rotating out of Bitcoin after a strong run"],
    scale: ALT_SCALE,
    read: ({ value }) => {
      if (!has(value)) return null;
      const z = zoneFor(ALT_SCALE, value);
      const note = z.label === "Altcoin season" ? "Most large coins are beating Bitcoin." : z.label === "Bitcoin season" ? "Bitcoin is beating most large coins." : "Some coins beat Bitcoin, most do not.";
      return `${Math.round(value)} means ${z.label.toLowerCase()}: roughly ${Math.round(value)} of the top 100 coins have beaten Bitcoin over 90 days. ${note}`;
    },
  },
  chart: {
    title: "Market cap vs BTC dominance",
    what: "The gold line is the size of the whole market. The dashed blue line is Bitcoin's share of it. Reading them together shows where the money is going.",
    howToRead: ["Market up, dominance down: money is rotating into altcoins.", "Market up, dominance up: Bitcoin is leading the rise.", "Market down, dominance up: money is hiding in Bitcoin.", "Market down, dominance down: altcoins are holding up better than Bitcoin."],
    moves: ["Bitcoin's trend, which sets the tone for everything", "Rotations into and out of altcoin sectors", "Stablecoin inflows and outflows"],
    read: ({ extra }) => {
      const days = extra?.days;
      const cap = extra?.capChangePct;
      const dom = extra?.domChangePts;
      if (typeof cap !== "number" || typeof dom !== "number") return null;
      const span = typeof days === "number" ? `Over ${days} days` : "Over this range";
      const capTxt = `the market ${cap >= 0 ? "grew" : "shrank"} ${Math.abs(cap).toFixed(1)}%`;
      const domTxt = `Bitcoin's share ${dom >= 0 ? "rose" : "fell"} ${Math.abs(dom).toFixed(1)} points`;
      const meaning = cap >= 0 ? (dom < 0 ? "Money has been rotating into altcoins." : "Bitcoin has been leading the rise.") : dom >= 0 ? "In the decline, money has been hiding in Bitcoin." : "Altcoins have held up better than Bitcoin in the decline.";
      return `${span} ${capTxt} while ${domTxt}. ${meaning}`;
    },
  },
  movers: {
    title: "Movers that matter",
    what: "The biggest 24-hour gainers and losers, filtered to coins worth at least $50M with at least $5M traded. The filter hides thin micro-caps that jump on a single trade.",
    howToRead: ["A big move on high volume is real interest. The same move on low volume is fragile.", "Several coins from one sector moving together usually means rotation, not coin news.", "Check whether a gainer is simply recovering from yesterday's drop."],
    moves: ["Listings, unlocks and project news", "Sector rotations", "Liquidations on leveraged positions"],
    read: ({ extra }) => {
      const up = extra?.topGainer;
      const down = extra?.topLoser;
      if (!up && !down) return null;
      const parts = [up ? `The biggest liquid gainer is ${up}.` : "", down ? `The biggest liquid loser is ${down}.` : ""].filter(Boolean);
      return parts.join(" ");
    },
  },
  liquidations: {
    title: "Liquidations",
    what: "Leveraged futures positions closed by force because the price moved against them. Longs bet on a rise, shorts bet on a fall.",
    howToRead: ["Mostly longs liquidated: leveraged buyers were flushed out on the way down.", "Mostly shorts liquidated: a squeeze, prices rose into leveraged sellers.", "Over $500M in a day is heavy. Under $100M is calm."],
    moves: ["Sudden price moves that trigger stops in a chain", "Too much leverage on one side of the market", "Thin weekend liquidity"],
    read: ({ value, extra }) => {
      if (!has(value)) return null;
      const long = extra?.longSharePct;
      const side = typeof long === "number" ? (long >= 65 ? "Longs took the pain: leveraged buyers were flushed out." : long <= 35 ? "Shorts were squeezed: prices rose into leveraged sellers." : "Both sides were hit about evenly.") : "";
      const size = value > 500e6 ? "That is a heavy day." : value < 100e6 ? "A calm day for leverage." : "";
      return `${compactUsd(value)} of leveraged positions were force-closed in 24 hours${typeof long === "number" ? `, ${Math.round(long)}% of them longs` : ""}. ${side} ${size}`.replace(/\s+/g, " ").trim();
    },
  },
};

export function readNow(topic: ExplainTopic, live: Live | undefined): string | null {
  return live ? EXPLAINERS[topic].read(live) : null;
}
