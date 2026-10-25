# Clocked

UGC creators sign brand deals full of clauses they don't notice (forever usage, free paid-ad rights, AI copies of their face) and don't know what to charge. Clocked scans the contract, explains each risky clause in plain English, checks the pay against real creator rates, and drafts a counteroffer.

Built at Cal Hacks 13.0. Explains contract terms; not legal advice.

## How a scan works

```
contract PDF ──► api/pdftext.py ──► visible text ──► Claude ──► flags + offer terms ──► code checks ──► report
                 (code)             (hidden text      (AI)                             (code)
                                     removed here)
photo ─────────────────────────────────────────────► Claude reads the photo too
```

| Step | AI or code? | File |
|---|---|---|
| Find hidden text (white, under 3 pt, off the page) and remove it before Claude sees it | **Code** (PyMuPDF). No AI. | [api/pdftext.py](api/pdftext.py) |
| Find risky clauses, explain them, pull out the deal terms (pay, videos, usage, paid ads, AI rights, payment days, kill fee) | **AI**: one Claude call | [lib/scan.ts](lib/scan.ts) |
| Throw away any flag whose quote is not word-for-word in the contract | **Code** | `checkFlags` in [lib/scan.ts](lib/scan.ts) |
| Is the pay a lowball? Percentile, median, fair range, "underpays you by $X" | **Code**: plain math, no AI | `judge` in [lib/rate.ts](lib/rate.ts) |
| Turn scraped Reddit posts and Upwork jobs into per-video prices (run once, offline) | **AI** reads the messy posts, **code** keeps a row only if its quote is really in the post | [scripts/clean.ts](scripts/clean.ts) |
| Scrape the posts and jobs (run once, offline) | Apify actors | [scripts/scrape.mjs](scripts/scrape.mjs) |

So: deciding **which clauses are risky** is Claude's judgment, guided by the checklist in the prompt and checked against the real contract text. Deciding **whether the pay is fair** is code, from scraped data, with the math shown on the page.

## Where to refine (for the legal side)

| What you want to change | Where |
|---|---|
| What counts as a red flag, and the thresholds (e.g. "usage longer than 3-6 months", "payment later than 30 days") | The `Watch for:` list in the prompt, [lib/scan.ts:49](lib/scan.ts) |
| How explanations are written (plain English, no legal words, "Do not cite laws or cases") | Same prompt, [lib/scan.ts:45-61](lib/scan.ts) |
| Flag categories (usage, paid_ads, ai_likeness, ownership, exclusivity, revisions, payment, kill_fee, raw_footage, other) | `CATEGORIES` at the top of [lib/scan.ts](lib/scan.ts) |
| Legal notes shown under a flag (today: California AB 2602 under AI-likeness flags) | `LAW_NOTE` in [app/page.tsx:30](app/page.tsx). These are fixed text written by us, so the AI never invents a law. |
| The counteroffer email's tone and asks | `counteroffer:` in the prompt, [lib/scan.ts:61](lib/scan.ts) |
| What the scraper searches for | `searches` (Reddit, r/UGCcreators) and `query` (Upwork) in [scripts/scrape.mjs:10-20](scripts/scrape.mjs) |
| How prices are read out of posts | The prompt in [scripts/clean.ts:24](scripts/clean.ts) |
| Which deals set the fair rate (today: creator-reported rates; Upwork brand posts shown only as context) | [app/api/scan/route.ts:63](app/api/scan/route.ts) |
| How many deals must state a usage add-on before it is priced (today: 5) | `MIN_ADDON_ROWS` in [lib/rate.ts:29](lib/rate.ts) |

After changing the scrape or clean prompts, rebuild the data:

```bash
node --env-file=.env.local scripts/scrape.mjs
node --env-file=.env.local scripts/clean.ts
```

## Run locally

```bash
npm install
pip install -r requirements.txt
npm run dev
```

`.env.local` needs `ANTHROPIC_API_KEY` (and `APIFY_TOKEN` only to re-scrape). `npm test` runs the rate math tests. `npm run demo-contract` rebuilds `public/demo-contract.pdf`, the demo contract with planted traps and one hidden line.

## Data

`data/rates.json`: per-video prices from r/UGCcreators posts and comments and Upwork "UGC video" jobs, scraped with Apify in October 2026. Each row keeps the exact quote and URL it came from.
