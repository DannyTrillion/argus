/**
 * Stored explainers behind every Explain button. Instant and free: no network, no model.
 * Each topic says what the number is, how to read it, what moves it, and turns the live
 * value already on screen into plain sentences with simple, published thresholds, plus a
 * week-ago comparison where history is already loaded.
 * Pure and framework-free so the reading rules are unit tested.
 */
export type ExplainTopic =
  | "market-cap" | "volume" | "dominance" | "fear-greed" | "altcoin-index" | "chart" | "movers" | "liquidations"
  | "volatility" | "drawdown" | "correlation" | "ath"
  | "vs-btc" | "portfolio-attribution" | "concentration";

export interface Live {
  value?: number | null;
  change?: number | null;
  /** The same value about seven days ago, when history is already on hand. */
  previous?: number | null;
  /** When the reading was taken (ISO). Shown as "updated 2m ago". */
  asOf?: string | null;
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
  /** One sentence comparing now with a week ago. */
  compare?: (now: number, prev: number) => string;
  /** A separate door to the analyst, only where there is a real "why today" question. */
  analyse?: { label: string; q: string };
}

const has = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n);
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

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

/** Rise needed to get back to where you were after falling `fallPct` percent. */
export function recoveryPct(fallPct: number): number | null {
  const f = Math.abs(fallPct) / 100;
  return f >= 0.999 ? null : (1 / (1 - f) - 1) * 100;
}

export function zoneFor(scale: NonNullable<Explainer["scale"]>, v: number): Zone {
  return scale.zones.find((z) => v >= z.from && v <= z.to) ?? (v < scale.zones[0].from ? scale.zones[0] : scale.zones[scale.zones.length - 1]);
}

const FEAR_GREED_SCALE = {
  min: 0, max: 100,
  zones: [
    { from: 0, to: 24.99, label: "Extreme fear", tone: "down" as const },
    { from: 25, to: 44.99, label: "Fear", tone: "down" as const },
    { from: 45, to: 55.99, label: "Neutral", tone: "gold" as const },
    { from: 56, to: 75.99, label: "Greed", tone: "up" as const },
    { from: 76, to: 100, label: "Extreme greed", tone: "up" as const },
  ],
};
const ALT_SCALE = {
  min: 0, max: 100,
  zones: [
    { from: 0, to: 25.99, label: "Bitcoin season", tone: "blue" as const },
    { from: 26, to: 74.99, label: "Mixed", tone: "gold" as const },
    { from: 75, to: 100, label: "Altcoin season", tone: "up" as const },
  ],
};
const DOMINANCE_SCALE = {
  min: 30, max: 75,
  zones: [
    { from: 30, to: 44.99, label: "Altcoin-heavy", tone: "up" as const },
    { from: 45, to: 54.99, label: "Balanced", tone: "gold" as const },
    { from: 55, to: 75, label: "Bitcoin-led", tone: "blue" as const },
  ],
};
const VOL_SCALE = {
  min: 0, max: 150,
  zones: [
    { from: 0, to: 39.99, label: "Calm", tone: "up" as const },
    { from: 40, to: 79.99, label: "Typical crypto", tone: "gold" as const },
    { from: 80, to: 150, label: "Wild", tone: "down" as const },
  ],
};
const CORR_SCALE = {
  min: -1, max: 1,
  zones: [
    { from: -1, to: 0.4999, label: "Own path", tone: "up" as const },
    { from: 0.5, to: 0.7999, label: "Partly", tone: "gold" as const },
    { from: 0.8, to: 1, label: "Moves with BTC", tone: "blue" as const },
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
    compare: (now, prev) => `On the week it is ${signed((now / prev - 1) * 100, 1)}, from ${compactUsd(prev)}.`,
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
    compare: (_now, prev) => `A week ago a day's trading was ${compactUsd(prev)}.`,
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
    compare: (now, prev) => (Math.abs(now - prev) < 0.05 ? `About the same as a week ago.` : `A week ago it was ${prev.toFixed(1)}%, so it has ${now > prev ? "risen" : "fallen"} ${Math.abs(now - prev).toFixed(1)} points.`),
    analyse: { label: "Analyse today's dominance move", q: "Why is BTC dominance moving today, and what does it mean for altcoins?" },
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
    compare: (now, prev) => (Math.round(now) === Math.round(prev) ? `Unchanged from a week ago.` : `A week ago it read ${Math.round(prev)}, ${zoneFor(FEAR_GREED_SCALE, prev).label.toLowerCase()}.`),
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
      if (!num(cap) || !num(dom)) return null;
      const span = num(days) ? `Over ${days} days` : "Over this range";
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
      return [up ? `The biggest liquid gainer is ${up}.` : "", down ? `The biggest liquid loser is ${down}.` : ""].filter(Boolean).join(" ");
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
      const side = num(long) ? (long >= 65 ? "Longs took the pain: leveraged buyers were flushed out." : long <= 35 ? "Shorts were squeezed: prices rose into leveraged sellers." : "Both sides were hit about evenly.") : "";
      const size = value > 500e6 ? "That is a heavy day." : value < 100e6 ? "A calm day for leverage." : "";
      return `${compactUsd(value)} of leveraged positions were force-closed in 24 hours${num(long) ? `, ${Math.round(long)}% of them longs` : ""}. ${side} ${size}`.replace(/\s+/g, " ").trim();
    },
    analyse: { label: "Analyse today's liquidations", q: "What drove today's liquidations, and what do they mean for the next few days?" },
  },
  volatility: {
    title: "Annualized volatility",
    what: "How much the price swings, measured from daily moves and scaled to a year. Higher means bigger and more frequent swings in both directions.",
    howToRead: ["Under 40% is calm for crypto, closer to a large stock.", "40% to 80% is typical: Bitcoin usually sits near the low end.", "Over 80% means wild daily swings. A normal week can move the price a lot."],
    moves: ["Leverage and liquidations", "Thin trading and small market caps", "News, unlocks and listings"],
    scale: VOL_SCALE,
    read: ({ value }) => {
      if (!has(value)) return null;
      const z = zoneFor(VOL_SCALE, value);
      const note = z.label === "Calm" ? "Calm for crypto." : z.label === "Typical crypto" ? "Typical for a large crypto asset." : "Wild: expect big daily swings.";
      return `${value.toFixed(0)}% a year. ${note} A typical day moves it about ${(value / Math.sqrt(365)).toFixed(1)}%.`;
    },
  },
  drawdown: {
    title: "Max drawdown",
    what: "The largest fall from a peak to a later low within the window. It shows how painful the worst stretch was for someone who bought at the top.",
    howToRead: ["Under 20% is shallow for crypto.", "20% to 50% is a typical crypto shakeout.", "A fall of 50% needs a 100% rise to get back: losses and recoveries are not symmetric."],
    moves: ["Market-wide sell-offs", "Liquidation cascades", "Project-specific bad news"],
    read: ({ value }) => {
      if (!has(value)) return null;
      const v = Math.abs(value);
      const need = recoveryPct(v);
      const note = v < 20 ? "Shallow for crypto." : v <= 50 ? "A typical crypto shakeout." : "A deep fall.";
      return `The worst fall from a peak was ${v.toFixed(1)}%. ${note}${need !== null ? ` Climbing back to that peak takes a ${need.toFixed(0)}% rise.` : ""}`;
    },
  },
  correlation: {
    title: "Correlation with Bitcoin",
    what: "How closely daily moves line up with Bitcoin's, from -1 to 1. At 1 they move in lockstep; near 0 they have nothing to do with each other.",
    howToRead: ["0.8 and above: it moves with Bitcoin, so Bitcoin's direction matters most.", "0.5 to 0.8: partly Bitcoin, partly its own story.", "Below 0.5: mostly its own story. Useful for spreading risk."],
    moves: ["Market-wide risk-on and risk-off days, which pull everything together", "Coin-specific news, which pulls it apart", "Which exchanges and traders dominate its volume"],
    scale: CORR_SCALE,
    read: ({ value }) => {
      if (!has(value)) return null;
      const z = zoneFor(CORR_SCALE, value);
      const note = z.label === "Moves with BTC" ? "moves almost in step with Bitcoin, so Bitcoin's direction matters most" : z.label === "Partly" ? "partly follows Bitcoin and partly its own story" : "mostly moves on its own story, not Bitcoin's";
      return `${value.toFixed(2)} means it ${note}.`;
    },
  },
  ath: {
    title: "Distance from all-time high",
    what: "How far today's price sits below the highest price the coin ever traded at. It shows how much of past hype has been given back.",
    howToRead: ["Within 10% of the high: trading near its peak.", "50% below: the price must double to get back.", "80% or more below: most early buyers are deep in loss, and a full recovery is a long way off."],
    moves: ["The market cycle: most coins set highs in bull markets", "New supply from unlocks that dilutes the price", "Whether the project is still growing"],
    read: ({ value }) => {
      if (!has(value)) return null;
      if (value > -1) return "It is trading at or near its all-time high.";
      const v = Math.abs(value);
      const need = recoveryPct(v);
      return `It trades ${v.toFixed(1)}% below its all-time high.${need !== null ? ` Getting back there takes a ${need.toFixed(0)}% rise.` : ""}`;
    },
  },
  "vs-btc": {
    title: "Versus holding Bitcoin",
    what: "How your basket did compared with putting the same money in Bitcoin over the same 24 hours. It answers whether picking coins beat the simplest choice.",
    howToRead: ["Positive: your picks beat Bitcoin today.", "Negative: Bitcoin alone would have done better.", "One day says little. Watch it over weeks before drawing conclusions."],
    moves: ["How much of the basket is Bitcoin itself", "Altcoins with high beta, which amplify Bitcoin's moves", "Stablecoins, which sit still while Bitcoin moves"],
    read: ({ value }) => {
      if (!has(value)) return null;
      if (Math.abs(value) < 0.05) return "Over 24 hours your basket matched Bitcoin.";
      return `Over 24 hours your basket did ${Math.abs(value).toFixed(2)}% ${value > 0 ? "better" : "worse"} than holding the same money in Bitcoin.`;
    },
  },
  "portfolio-attribution": {
    title: "Why your portfolio moved",
    what: "Today's change split three ways: the part that came from the market moving with Bitcoin, the part from the sectors your coins belong to, and what is left, which is down to the coins themselves.",
    howToRead: ["Market beta is your basket's beta times Bitcoin's move.", "Sector is what your coins' categories did beyond the market.", "What you hold is the remainder: your coin choices, good or bad."],
    moves: ["Bitcoin's move, multiplied by your basket's beta", "Sector rallies and sell-offs", "News about the specific coins you own"],
    read: ({ extra }) => {
      const m = extra?.market, s = extra?.sector, o = extra?.own, b = extra?.beta;
      if (!num(m) && !num(s) && !num(o)) return null;
      const f = (n: unknown) => (num(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : "unknown");
      const beta = num(b) ? ` Your basket's beta is ${b.toFixed(2)}: it tends to move ${b.toFixed(2)}% for each 1% Bitcoin moves.` : "";
      return `Today ${f(m)} came from the market, ${f(s)} from your sectors and ${f(o)} from the coins themselves.${beta}`;
    },
  },
  concentration: {
    title: "Concentration",
    what: "How much of your basket sits in its biggest positions. Effective positions turns that into one number: how many equally sized holdings would carry the same risk.",
    howToRead: ["One coin over 50%: that coin decides most of your result.", "Fewer than 3 effective positions: concentrated.", "Stablecoins lower risk but also returns."],
    moves: ["Price moves, which grow winners into bigger weights", "New buys and sells", "Adding or removing stablecoins"],
    read: ({ value, extra }) => {
      if (!has(value)) return null;
      const eff = extra?.effective;
      const note = value >= 50 ? "One coin decides most of your result." : num(eff) && eff < 3 ? "Concentrated." : "Reasonably spread.";
      return `Your largest position is ${value.toFixed(0)}% of the basket${num(eff) ? `, and it behaves like ${eff.toFixed(1)} equally sized positions` : ""}. ${note}`;
    },
  },
};

export const LEARN_GROUPS: Array<{ title: string; topics: ExplainTopic[] }> = [
  { title: "The market", topics: ["market-cap", "volume", "dominance", "chart", "movers"] },
  { title: "Mood and cycles", topics: ["fear-greed", "altcoin-index"] },
  { title: "Leverage", topics: ["liquidations"] },
  { title: "A coin's risk", topics: ["volatility", "drawdown", "correlation", "ath"] },
  { title: "Your portfolio", topics: ["vs-btc", "portfolio-attribution", "concentration"] },
];

export function readNow(topic: ExplainTopic, live: Live | undefined): string | null {
  if (!live) return null;
  const ex = EXPLAINERS[topic];
  const base = ex.read(live);
  if (base && ex.compare && has(live.value) && has(live.previous) && live.previous !== 0) return `${base} ${ex.compare(live.value, live.previous)}`;
  return base;
}
