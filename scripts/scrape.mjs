// Runs the Apify actors once and saves raw results to data/raw/. Scrape ahead of time, never per scan.
// Run: node --env-file=.env.local scripts/scrape.mjs
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
  upwork: ["neatrat~upwork-job-scraper", {
    query: "UGC video",
    jobType: ["fixed"],
    paymentVerified: true,
    perPage: 50,
    pagesToScrape: 2,
    sort: "newest",
  }],
};

const api = (path, init) =>
  fetch(`https://api.apify.com/v2/${path}`, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } })
    .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(`${path}: ${r.status} ${await r.text()}`))));

async function scrape(name, [actor, input]) {
  let run = (await api(`acts/${actor}/runs`, { method: "POST", body: JSON.stringify(input) })).data;
  console.log(name, "started", run.id);
  while (["READY", "RUNNING"].includes(run.status)) {
    run = (await api(`actor-runs/${run.id}?waitForFinish=60`)).data;
    console.log(name, run.status);
  }
  if (run.status !== "SUCCEEDED") throw new Error(`${name} ${run.status}: see https://console.apify.com/actors/runs/${run.id}`);
  const items = await api(`datasets/${run.defaultDatasetId}/items?clean=true`);
  await writeFile(`data/raw/${name}.json`, JSON.stringify(items, null, 1));
  console.log(name, items.length, "items -> data/raw/" + name + ".json");
}

await mkdir("data/raw", { recursive: true });
const results = await Promise.allSettled(Object.entries(ACTORS).map(([n, a]) => scrape(n, a)));
results.forEach((r) => r.status === "rejected" && console.error(r.reason.message));
