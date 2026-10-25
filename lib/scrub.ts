// Removes personal details from contract text before Claude reads it and before anything is saved.
// Brand and company names stay: the report needs them, and they are not the creator's personal info.
// ponytail: regex only (from pip's redactor, plus contract labels); unlabeled names in running text slip
// through. Add an NER pass (Presidio) if real contracts show misses.

type Rule = [kind: string, re: RegExp, to: string];

const NAME = "[A-Z][a-z'’-]+(?: [A-Z]\\.?)?(?: [A-Z][a-z'’-]+){1,2}";
// Jane Doe ("Creator")  /  Jane Doe (the "Influencer")
const PARTY = `${NAME}(?=\\s*\\((?:the\\s+)?["“]?(?:Creator|Influencer|Talent|Contractor|Content Creator)\\b)`;

const RULES: Rule[] = [
  ["email", /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[EMAIL]"],
  ["ssn", /(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/g, "[SSN]"],
  ["tax id", /\b(?:EIN|TIN|tax id(?:entification)?(?: number)?)\s*[:#]?\s*\d{2}-?\d{7}\b/gi, "[TAX ID]"],
  ["bank", /\b(?:account|acct|routing|iban|swift)\s*(?:number|no\.?|#)?\s*[:#]?\s*[A-Z0-9][A-Z0-9 -]{5,30}\d/gi, "[BANK]"],
  // 13 to 19 digits, spaces or dashes allowed between them: card numbers. Before phone.
  ["card", /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g, "[CARD]"],
  ["phone", /(?<!\d)(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}(?!\d)/g, "[PHONE]"],
  ["address", /\b\d{1,5}\s+(?:[A-Za-z0-9]+\s+){1,3}(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place)\b\.?(?:,?\s*(?:apt|unit|suite|#)\.?\s*\w+)?/gi, "[ADDRESS]"],
  ["date of birth", /\b(?:date of birth|DOB|born)\s*[:\-]?\s*[A-Za-z0-9,\/ .-]{6,20}\d/gi, "[DATE OF BIRTH]"],
  ["handle", /(?<![\w@])@[A-Za-z0-9_.]{2,30}\b/g, "[HANDLE]"],
  ["name", new RegExp(PARTY, "g"), "[NAME]"],
  // Creator: Jane Doe   /   Print name: Jane Doe
  ["name", new RegExp(`(?<=\\b(?:Creator|Influencer|Talent|Contractor|Name|Print(?:ed)? name|Legal name|Signed|Attn)\\s*(?:name)?\\s*[:\\-]\\s*)${NAME}`, "g"), "[NAME]"],
];

export type Removed = Record<string, number>;

export function scrub(text: string): { text: string; removed: Removed } {
  const removed: Removed = {};
  let out = text;
  for (const [kind, re, to] of RULES) {
    out = out.replace(re, () => {
      removed[kind] = (removed[kind] ?? 0) + 1;
      return to;
    });
  }
  // a name found once is removed everywhere it appears, labeled or not
  for (const name of new Set(text.match(new RegExp(PARTY, "g")) ?? [])) {
    out = out.replaceAll(name, () => {
      removed.name = (removed.name ?? 0) + 1;
      return "[NAME]";
    });
  }
  return { text: out, removed };
}

// Scrubs every string inside a value (used on the whole report before it is saved).
export function scrubDeep<T>(value: T): T {
  if (typeof value === "string") return scrub(value).text as T;
  if (Array.isArray(value)) return value.map(scrubDeep) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubDeep(v)])) as T;
  }
  return value;
}
