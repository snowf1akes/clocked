// What the scanner looks for. Plain English lists, pasted into the prompts in lib/scan.ts.
// Edit these to change what gets flagged; no other code needs to change.

// Pass 1: terms that are unfair on their face.
export const UNFAIR = [
  "Usage longer than 3-6 months, or forever, perpetual, irrevocable, or 'in perpetuity'",
  "Paid ads, whitelisting, Spark Ads or boosting with no separate fee",
  "AI-generated, digitally altered, synthetic or 'digital replica' versions of the creator's face, voice or likeness",
  "Work made for hire, assignment of copyright, or the brand owning the content outright",
  "Exclusivity longer than the campaign, or covering a whole category (e.g. all beauty brands)",
  "Unlimited revisions, or revisions 'until Brand is satisfied'",
  "Payment later than 30 days after delivery",
  "No kill fee: the brand can cancel after work starts and pay nothing",
  "Raw footage handed over for free",
  "One-sided termination, indemnity or liability (creator pays for the brand's mistakes)",
  "Morals clause the brand alone decides, with clawback of money already paid",
];

// Pass 2: wording that looks standard but can be read against the creator.
export const VAGUE = [
  "A clock that starts on an event the brand controls ('90 days from when Brand first posts', 'after final approval') with no fallback date, so it may never start",
  "Approval or acceptance 'in Brand's sole discretion' with no deadline and no 'deemed approved after X days'",
  "'Including' or 'including but not limited to' where 'limited to' was needed, which turns a short list into everything",
  "'May' where 'shall' was needed, which makes a promise to the creator optional ('Brand may pay a usage fee')",
  "Defined terms that quietly expand: 'Content' covering outtakes or future posts, 'Term' tied to how long the brand uses the content, 'Affiliates' covering every company the parent owns",
  "Two clauses that combine into something worse than either (exclusivity that lasts as long as the usage rights)",
  "'Any media now known or later developed', 'promotional purposes', 'marketing materials' with no channel list",
  "'Reasonable', 'customary' or 'promptly' with no number attached, when the brand decides what it means",
  "A single word that removes a protection: 'irrevocable', 'sublicensable', 'transferable', 'worldwide', 'and/or'",
  "Rights that survive termination ('the license survives any termination of this Agreement')",
  "Payment conditioned on something outside the creator's control (the post's performance, the brand's own approval of results)",
];
