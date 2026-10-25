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
| Find risky clauses in two passes at the same time: (1) the 19 clause types from the v2 scanner spec (AI & alteration, usage & ownership, termination, payment), (2) wording that looks standard but can be read against the creator. Each flag gets a risk level, the creator's clause next to the fewest-words-changed fair version, and replacement wording. The first pass also gives overall risk, Top 3 to fix, missing protections, governing law, a lawyer recommendation and the deal terms | **AI**: two Claude calls, guided by [lib/rubric.ts](lib/rubric.ts) | [lib/scan.ts](lib/scan.ts) |
| Attach real-world case examples, legal notes and community numbers to matching flags | **Code**: looked up by clause type, so the model never writes case details or counts | `annotate` in [lib/scan.ts](lib/scan.ts) |
| Lawyer recommendation | **AI** plus rules in **code** ($5,000+, AI/likeness rights, usage that may never end) | `lawyer` in [lib/scan.ts](lib/scan.ts) |
| Throw away any flag whose quote is not word-for-word in the contract | **Code** | `checkFlags` in [lib/scan.ts](lib/scan.ts) |
| Is the pay fair for what the contract asks? Raymond's Pay Checker method: base range per video (a benchmark group with 15+ prices from 5+ threads, else the default $100–$200) × videos × (1 + uplifts for paid usage, exclusivity, raw footage) = estimated fair range; verdict, a counteroffer, the rights to drop instead, a message to send, and a confidence level. AI rights are never priced | **Code**: plain math, no AI | `judge` in [lib/rate.ts](lib/rate.ts), tested against Raymond's worked example |
| Turn scraped posts and jobs into labeled prices (run once, offline): each price is an ask, an offer or an accepted deal, with the rights it included; advice, influencer posts, hourly and non-USD prices are dropped; max 3 per thread | **AI** extracts, **code** verifies (quote in source, amount in quote) and aggregates into [data/rate_benchmarks.json](data/rate_benchmarks.json) | [scripts/clean.ts](scripts/clean.ts) |
| Scrape the posts and jobs (run once, offline) | Apify actors | [scripts/scrape.mjs](scripts/scrape.mjs) |
| Community Red Flag Radar: classify creators' contract complaints into the same clause types and count them (run once, offline) | **AI** classifies, **code** counts; usernames dropped, no brand names, paraphrased summaries only | [scripts/radar.ts](scripts/radar.ts) → [data/community_signals.json](data/community_signals.json) |

So: deciding **which clauses are risky** is Claude's judgment, guided by the two checklists and checked against the real contract text. Nothing is trained or fine-tuned: to change what gets caught, edit the checklists. Deciding **whether the pay is fair** is code, from scraped data, with the math shown on the page.

## How contracts stay private

| Risk | What Clocked does | File |
|---|---|---|
| Someone else sees your contract | Sign-in with Auth0. Every Convex function checks the caller's token and only reads or deletes rows they own. | [convex/reports.ts](convex/reports.ts) |
| Strangers run up the AI bill | The scan route rejects requests without a valid Auth0 token (checked against Auth0's signing keys). | [app/api/scan/route.ts](app/api/scan/route.ts) |
| Personal details reach the AI or the database | Names, emails, phones, addresses, handles, SSNs, tax IDs and bank/card numbers are replaced with placeholders before Claude reads the text, and the whole report is scrubbed again before saving. | [lib/scrub.ts](lib/scrub.ts) |
| The contract file leaks later | The file is never stored. It lives in memory for one request; only the scrubbed report is saved. Users can delete any report. | [convex/schema.ts](convex/schema.ts) |
| A booby-trapped contract steers the AI | Hidden text is removed in code before Claude sees it. The model has no tools, so text in a contract can't make it do anything. Every flag must quote the real contract. | [api/pdftext.py](api/pdftext.py), [lib/scan.ts](lib/scan.ts) |
| A malicious PDF attacks the server | PDFs are parsed in their own short-lived Python function, separate from the app server that holds the user's session. | [api/pdftext.py](api/pdftext.py) |

Known limits: the scrubber is pattern-based, so a name in running text with no label can slip through. A photo is read by Claude before scrubbing (there's no text to scrub yet); its saved report is scrubbed. Anthropic's API does not train on inputs by default.

## Where to refine (for the legal side)

| What you want to change | Where |
|---|---|
| Clause types: what to look for, default risk level, which case example they show | `CLAUSE_TYPES` in [lib/rubric.ts](lib/rubric.ts) (ids are shared with the Radar, keep them stable) |
| The five protections every contract should have | `REQUIRED_PROTECTIONS` in [lib/rubric.ts](lib/rubric.ts) |
| Case examples and their status (verify each against the docket before the demo) | `CASES` in [lib/rubric.ts](lib/rubric.ts) |
| What counts as vague wording that can be used against the creator ("sole discretion" with no deadline, "including" vs "limited to", clocks the brand controls) | `VAGUE` in [lib/rubric.ts](lib/rubric.ts) |
| How explanations and fair versions are written (plain English, "Do not cite laws or cases") | `COMMON` in [lib/scan.ts](lib/scan.ts) |
| Flag categories (usage, paid_ads, ai_likeness, ownership, exclusivity, revisions, payment, kill_fee, raw_footage, other) | `CATEGORIES` at the top of [lib/scan.ts](lib/scan.ts) |
| Legal notes shown under a flag (today: California AB 2602 and the NO FAKES Act status under AI flags) | `LAW_NOTES` in [lib/rubric.ts](lib/rubric.ts). Fixed text written by us, so the AI never invents a law. |
| The counteroffer email's tone and asks | `counteroffer:` in `SYSTEM_MAIN`, [lib/scan.ts](lib/scan.ts) |
| Company types used for pay comparison | `COMPANY_TYPES` in [lib/rate.ts](lib/rate.ts) |
| Default base range and the uplift table (percentages and sources) | `DEFAULT_BASE` and `UPLIFTS` in [lib/rate.ts](lib/rate.ts) |
| How prices are labeled when extracted | `SYSTEM` in [scripts/clean.ts](scripts/clean.ts) |
| Hand-entered reference figures (Collabstr, Pitchlo) | `reference_figures` in [scripts/clean.ts](scripts/clean.ts) |
| What the scraper searches for | `searches` (Reddit, r/UGCcreators; `reddit_brands` has one search per company type) and `query` (Upwork) in [scripts/scrape.mjs](scripts/scrape.mjs) |
| How prices are read out of posts | The prompt in [scripts/clean.ts:24](scripts/clean.ts) |
| When a benchmark group is used (15+ prices from 5+ threads) | `MIN_N`, `MIN_SOURCES` in [lib/rate.ts](lib/rate.ts) |

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

`.env.local` needs `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_AUTH0_DOMAIN`, `NEXT_PUBLIC_AUTH0_CLIENT_ID` (and `APIFY_TOKEN` only to re-scrape). Run `npx convex dev` alongside `npm run dev`. `npm test` runs the rate math tests. `npm run demo-contract` rebuilds both demo contracts: `public/demo-contract.pdf` (obvious traps, fake personal details, one hidden line) and `public/demo-subtle.pdf` (reads fair; the traps are a few words, explained in comments in [scripts/demo_contract.py](scripts/demo_contract.py)).

## Data

Reddit limits commercial use of its data, so both Reddit pulls are one-time research samples. A real product should get Reddit's permission or rely on in-app red-flag reports from its own users. Usernames are never stored in the published data, and no posts are republished.

`data/community_signals.json`: clause types creators warned each other about in r/UGCcreators over the last 90 days (research sample of 250 posts and comments, October 2026), with paraphrased summaries. Only types with 5+ mentions are kept. Trends are off: the sample is the newest 250 items, so older months are under-sampled and every trend would look like growth.

**Human spot-check (required by the data spec):** `scripts/clean.ts` writes `data/raw/spotcheck.json` (local only; it has quotes and links) with 30 random prices plus every outlier. Check each against its link; 85%+ all-correct means the data can be used. Record the result in `validation` in `data/rate_benchmarks.json`.

`data/rate_benchmarks.json`: per-video price groups by company type × price type × rights included, with n, threads, p25–p75 and whether each group is usable. Today no organic-only group has 15+ prices (posts rarely say a deal was organic-only), so the Pay Checker uses the default $100–$200 range and says so.

`data/rates.json`: the verified prices behind the benchmarks (no quotes, links or names; threads are hashed).
