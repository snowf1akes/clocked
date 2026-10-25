## Inspiration
The first time a brand offered Anna money to make content, she thought it was a scam.

Anna was already a creator, but she had no creator friends to compare notes with. She had no way to check if the offer was real, if the price was fair, or what she would be agreeing to.

A brand deal is a **difficult** second job: reading contracts, negotiating usage rights. A friendly email can carry unfriendly terms. "In perpetuity" means your video works for the brand forever. Broad exclusivity blocks your next deal. An AI-likeness clause decides what a brand can do with your face and voice. A lawyer costs more than the deal, so small creators sign alone.

We built **Clocked** to be the experienced creator friend Anna wished she had: someone who reads the fine print, spots the catch, checks the price, and tells you what to ask for.

Brands clocked your engagement. Now clock their contract.

## What it does
Clocked is an AI contract reviewer and pay checker for UGC creators. 

Here's how it works:

You upload once. Drop in the brand's contract as a PDF, or take a photo of a paper one.

• **Contract X-ray reads every clause twice**. Pass one catches unfair terms (e.g., infinite usage rate, paid ads bundled in for free, AI likeness rights, work-for-hire, no kill fee). Pass two catches subtle wording that looks normal but works against you (e.g  90-day clock that starts only "when Brand first publishes", so it may never start). Every flag shows the brand's exact words next to a fair version, with the changed words highlighted.
• **Rate Check prices the deal against market data we collected and verified with Apify**. It gives a fair range, a counteroffer, and the rights you could drop instead if the budget is fixed. It shows the sample size and a confidence level. 
• Community Red Flag Radar shows which of your flagged clauses creators on r/UGCcreators (**scraped from Apify**) are warning each other about right now.
• Real-world examples attach to matching flags, such as Pujols v. Rainbow USA (AI-made images under an "altered" release) and Holston v. True Nutra (a creator's videos in 12 Meta ads for a brand she never worked with).

**Result**: in about 25 seconds, a creator with no legal background gets an overall risk level, the top 3 things to fix before signing, the standard protections that are missing, how underpaid the offer is in dollars, and the exact words to ask for instead.

Our mascot, Clo, lowers her sunglasses when something needs a second look. Clocked explains contract terms; it is not a law firm.


## How we built it

### System architecture

At a high level, Clocked is a Next.js app on Vercel, a Convex database, Auth0 sign-in, and Claude Opus 5.5 for reading language. Apify powers a research pipeline that runs before a scan. A scan never scrapes anything.

```
BEFORE THE DEMO (run once): market research with Apify

┌──────────────────────────────────────────────────────────────────┐
│ APIFY SCRAPERS                                                   │
│ reddit-scraper-lite ×3 on r/UGCcreators, upwork-job-scraper ×1   │
│ started and polled through the Apify API · 1,050 posts and jobs  │
└───────────────────────────────┬──────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ PII SCRUBBING (code)                                             │
│ usernames, names, emails, phones removed before any AI reads it  │
│ raw posts never leave the laptop                                 │
└───────────────────────────────┬──────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ CLAUDE EXTRACTS PRICES (AI)                                      │
│ reads each post, pulls out every price: creator's ask, brand's   │
│ offer or accepted deal · rights included · brand industry        │
│ 229 prices found                                                 │
└───────────────────────────────┬──────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ CODE FACT-CHECKS                                                 │
│ quoted words must be in the post · number must be in the quote   │
│ no hourly, non-USD or influencer prices · max 3 per thread       │
│ 110 thrown out, each with a recorded reason                      │
└───────────────────────────────┬──────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ MARKET BENCHMARKS (two small JSON files in the app)              │
│ 119 verified prices from r/UGCcreators and Upwork                │
│ + 4 community warning signals · no quotes, links or names        │
└──────────────────────────────────────────────────────────────────┘

DURING A SCAN (every time, about 25 seconds)

┌──────────────┐  PDF + token   ┌──────────────────────────────────┐
│ BROWSER      │───────────────►│ /api/scan  (Vercel, Node)        │
│ Next.js page │◄───────────────│                                  │
└──────┬───────┘    report      │ 1 check the sign-in token        │
       │                        │ 2 count scan, max 20/day ──► Convex: usage
       │ token, kept in memory  │ 3 read PDF, strip hidden ──► /api/pdftext (Py)
┌──────┴───────┐                │ 4 remove personal details        │
│ AUTH0        │                │ 5 Claude pass 1: unfair terms  ┐ in parallel
│ sign-in, JWT │                │   Claude pass 2: vague wording ┘ (JSON, no tools)
└──────────────┘                │ 6 fact-check: flags must quote   │
                                │   the contract                   │
                                │ 7 attach real cases, price the   │
                                │   deal (code, 11 tests)          │
                                │ 8 save scrubbed report ──► Convex: reports
                                └──────────────────────────────────┘  (owner-scoped;
                                          ▲                           auto-deletes 1 week
                                          │ market benchmarks         after contract ends)
                                          └── benchmarks from the Apify research

The contract file is never stored. Claude sees only visible, scrubbed text
and has no tools. Code rejects any flag whose quote is not in the contract.
```

(The same diagram as a picture is docs/architecture.png in the repo and in the gallery.)

### Tech stack

Sponsor technologies first.

- **Apify** (market research): `reddit-scraper-lite` and `upwork-job-scraper` actors, started and polled through the Apify REST API. 4 runs, 1,050 posts and job posts. Powers an automated research pipeline: scrape → PII scrubbing → AI price extraction → code fact-check → market benchmarks.
- **Convex** (database and live backend): per-user reports with owner-scoped functions, a daily scan quota, a live-updating scan list, and an hourly cron that auto-deletes expired reports.
- **Anthropic Claude Opus 5.5** (the AI layer): a multi-pass AI workflow. Two structured-output passes per contract run in parallel (unfair terms, then vague wording), tool-free by design, with every answer fact-checked by code. Offline, the same model extracts prices and classifies community complaints.
- **Auth0** (sign-in): JWT-based sign-in, tokens kept in memory, verified server-side against Auth0's JWKS with `jose`.
- **Next.js 16 + React 19 + TypeScript** on **Vercel**: one page with three views; a Node function runs the scan and a Python function (PyMuPDF) reads PDFs and detects hidden text.
- **Deterministic verification layer** (our code): hidden-text stripping, PII scrubbing, quote-in-contract checks, case lookup by clause type, and a pure-math Pay Checker with 11 tests. The model reads language; code decides numbers and rules.

### Apify: how we built the market data

Nobody publishes UGC rates, so we built the dataset.

1. **Collect.** Our script starts each Apify actor through the Apify API, polls it every 15 seconds, and downloads the results. Four runs: rate questions on r/UGCcreators (300 items), one search per brand industry (400), contract complaints for the Radar (250), and Upwork UGC job posts from payment-verified brands (100).
2. **Scrub.** Code removes usernames, names, emails and phone numbers before any post reaches the AI.
3. **Extract.** Claude reads each post and returns one record per price: the quoted words, the amount, whether it is a creator's ask, a brand's offer or an accepted deal, the rights included, and the brand's industry.
4. **Fact-check.** Code drops a price unless its quoted words appear in the post and the amount appears in the quote. It also drops hourly, non-USD, influencer and advice prices, and keeps at most 3 prices per thread.
5. **Group.** Asks, offers and accepted deals stay in separate groups, and so do rights bundles: \$150 for an organic video is never compared with \$150 for a video plus a year of paid ads. A group is used for pricing only with 15 or more prices from 5 or more threads.

**Result:** 780 recent items, 229 prices extracted, 119 verified. Each of the 110 dropped prices has a recorded reason. The Radar sorted 250 complaints into our 19 clause types and kept the 4 with 5 or more mentions: perpetual usage (15), paid ads bundled in (14), performance pay with no minimum (8), raw footage (7). The published files contain no post text, links or usernames.

### AI workflow

Clocked is a chain of narrow model calls. Each call has a fixed output format, and code checks each output before the next step.

1. **PDF reader (code).** PyMuPDF reads each text span with its color, size and position. White, under-3-point or off-page text is marked hidden and never reaches the model.
2. **Scrubber (code).** Names, emails, phones, addresses, handles, SSNs and bank numbers become placeholders.
3. **Pass 1, unfair terms (Claude).** Flags against 19 clause types. Also returns the overall risk, the top 3 fixes, the missing protections, and the deal terms used for pricing.
4. **Pass 2, vague wording (Claude).** Reads each definition, deadline and condition for small wording with large consequences. Runs in parallel with pass 1.
5. **Fact-checker (code).** Drops any flag whose quote is not in the contract word for word. Attaches the lawsuit and legal note for that clause type. The model never writes a case or a statistic, so it cannot invent one.
6. **Pay Checker (code, 11 tests).** Fair range = base rate per video × videos × (1 + uplifts for the rights the contract takes). Then the verdict, a counteroffer, the rights to drop instead, and a one-sentence message to send.

### Legal fine-tuning

We did not fine-tune a model. We tuned a rubric that our law student can edit in one file:

- 19 clause types in 4 categories. Each has trigger language, a default risk level and a real case.
- 5 protections checked in every contract: usage end date, payment date, AI clause, creator approval before publishing, kill fee.
- 12 vague-wording patterns, such as a clock the brand controls, or "may" where "shall" was needed.
- Lawyer escalation in code: deals of \$5,000 or more, any AI or likeness grant, usage with no end date.
- Pay uplifts from practitioner data: paid usage +20 to 50%, perpetual use or ownership +50 to 100%, exclusivity +30 to 50%, raw footage +30 to 50%.

### Security

- **One user reads another user's report.** Every Convex function checks the sign-in token and reads only that user's rows.
- **Strangers use our AI budget.** The server checks the token. Each user gets 20 scans per day. The PDF function answers only requests with a secret header.
- **Prompt injection in the PDF.** Hidden text is removed before the model reads. The model has no tools. Each flag must quote the real contract.
- **Personal data reaches the model or the database.** Scrubbed before Claude, and again before saving.
- **A stored contract leaks.** The file is never stored. A report deletes itself one week after the contract ends.

## Challenges we ran into

- The venue network kept resetting Apify's long polls mid-run. We switched to short polls with retries.
- Reddit restricts commercial use of its data, so our pull is a one-time research sample with usernames dropped. In-app anonymous reports are designed to replace it.
- Scraped prices lie by omission. Posts almost never say a deal was "organic only", so that group is too thin and the Pay Checker falls back to a default range and says so. Honest thin data beats a confident wrong number.
- The Radar's trend numbers looked great ("perpetual usage up 275%") and were fake: our sample over-represents recent months. We turned trends off.

## Accomplishments that we're proud of

- 1,050 scraped items turned into 119 prices we would defend in front of a judge: labeled by type and rights, verified against the source by code, stripped of anything personal.
- A contract that reads fair to a human and still gets 7 planted traps caught by the second pass, including a 90-day clock that never starts.
- Zero invented citations by design: the model picks a clause type, code attaches the case.
- A pay checker that reproduces our law student's worked example to the dollar.
- Clo, who lowers her sunglasses at the fine print.

## What we learned

A creator's ability to make great content does not come with the knowledge to run the business around it.

Useful AI has to show its reasoning. A flag is worth more when the creator can see the clause, the fair version beside it, and the lawsuit where that wording was fought over. A rate is worth more when it says "based on 22 brand offers, confidence medium" than when it just sounds sure.

Scraping was the easy part. Making scraped numbers safe to negotiate real money on took most of the pipeline.

## What's next for Clocked

- **In-app rate reports:** after a check, ask "what did you end up getting paid?", anonymously, with the rights already extracted. Over time this replaces Reddit.
- **Deal Inbox:** turn brand emails into a pipeline, so Clo catches the contract before you open it.
- **Weekly Apify refresh** with a human spot-check gate before any new data goes live.
