// The Pay Checker: is the offer fair for what the contract asks? Pure math, no model.
// Method from Raymond's pay_checker_prompt: base range per video (from benchmarks, with fallbacks) ×
// deliverables × (1 + uplifts for extra rights) = estimated fair range; then verdict, two fixes, confidence.

// What the brand sells. Rates differ by company type, so offers are compared within their type when data allows.
export const COMPANY_TYPES = [
  "beauty_skincare", "fashion_apparel", "tech_apps", "education_study", "food_beverage",
  "health_fitness", "finance", "gaming_entertainment", "home_lifestyle", "other",
] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];
export const COMPANY_LABEL: Record<CompanyType, string> = {
  beauty_skincare: "beauty & skincare", fashion_apparel: "fashion", tech_apps: "tech & apps",
  education_study: "study tools & edtech", food_beverage: "food & drink", health_fitness: "health & fitness",
  finance: "finance", gaming_entertainment: "gaming & entertainment", home_lifestyle: "home & lifestyle", other: "other",
};

// Every price is labeled; types and rights bundles are never mixed in one benchmark.
export const PRICE_TYPES = ["accepted_deal", "brand_offer", "creator_ask"] as const;
export type PriceType = (typeof PRICE_TYPES)[number];
export const PRICE_TYPE_LABEL: Record<PriceType, string> = { accepted_deal: "accepted deals", brand_offer: "brand offers", creator_ask: "creator asks" };
export type RightsBundle = "base" | "with_short_paid" | "with_long_paid" | "with_exclusivity" | "unknown_rights";

// One verified price in data/rates.json (no quotes, links or names).
export type RateRow = {
  source: "reddit" | "upwork";
  thread: string; // hashed thread id, so one loud thread can't dominate (max 3 prices per thread)
  price_type: PriceType;
  rights_bundle: RightsBundle;
  category: CompanyType;
  per_video_usd: number;
  first_hand: boolean;
  retainer: boolean;
};

export type Bucket = {
  niche: CompanyType | "all";
  price_type: PriceType;
  rights_bundle: RightsBundle;
  n: number;
  n_sources: number;
  median_per_video: number;
  p25: number;
  p75: number;
  first_hand_share: number;
  usable: boolean; // n >= 15 from at least 5 distinct threads
};

export type Benchmarks = {
  as_of: string;
  window_months: number;
  currency: "USD";
  validation: Record<string, number | string | null>;
  buckets: Bucket[];
  retainers: { n: number; note: string }; // monthly deals, kept out of per-video pricing (volume discounts)
  non_cash_share: number;
  ask_vs_offer_gap: { niche: string; ratio: number }[];
  reference_figures: { figure: string; value: string; source: string }[];
  sample_note: string;
};

export const MIN_N = 15;
export const MIN_SOURCES = 5;

export function quantile(sorted: number[], q: number): number {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
}

// rates.json rows -> buckets by niche × price type × rights bundle, plus an all-niche bucket for each pair.
export function aggregate(rows: RateRow[]): Bucket[] {
  const groups = new Map<string, RateRow[]>();
  for (const r of rows.filter((x) => !x.retainer)) {
    for (const niche of [r.category, "all"]) {
      const k = `${niche}|${r.price_type}|${r.rights_bundle}`;
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
  }
  return [...groups].map(([k, g]) => {
    const [niche, price_type, rights_bundle] = k.split("|") as [Bucket["niche"], PriceType, RightsBundle];
    const p = g.map((r) => r.per_video_usd).sort((a, b) => a - b);
    const n_sources = new Set(g.map((r) => r.thread)).size;
    return {
      niche, price_type, rights_bundle, n: g.length, n_sources,
      median_per_video: Math.round(quantile(p, 0.5)), p25: Math.round(quantile(p, 0.25)), p75: Math.round(quantile(p, 0.75)),
      first_hand_share: +(g.filter((r) => r.first_hand).length / g.length).toFixed(2),
      usable: g.length >= MIN_N && n_sources >= MIN_SOURCES,
    };
  });
}

// Used when no benchmark bucket qualifies. Collabstr average paid $154; Pitchlo median offer $100 (Oct 2026).
export const DEFAULT_BASE = { low: 100, high: 200 };

// Default uplifts for extra rights (practitioner estimates; JoinBrands for exclusivity). Added, then multiplied.
export const UPLIFTS = {
  long_paid: { low: 50, high: 100, label: "paid usage over 90 days, perpetual usage or ownership" },
  short_paid: { low: 20, high: 50, label: "paid usage / whitelisting, 90 days or less" },
  exclusivity: { low: 30, high: 50, label: "category exclusivity" },
  raw_footage: { low: 30, high: 50, label: "raw footage" },
} as const;
type UpliftKey = keyof typeof UPLIFTS;
const ASK_TERM: Record<UpliftKey, string> = {
  long_paid: "long-term usage",
  short_paid: "paid ads",
  exclusivity: "exclusivity",
  raw_footage: "raw footage",
};
const and = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const REDUCE_TERM: Record<UpliftKey, string> = {
  long_paid: "30 days of organic use",
  short_paid: "organic use only",
  exclusivity: "no exclusivity",
  raw_footage: "no raw footage",
};

export type Offer = {
  total_pay_usd: number | null;
  videos: number | null;
  company_type?: CompanyType;
  pricing_unit?: "per_video" | "package" | "per_month" | "commission_only" | "product_only";
  commission_pct?: number | null;
  usage_months: number | null;
  usage_forever: boolean;
  paid_ads: boolean;
  ownership_transfer?: boolean;
  exclusivity_months: number | null;
  raw_footage_free: boolean;
  ai_likeness: boolean;
  payment_days: number | null;
};

export type PayCheck = {
  offer: number;
  videos: number;
  base: { low: number; high: number; source: string; n: number; fallback_level: string };
  uplifts: { term: string; low_pct: number; high_pct: number }[];
  unpriced_terms: string[];
  fair_range: { low: number; high: number; midpoint: number };
  verdict: "underpaid" | "fair" | "above_range" | "cannot_fully_evaluate";
  underpaid_by: number; // dollars below the low end (0 when fair)
  gap_vs_low_pct: number;
  gap_vs_mid_pct: number;
  counteroffer: number;
  reduce_rights_option: string;
  script: string;
  required_sales_for_commission: number | null;
  confidence: "high" | "medium" | "low";
  confidence_reason: string;
  notes: string[];
  offer_per_video: number;
};

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const round10 = (n: number) => Math.round(n / 10) * 10;
const clean = (n: number) => (n >= 500 ? Math.round(n / 50) * 50 : round10(n));

// Fallback order: same niche accepted deals → same niche offers/asks → all niches (accepted first) → default range.
function chooseBase(type: CompanyType | undefined, b: Bucket[]) {
  const pick = (niche: Bucket["niche"], types: readonly PriceType[]) =>
    types.map((t) => b.find((x) => x.usable && x.niche === niche && x.price_type === t && x.rights_bundle === "base")).find(Boolean);
  const niche = type && type !== "other" ? type : null;
  const tries: [Bucket | undefined, string][] = [
    [niche ? pick(niche, ["accepted_deal"]) : undefined, "none"],
    [niche ? pick(niche, ["brand_offer", "creator_ask"]) : undefined, "same niche, other price type"],
    [pick("all", PRICE_TYPES), "all niches"],
  ];
  for (const [hit, level] of tries) {
    if (hit) {
      const where = hit.niche === "all" ? "all niches" : COMPANY_LABEL[hit.niche];
      return { low: hit.p25, high: hit.p75, source: `${PRICE_TYPE_LABEL[hit.price_type]}, ${where}, organic only`, n: hit.n, fallback_level: level, bucket: hit };
    }
  }
  return { ...DEFAULT_BASE, source: "default reference range", n: 0, fallback_level: "default reference", bucket: undefined };
}

export function judge(o: Offer, bench: Benchmarks | null): PayCheck | null {
  const videos = o.videos ?? 0;
  const nonCash = o.pricing_unit === "commission_only" || o.pricing_unit === "product_only";
  if (!videos || (!o.total_pay_usd && !nonCash)) return null; // spec: never guess the count or the amount
  const offer = nonCash ? 0 : o.total_pay_usd!;

  const base = chooseBase(o.company_type, bench?.buckets ?? []);
  const keys: UpliftKey[] = [];
  const longPaid = o.usage_forever || o.ownership_transfer || (o.paid_ads && (o.usage_months ?? 0) > 3);
  if (longPaid) keys.push("long_paid"); // ownership and perpetual are one uplift; whitelisting is part of paid usage
  else if (o.paid_ads) keys.push("short_paid");
  if ((o.exclusivity_months ?? 0) > 0) keys.push("exclusivity");
  if (o.raw_footage_free) keys.push("raw_footage");
  const sum = (ks: UpliftKey[], side: "low" | "high") => ks.reduce((a, k) => a + UPLIFTS[k][side], 0) / 100;
  const range = (ks: UpliftKey[]) => ({
    low: round10(base.low * videos * (1 + sum(ks, "low"))),
    high: round10(base.high * videos * (1 + sum(ks, "high"))),
  });
  const fr = range(keys);
  const fair_range = { ...fr, midpoint: Math.round((fr.low + fr.high) / 2) };

  const verdict: PayCheck["verdict"] = nonCash ? "cannot_fully_evaluate" : offer < fr.low ? "underpaid" : offer > fr.high ? "above_range" : "fair";
  const pct = (a: number, b: number) => Math.max(0, Math.round(((b - a) / b) * 100));

  // Option 2: drop rights, biggest uplift first, until the current offer is inside the range.
  const sorted = [...keys].sort((a, b) => UPLIFTS[b].high - UPLIFTS[a].high);
  let kept = [...sorted];
  const dropped: UpliftKey[] = [];
  while (kept.length && offer < range(kept).low) dropped.push(kept.shift()!);
  const baseRange = range([]);
  const reduce_rights_option =
    verdict !== "underpaid" ? ""
    : offer >= range(kept).low && dropped.length
      ? `Keep ${usd(offer)} but limit it to ${dropped.map((k) => REDUCE_TERM[k]).join(", ")}. ${usd(offer)} is then within the ${usd(range(kept).low)}–${usd(range(kept).high)} range for ${videos} video${videos === 1 ? "" : "s"}.`
      : `Even with no extra rights, ${usd(offer)} is below the ${usd(baseRange.low)}–${usd(baseRange.high)} base range for ${videos} video${videos === 1 ? "" : "s"}.`;

  const counteroffer = clean(fair_range.midpoint);
  const asking = and(keys.map((k) => ASK_TERM[k]));
  const script =
    verdict === "underpaid"
      ? `Thanks for the offer! ${asking ? `For ${asking}, my` : "My"} rate is ${usd(counteroffer)}.${dropped.length && offer >= range(kept).low ? ` If the budget is fixed at ${usd(offer)}, I can do ${and(dropped.map((k) => REDUCE_TERM[k]))}.` : ""}`
      : "";

  const unknown = [o.usage_months === null && !o.usage_forever, o.exclusivity_months === null, o.payment_days === null].filter(Boolean).length;
  const nicheAccepted = base.bucket && base.bucket.niche !== "all" && base.bucket.price_type === "accepted_deal" && base.n >= 30;
  const confidence: PayCheck["confidence"] =
    !base.bucket || unknown >= 3 ? "low" : nicheAccepted && unknown === 0 ? "high" : "medium";
  const confidence_reason = !base.bucket
    ? "the default reference range was used, because no benchmark bucket had 15+ prices from 5+ threads"
    : unknown >= 3 ? "several contract terms are unknown"
    : confidence === "high" ? `${base.n} accepted deals in this niche, and every contract term is known`
    : `based on ${base.n} reported prices (${base.source})${unknown ? `, and ${unknown} contract term${unknown === 1 ? " is" : "s are"} unknown` : ""}`;

  const notes: string[] = [];
  const unpriced_terms: string[] = [];
  if (o.ai_likeness) {
    unpriced_terms.push("ai_rights");
    notes.push(
      verdict === "fair" || verdict === "above_range"
        ? "The pay is fair for the videos, but it doesn't cover the AI rights this contract takes. There's no reliable market price for those, so treat them as a separate negotiation or ask for them to be removed."
        : "This contract lets the brand use AI on your face or voice. There's no reliable market price for that, so treat it as a separate negotiation or ask for it to be removed.",
    );
  }
  if ((o.payment_days ?? 0) >= 60) notes.push(`Payment comes ${o.payment_days} days out, so the real value is lower than the number suggests: the money is slower and less certain.`);
  if ((o.exclusivity_months ?? 0) > 6) notes.push("The exclusivity uplift is based on 3–6 months. This one is longer, so the real cost to you may be higher.");
  if (o.pricing_unit === "per_month") notes.push("This looks like a retainer. Volume deals often come with a discount, so compare the per-video price above.");

  const required_sales_for_commission =
    o.pricing_unit === "commission_only" && o.commission_pct ? Math.round(fr.low / (o.commission_pct / 100)) : null;
  if (o.pricing_unit === "commission_only")
    notes.unshift(
      required_sales_for_commission
        ? `Guaranteed pay is $0. To earn ${usd(fr.low)} at ${o.commission_pct}% commission, you'd need ${usd(required_sales_for_commission)} in sales through your code.`
        : "Guaranteed pay is $0, so the fair range above is what a cash fee would look like.",
    );
  if (o.pricing_unit === "product_only") notes.unshift("Guaranteed cash is $0. The product's value isn't counted as pay unless you choose to count it.");

  return {
    offer,
    videos,
    base: { low: base.low, high: base.high, source: base.source, n: base.n, fallback_level: base.fallback_level },
    uplifts: keys.map((k) => ({ term: UPLIFTS[k].label, low_pct: UPLIFTS[k].low, high_pct: UPLIFTS[k].high })),
    unpriced_terms,
    fair_range,
    verdict,
    underpaid_by: verdict === "underpaid" ? fr.low - offer : 0,
    gap_vs_low_pct: verdict === "underpaid" ? pct(offer, fr.low) : 0,
    gap_vs_mid_pct: verdict === "underpaid" ? pct(offer, fair_range.midpoint) : 0,
    counteroffer,
    reduce_rights_option,
    script,
    required_sales_for_commission,
    confidence,
    confidence_reason,
    notes,
    offer_per_video: offer / videos,
  };
}
