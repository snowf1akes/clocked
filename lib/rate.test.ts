import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, judge, type Benchmarks, type Offer, type RateRow } from "./rate.ts";

const offer = (o: Partial<Offer>): Offer => ({
  total_pay_usd: 450, videos: 3, usage_months: null, usage_forever: false, paid_ads: false,
  exclusivity_months: 0, raw_footage_free: false, ai_likeness: false, payment_days: 30, ...o,
});
const bench = (rows: RateRow[]): Benchmarks => ({
  as_of: "2026-10-25", window_months: 12, currency: "USD", validation: {}, buckets: aggregate(rows),
  retainers: { n: 0, note: "" }, non_cash_share: 0, ask_vs_offer_gap: [], reference_figures: [], sample_note: "",
});

test("Raymond's worked example: $450 for 3 videos with perpetual + paid ads, exclusivity, raw footage and AI", () => {
  const p = judge(offer({ usage_forever: true, paid_ads: true, usage_months: 12, exclusivity_months: 12, raw_footage_free: true, ai_likeness: true, payment_days: 90 }), null)!;
  assert.deepEqual(p.fair_range, { low: 630, high: 1800, midpoint: 1215 });
  assert.equal(p.verdict, "underpaid");
  assert.equal(p.gap_vs_low_pct, 29);
  assert.equal(p.gap_vs_mid_pct, 63);
  assert.equal(p.counteroffer, 1200);
  // the fewest cuts that make $450 fair (Raymond's example cuts all three; both satisfy the rule)
  assert.match(p.reduce_rights_option, /limit it to 30 days of organic use, no exclusivity\. \$450 is then within the \$390–\$900 range/);
  assert.equal(p.confidence, "low");
  assert.deepEqual(p.unpriced_terms, ["ai_rights"]);
  assert.equal(p.notes.length, 3); // AI rights, slow payment, exclusivity longer than 6 months
});

test("a fair offer says so and suggests no fix", () => {
  const p = judge(offer({ total_pay_usd: 450 }), null)!; // 3 × $100–$200 = $300–$600
  assert.equal(p.verdict, "fair");
  assert.equal(p.script, "");
});

test("uses a niche bucket only when it has 15+ prices from 5+ threads, else falls back", () => {
  const row = (i: number, category: RateRow["category"]): RateRow => ({
    source: "reddit", thread: `t${i % 6}`, price_type: "accepted_deal", rights_bundle: "base", category, per_video_usd: 200 + i, first_hand: true, retainer: false,
  });
  const rows = Array.from({ length: 16 }, (_, i) => row(i, "tech_apps"));
  const tech = judge(offer({ company_type: "tech_apps" }), bench(rows))!;
  assert.equal(tech.base.fallback_level, "none");
  assert.equal(tech.base.n, 16);
  const beauty = judge(offer({ company_type: "beauty_skincare" }), bench(rows))!;
  assert.equal(beauty.base.fallback_level, "all niches");
});

test("commission-only: can't fully evaluate, shows the sales needed", () => {
  const p = judge(offer({ total_pay_usd: null, pricing_unit: "commission_only", commission_pct: 10 }), null)!;
  assert.equal(p.verdict, "cannot_fully_evaluate");
  assert.equal(p.required_sales_for_commission, 3000); // $300 low end / 10%
});

test("no verdict without a deliverable count", () => {
  assert.equal(judge(offer({ videos: null }), null), null);
});
