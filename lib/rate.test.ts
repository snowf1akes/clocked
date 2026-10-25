import { test } from "node:test";
import assert from "node:assert/strict";
import { judge, type RateRow } from "./rate.ts";

const row = (per: number, perpetual: number | null = null, category: RateRow["category"] = "other"): RateRow =>
  ({ source: "reddit", per_video_usd: per, paid_usage_addon_pct: null, perpetual_addon_pct: perpetual, category });

test("prices the offer against the median and counts forever rights when enough deals state them", () => {
  const rows = [100, 150, 200, 250, 300].map((p) => row(p, 100));
  const v = judge({ total_pay_usd: 300, videos: 3, paid_ads: true, usage_forever: true }, rows)!;
  assert.equal(v.median, 200);
  assert.equal(v.percentile, 0); // $100/video: no deal paid less
  assert.equal(v.fair_total, 1200); // 200 × 3 + 100%
  assert.equal(v.underpaid_by, 900);
});

test("leaves out an add-on that too few deals price, and says so", () => {
  const rows = [100, 150, 200, 250, 300].map((p, i) => row(p, i === 0 ? 100 : null));
  const v = judge({ total_pay_usd: 300, videos: 3, paid_ads: true, usage_forever: true }, rows)!;
  assert.equal(v.addon, null);
  assert.equal(v.fair_total, 600);
  assert.match(v.missing_addon!, /Only 1/);
});

test("no verdict without a price or enough data", () => {
  assert.equal(judge({ total_pay_usd: null, videos: 3, paid_ads: false, usage_forever: false }, [row(1)]), null);
});

test("compares within the brand's company type when there are enough of those deals", () => {
  const study = Array.from({ length: 8 }, () => row(400, null, "education_study"));
  const rows = [...study, ...[50, 60, 70, 80, 90].map((p) => row(p))];
  const v = judge({ total_pay_usd: 300, videos: 3, paid_ads: false, usage_forever: false, company_type: "education_study" }, rows)!;
  assert.equal(v.median, 400);
  assert.equal(v.compared_to, "study tools & edtech deals");
  const few = judge({ total_pay_usd: 300, videos: 3, paid_ads: false, usage_forever: false, company_type: "gaming_entertainment" }, rows)!;
  assert.equal(few.compared_to, "UGC deals of every kind");
  assert.match(few.category_note!, /Only 0 scraped gaming/);
});
