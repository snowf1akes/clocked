// What the scanner looks for, and the legal context it may cite. Written for the legal side to edit.
// Source: ugc_contract_scanner_prompt_v2 (clause types, cases, legal context). The model only picks a
// clause_type; code attaches the case and legal note below, so the model never writes case details itself.

export const CATEGORIES = ["ai_alteration", "usage_ownership", "termination_status", "payment_liability"] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABEL: Record<Category, string> = {
  ai_alteration: "AI & alteration",
  usage_ownership: "Usage & ownership",
  termination_status: "Termination & status",
  payment_liability: "Payment & liability",
};

export const RISKS = ["critical", "high", "medium", "low"] as const;
export type Risk = (typeof RISKS)[number];

type ClauseType = { id: string; category: Category; risk: Risk; name: string; lookFor: string; case?: CaseId };

// id is shared with the Community Red Flag Radar (scripts/radar.ts). Keep ids stable.
export const CLAUSE_TYPES = [
  { id: "broad_alter_language", category: "ai_alteration", risk: "critical", name: "Broad alter / transform / modify language",
    lookFor: "alter, modify, transform, distorted, composite, derivative works, any changes, without restriction, in any manner, edit as it sees fit, adapt, manipulate. Written for photo edits, now argued to cover AI-made poses, scenes or words", case: "pujols" },
  { id: "ai_rights", category: "ai_alteration", risk: "critical", name: "Explicit AI usage or training rights",
    lookFor: "artificial intelligence, AI, machine learning, generative, train, training data, synthetic, digital replica, digital double, avatar, voice clone, likeness model, automated tools, any technology now known or hereafter developed", case: "mendelson" },
  { id: "vague_edits", category: "ai_alteration", risk: "high", name: "Vague edits clause without creator approval",
    lookFor: "reasonable edits, minor edits, Brand may edit or revise, feedback rounds without creator approval before publishing. 'Edits' is undefined, so the brand decides", case: "tranchin" },
  { id: "missing_ai_protection", category: "ai_alteration", risk: "high", name: "No AI protection (flag when absent)",
    lookFor: "the contract grants usage or editing rights but says nothing about AI; ad platforms' automatic enhancement tools can also alter content", case: "amador" },
  { id: "perpetual_usage", category: "usage_ownership", risk: "critical", name: "Perpetual or undefined usage term",
    lookFor: "in perpetuity, perpetual, forever, irrevocable, for all time, indefinitely, universal usage, unlimited usage, or no end date", case: "pujols" },
  { id: "paid_ads_bundled", category: "usage_ownership", risk: "high", name: "Paid ads / whitelisting bundled in",
    lookFor: "paid media, paid social, advertising, boost, promote, whitelisting, Spark Ads, partnership ads, dark posts, all media, any media, all channels", case: "amador" },
  { id: "broad_media_territory", category: "usage_ownership", risk: "medium", name: "Media and territory scope",
    lookFor: "all media now known or hereafter devised, worldwide, any platform, including but not limited to" },
  { id: "ownership_transfer", category: "usage_ownership", risk: "critical", name: "Ownership transfer / work for hire",
    lookFor: "work made for hire, assigns all rights title and interest, Brand shall own, copyright transfers, exclusive license" },
  { id: "sublicensing", category: "usage_ownership", risk: "high", name: "Sublicensing / transfer to third parties",
    lookFor: "sublicense, assign, affiliates, partners, third parties, successors", case: "holston" },
  { id: "exclusivity", category: "usage_ownership", risk: "high", name: "Exclusivity / non-compete",
    lookFor: "exclusive, shall not promote, competitor, category, non-compete, and how long it lasts" },
  { id: "one_sided_termination", category: "termination_status", risk: "high", name: "One-sided termination",
    lookFor: "Brand may terminate at any time, for any reason, at Brand's sole discretion, with no equal right for the creator" },
  { id: "morality_clause", category: "termination_status", risk: "high", name: "Morality / brand-image clause",
    lookFor: "conduct, reputation, brand image, values, disrepute, controversy, morality", case: "earle" },
  { id: "kill_fee_missing", category: "termination_status", risk: "medium", name: "No kill fee",
    lookFor: "the brand can cancel after work starts and pay nothing, or only after delivery" },
  { id: "unsigned_agreement", category: "termination_status", risk: "high", name: "Unsigned or informal agreement",
    lookFor: "deal only in emails or DMs, the brand hasn't signed, or key terms missing", case: "earle" },
  { id: "late_payment", category: "payment_liability", risk: "high", name: "Late payment terms",
    lookFor: "Net 60, Net 90, upon approval, upon campaign completion, upon receipt of client payment" },
  { id: "unlimited_revisions", category: "payment_liability", risk: "medium", name: "Unlimited revisions",
    lookFor: "until Brand is satisfied, as many revisions as Brand requests" },
  { id: "one_way_indemnity", category: "payment_liability", risk: "high", name: "One-way indemnification",
    lookFor: "creator covers the brand's legal costs but not the other way around" },
  { id: "raw_footage", category: "payment_liability", risk: "medium", name: "Raw footage handed over",
    lookFor: "brand gets all raw or unused footage, usually for no extra fee" },
  { id: "no_minimum_pay", category: "payment_liability", risk: "medium", name: "Performance pay with no minimum",
    lookFor: "pay depends on views or sales with no guaranteed base" },
] as const satisfies readonly ClauseType[];

export const CLAUSE_IDS: [string, ...string[]] = ["other", ...CLAUSE_TYPES.map((c) => c.id)];
export type ClauseId = (typeof CLAUSE_TYPES)[number]["id"] | "other";

// The five protections every contract should have. The scanner lists the missing ones.
export const REQUIRED_PROTECTIONS = [
  "Usage end date",
  "Payment date and trigger",
  "AI / alteration clause",
  "Creator approval before publishing",
  "Kill fee",
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
  "A deal memo or email that promised less than the contract takes (e.g. 14 days of exclusivity in the memo, the full term in the contract)",
];

// Real disputes, shown under matching flags. Allegations unless a court ruled. Status as of October 2026;
// verify each against the docket before relying on it.
export type CaseId = "pujols" | "tranchin" | "amador" | "holston" | "earle" | "mendelson";
export const CASES: Record<CaseId, string> = {
  pujols:
    "Pujols v. Rainbow USA (N.Y. Sup. Ct., No. 157543/2026, pending): a model's release let her images be \"distorted in character or form, cropped or altered.\" The brand argues that covers AI-made images of poses she never did; she also alleges use continued after the contract expired.",
  tranchin:
    "Tranchin v. Empowered By You (N.D. Cal., dismissed without prejudice Aug. 2026): a UGC creator alleged the brand posted an AI-altered video of her. The dispute turned on whether she had final approval of edits.",
  amador:
    "Amador v. Pin Trading App (C.D. Cal., filed Oct. 2026, pending): the creator's terms excluded AI changes and required separate approval for paid ads. A paid Facebook ad allegedly altered her skin tone; the brand blamed Meta's automatic tools.",
  holston:
    "Holston v. R5 Brands / True Nutra (W.D.N.C., No. 3:26-cv-00856, filed Oct. 2026, pending): videos a creator made for one brand allegedly ran in at least 12 Meta ads for a different brand she never worked with.",
  earle:
    "Earle v. Gymshark (High Court of England, settled): the creator alleged the brand ended a deal of about $1M early over posts that were public before the deal; the brand said no contract was signed.",
  mendelson:
    "Reported by Bloomberg Law (July 2026), no lawsuit: a beauty creator was offered a contract allowing any AI use of her content, forever, and was told it was \"industry standard.\" She declined.",
};

// Legal context shown under matching flags. Written by us, never by the model.
export const LAW_NOTES: Partial<Record<ClauseId, string>> = {
  ai_rights:
    "California's AB 2602 (Labor Code § 927, in effect since 2025) can make a digital-replica clause unenforceable when the uses aren't reasonably specific and you had no lawyer or union. The federal NO FAKES Act is not law yet. Ask a lawyer before relying on either.",
  broad_alter_language:
    "California's AB 2602 (Labor Code § 927) may apply if this wording is used to create a digital replica of you. Ask a lawyer before relying on it.",
};

export function caseFor(id: string): string | null {
  const c = CLAUSE_TYPES.find((t) => t.id === id);
  return c && "case" in c ? CASES[c.case as CaseId] : null;
}

export function categoryFor(id: string): Category | null {
  return CLAUSE_TYPES.find((t) => t.id === id)?.category ?? null;
}
