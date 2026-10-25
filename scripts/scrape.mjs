// Runs the Apify actors once and saves raw results to data/raw/. Scrape ahead of time, never per scan.
// Run: node --env-file=.env.local scripts/scrape.mjs [name ...]   (no names = all)
import { mkdir, writeFile } from "node:fs/promises";

const TOKEN = process.env.APIFY_TOKEN;
if (!TOKEN) throw new Error("Put APIFY_TOKEN in .env.local");

const ACTORS = {
  reddit: ["trudax~reddit-scraper-lite", {
    searches: ["rate per video", "how much do you charge", "brand offered", "usage rights", "lowball", "whitelisting fee"],
    searchCommunityName: "UGCcreators",
    searchPosts: true,
    searchComments: true,
    sort: "relevance",
    time: "year",
    maxItems: 300,
    includeNSFW: false,
  }],
  // rates by the kind of company asking, so a skincare offer is compared to skincare deals
  reddit_brands: ["trudax~reddit-scraper-lite", {
    searches: [
      "skincare brand paid", "beauty brand rate", "app UGC rate", "tech brand UGC paid", "AI tool UGC",
      "study app UGC", "edtech UGC", "food brand UGC rate", "beverage brand paid", "fashion brand UGC rate",
      "supplement brand UGC", "fitness brand paid", "fintech UGC", "gaming UGC rate", "home brand UGC paid",
    ],
    searchCommunityName: "UGCcreators",
    searchPosts: true,
    searchComments: true,
    sort: "relevance",
    time: "year",
    maxItems: 400,
    includeNSFW: false,
  }],
  // Community Red Flag Radar: one small research pull of creators discussing contract terms.
  // Reddit limits commercial use of its data, so this stays a one-time research sample.
  radar: ["trudax~reddit-scraper-lite", {
    searches: [
      "contract", "usage rights", "in perpetuity", "universal usage", "whitelisting", "spark ads",
      "AI likeness", "exclusivity", "red flag", "net 60", "net 90", "kill fee", "unlimited revisions",
      "didn't pay", "raw footage", "work for hire",
    ],
    searchCommunityName: "UGCcreators",
    searchPosts: true,
    searchComments: false,
    sort: "new",
    time: "year",
    maxItems: 250,
    includeNSFW: false,
  }],
  upwork: ["neatrat~upwork-job-scraper", {
    query: "UGC video",
    jobType: ["fixed"],
    paymentVerified: true,
    perPage: 50,
    pagesToScrape: 2,
    sort: "newest",
  }],
};

// Short requests with retries: long-held connections get reset on some networks.
async function api(path, init, tries = 4) {
  try {
    const r = await fetch(`https://api.apify.com/v2/${path}`, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } });
    if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
    return r.json();
  } catch (e) {
    if (tries <= 1 || String(e).includes(": 4")) throw e;
    await new Promise((ok) => setTimeout(ok, 3000));
    return api(path, init, tries - 1);
  }
}

async function scrape(name, [actor, input]) {
  let run = (await api(`acts/${actor}/runs`, { method: "POST", body: JSON.stringify(input) })).data;
  console.log(name, "started", run.id);
  while (["READY", "RUNNING"].includes(run.status)) {
    await new Promise((ok) => setTimeout(ok, 15000));
    run = (await api(`actor-runs/${run.id}`)).data;
    console.log(name, run.status);
  }
  if (run.status !== "SUCCEEDED") throw new Error(`${name} ${run.status}: see https://console.apify.com/actors/runs/${run.id}`);
  const items = await api(`datasets/${run.defaultDatasetId}/items?clean=true`);
  await writeFile(`data/raw/${name}.json`, JSON.stringify(items, null, 1));
  console.log(name, items.length, "items -> data/raw/" + name + ".json");
}

await mkdir("data/raw", { recursive: true });
const only = process.argv.slice(2);
const chosen = Object.entries(ACTORS).filter(([n]) => !only.length || only.includes(n));
const results = await Promise.allSettled(chosen.map(([n, a]) => scrape(n, a)));
results.forEach((r) => r.status === "rejected" && console.error(r.reason.message));
