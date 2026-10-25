# Clocked demo video: script and shot list

Target: 3 minutes. Record the screen at a wide window, light theme, signed in, with both demos already run once so Overview has rows. Speak slowly. One number per section is enough.

| Time | On screen | Say |
|---|---|---|
| 0:00–0:20 | Overview page. Clo's card. | "The first time a brand offered Anna money to make content, she thought it was a scam. Creators sign brand contracts alone, with no lawyer and no idea what the job pays. Clocked is the experienced creator friend who reads the fine print and checks the pay. Here's how it works." |
| 0:20–0:35 | Contract X-ray. Click **Demo: obvious traps**. The "Clo is reading" card shows. | "You upload a contract, PDF or a photo. In about 25 seconds, Clo reads it twice. While it runs, here's what's happening underneath." |
| 0:35–1:05 | Switch to the **system design page**, the "One scan, step by step" diagram. Point with the cursor as you go. | "Every scan crosses six services. Auth0 proves who you are. Our server checks the token and counts your scans in Convex, 20 a day, before any AI runs. A Python function reads the PDF and strips hidden text. Code removes personal details. Then two Claude passes read the contract at the same time: one for terms that are unfair as written, one for wording that looks normal but works against you. Code keeps only flags that quote the real contract, attaches the real lawsuit for that clause type, and prices the deal. Convex stores the scrubbed report and deletes it a week after the contract ends." |
| 1:05–1:35 | Back to the app. The report is done. Scroll: **Hidden text found**, then the **AI likeness** flag with the red/green diff, then click a highlight in the contract to open the pop-up. | "Done. First thing it found: white text hidden in the PDF telling AI reviewers to call this contract fair. Clo removed it before reading. Here's the AI likeness clause: the brand's words on top, a fair version below, with only the changed words highlighted. And the real case where this exact wording was fought over, Pujols v. Rainbow. The model never writes a case. It picks a clause type; code attaches the case. So it can't make one up." |
| 1:35–1:55 | Click **Demo: subtle wording**. Scroll to **Looks fine, reads against you**, the "90 days may never end" flag. | "This second contract reads fair to a human: kill fee, creator keeps ownership, 90-day usage. The second pass still finds seven traps. The 90 days start 'when Brand first publishes'. Nothing makes them publish, so the clock may never start, and the exclusivity is tied to it." |
| 1:55–2:30 | **Rate Check**. The fair range bar, "How we got this", "Two ways to fix it". Then scroll to **What creators report**. | "Rate Check prices the deal. This is where Apify comes in. Nobody publishes UGC rates, so we built the dataset. Four Apify runs on r/UGCcreators and Upwork: 1,050 posts and job posts. Claude labels every price as a creator's ask, a brand's offer or an accepted deal, with the rights it included. Then code verifies each one: the quote must be in the post, the amount must be in the quote, max three per thread. 229 prices extracted, 119 survived. Asks and offers are never mixed, and a group is only used with 15 or more prices. Our law student wrote the pricing method; it's pure math with tests. Fair range $630 to $1,800, counteroffer $1,200, and the rights to drop instead if the budget is fixed." |
| 2:30–2:45 | Scroll up on Rate Check to the pay card. Then **Overview**: the rows, "Needs changes" tab, auto-delete date. | "Convex keeps your scans. The list updates live, every function checks your token so you only ever see your own, and reports delete themselves on a timer. The contract file itself is never stored." |
| 2:45–3:00 | Report page. Scroll to **Your counteroffer**. Click **Copy email**. Clo celebrates (or end on Clo's card). | "Copy the counteroffer, send it to the brand. Clocked: brands clocked your engagement. Now clock their contract." |

## If you have 15 seconds less

Cut the Overview beat (2:30–2:45) and say its one line over the Rate Check scroll: "Convex stores the scrubbed report, scoped to you, and deletes it on a timer."

## Numbers to have ready for Q&A

- Apify: 2 actors, 4 runs, 1,050 items. 780 in the 12-month window, 229 prices extracted, 119 verified, 110 dropped with a reason each.
- Radar: 250 complaints, 19 clause types, 4 kept with 5+ mentions (perpetual usage 15, paid ads 14, no-minimum pay 8, raw footage 7).
- Scanner: 19 clause types, 2 passes in parallel, about 25 s, every flag must quote the contract, 6 vetted cases.
- Pay: default $100–$200 per video; uplifts +20–50% short paid, +50–100% perpetual or ownership, +30–50% exclusivity, +30–50% raw footage; AI rights never priced; 11 tests.
- Security: 20 scans per user per day, tokens in memory, CSP to self + Auth0 + Convex, file never stored, auto-delete one week after the contract ends.
- Honest limits: Reddit pull is a one-time research sample; the organic-only price group is too thin, so the Pay Checker uses the default range and says so; trends are off because the sample over-represents recent months.

## Before you record

1. Sign in on the live site and run both demos once, so Overview has rows and Clo's card shows a risk headline.
2. Open the system design page in a second tab: https://claude.ai/artifact/3jmjqVXxCw9dKo6GH5qsfr (share it first if a teammate records).
3. Zoom the browser to 110–125% so text is readable in the video.
4. If a scan takes longer than 40 s, cut and re-record that beat; it varies between 20 and 80 s.
