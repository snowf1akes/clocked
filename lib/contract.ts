// The contract as readable clauses, and where each flag's quote sits in it.
// PDF text keeps the PDF's line breaks, so wrapped lines are joined back into clauses first.

export type Block = { start: number; end: number; heading: boolean };
export type Span = { start: number; end: number; i: number };
export type Piece = { text: string; i: number | null };

const CLAUSE = /^(\d+(\.\d+)*\.?|\([a-z0-9]{1,3}\)|[a-z]\))\s/i; // "4.1. ", "(a) ", "b) "
const HEADING = /^[^a-z]*[A-Z]{3}[^a-z]*$/; // no lowercase letters: "5. EXCLUSIVITY"

// Starts a new block at a blank line, a clause number or a heading; joins every other line to the one before.
export function reflow(text: string): { doc: string; blocks: Block[] } {
  const parts: { text: string; heading: boolean }[] = [];
  let fresh = true;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      fresh = true;
      continue;
    }
    const heading = line.length <= 80 && HEADING.test(line);
    const last = parts.at(-1);
    if (fresh || !last || last.heading || heading || CLAUSE.test(line)) parts.push({ text: line, heading });
    else last.text += " " + line;
    fresh = false;
  }
  const blocks: Block[] = [];
  let at = 0;
  for (const p of parts) {
    blocks.push({ start: at, end: at + p.text.length, heading: p.heading });
    at += p.text.length + 1;
  }
  return { doc: parts.map((p) => p.text).join("\n"), blocks };
}

// Same tolerance as checkFlags in lib/scan.ts: any case, curly or straight quotes, any whitespace between words.
const word = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['‘’]/g, "['‘’]").replace(/["“”]/g, '["“”]');
export function locate(doc: string, quote: string): [number, number] | null {
  const words = quote.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const m = new RegExp(words.map(word).join("\\s+"), "i").exec(doc);
  return m ? [m.index, m.index + m[0].length] : null;
}

// One highlight per flag found, in reading order. Where two flags overlap, the earlier one keeps the shared words.
export function spans(doc: string, quotes: string[]): Span[] {
  const found = quotes
    .map((q, i) => {
      const r = locate(doc, q);
      return r ? { start: r[0], end: r[1], i } : null;
    })
    .filter((x): x is Span => x !== null)
    .sort((a, b) => a.start - b.start);
  const out: Span[] = [];
  for (const s of found) {
    const last = out.at(-1);
    if (last && s.start < last.end) {
      if (s.end <= last.end) continue;
      s.start = last.end;
    }
    out.push(s);
  }
  return out;
}

// Each block cut into plain text and highlighted pieces. A highlight that crosses blocks is cut at the break.
export function segments(doc: string, blocks: Block[], hits: Span[]): Piece[][] {
  return blocks.map((b) => {
    const out: Piece[] = [];
    let at = b.start;
    for (const h of hits) {
      if (h.end <= b.start || h.start >= b.end) continue;
      const a = Math.max(h.start, b.start);
      const z = Math.min(h.end, b.end);
      if (a > at) out.push({ text: doc.slice(at, a), i: null });
      out.push({ text: doc.slice(a, z), i: h.i });
      at = z;
    }
    if (at < b.end) out.push({ text: doc.slice(at, b.end), i: null });
    return out;
  });
}
