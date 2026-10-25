// Is the offer a lowball? Compares it to scraped deals in data/rates.json. Pure math, no model.

export type RateRow = {
  source: "reddit" | "upwork" | "fiverr";
  url: string;
  per_video_usd: number; // base price for one video, usage rights excluded when the post says so
  paid_usage_addon_pct: number | null; // extra % charged for paid-ad / whitelisting rights, if stated
  perpetual_addon_pct: number | null; // extra % charged for forever usage, if stated
  quote: string; // the words in the post the numbers came from
};

export type Offer = { total_pay_usd: number | null; videos: number | null; paid_ads: boolean; usage_forever: boolean };

export type Verdict = {
  n: number;
  offer_per_video: number;
  percentile: number; // share of scraped deals that paid less per video than this offer, 0-100
  p25: number;
  median: number;
  p75: number;
  addon: { label: string; pct: number; n: number } | null;
  missing_addon: string | null; // why a right the contract takes is not priced
  fair_total: number;
  underpaid_by: number;
  math: string[];
  points: number[]; // every per-video price, for the chart
};

const MIN_ADDON_ROWS = 5; // ponytail: below this an add-on median is noise, so it is left out and said so

export function quantile(sorted: number[], q: number): number {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function judge(offer: Offer, rows: RateRow[]): Verdict | null {
  if (!offer.total_pay_usd || !offer.videos || rows.length < 5) return null;
  const prices = rows.map((r) => r.per_video_usd).sort((a, b) => a - b);
  const per = offer.total_pay_usd / offer.videos;
  const median = quantile(prices, 0.5);

  // The rights the contract takes, priced from what creators say they charge for them.
  const want = offer.usage_forever && offer.paid_ads ? "perpetual" : offer.paid_ads ? "paid" : null;
  const stated = rows
    .map((r) => (want === "perpetual" ? r.perpetual_addon_pct : r.paid_usage_addon_pct))
    .filter((p): p is number => p !== null && p > 0)
    .sort((a, b) => a - b);
  let addon: Verdict["addon"] = null;
  let missing_addon: string | null = null;
  if (want && stated.length >= MIN_ADDON_ROWS) {
    addon = { label: want === "perpetual" ? "forever paid-ad usage" : "paid-ad usage", pct: quantile(stated, 0.5), n: stated.length };
  } else if (want) {
    missing_addon = `The contract also takes ${want === "perpetual" ? "forever paid-ad" : "paid-ad"} rights. Only ${stated.length} scraped deal${stated.length === 1 ? "" : "s"} priced those, so they are not counted. The real gap is bigger.`;
  }

  const base = median * offer.videos;
  const extra = addon ? (base * addon.pct) / 100 : 0;
  const fair_total = base + extra;
  const math = [
    `Median rate: ${usd(median)} per video (${rows.length} deals) × ${offer.videos} videos = ${usd(base)}`,
    ...(addon ? [`+ ${Math.round(addon.pct)}% for ${addon.label} (median of ${addon.n} deals) = ${usd(extra)}`] : []),
    `Fair total ${usd(fair_total)} − offer ${usd(offer.total_pay_usd)} = ${usd(fair_total - offer.total_pay_usd)}`,
  ];
  return {
    n: rows.length,
    offer_per_video: per,
    percentile: Math.round((100 * prices.filter((p) => p < per).length) / prices.length),
    p25: quantile(prices, 0.25),
    median,
    p75: quantile(prices, 0.75),
    addon,
    missing_addon,
    fair_total,
    underpaid_by: fair_total - offer.total_pay_usd,
    math,
    points: prices,
  };
}
