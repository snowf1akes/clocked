import { test } from "node:test";
import assert from "node:assert/strict";
import { locate, reflow, segments, spans } from "./contract.ts";

// Shaped like PyMuPDF output for the VitaPeak test contract: wrapped lines, trailing spaces, curly quotes.
const PDF = `BRAND AMBASSADOR PROGRAM TERMS
4. USE OF CONTENT
4.1. VitaPeak may use Ambassador’s Content, name and likeness on its website, social media
accounts, emails and advertisements.
5. EXCLUSIVITY
5.1. During participation in the Program and for six (6) months after it ends, Ambassador shall not
promote any vitamin, supplement, protein, fitness or wellness product.
6.1. VitaPeak may remove Ambassador from the Program at any time.`;

test("reflow joins wrapped lines and starts blocks at headings and clause numbers", () => {
  const { doc, blocks } = reflow(PDF);
  const text = blocks.map((b) => doc.slice(b.start, b.end));
  assert.deepEqual(text, [
    "BRAND AMBASSADOR PROGRAM TERMS",
    "4. USE OF CONTENT",
    "4.1. VitaPeak may use Ambassador’s Content, name and likeness on its website, social media accounts, emails and advertisements.",
    "5. EXCLUSIVITY",
    "5.1. During participation in the Program and for six (6) months after it ends, Ambassador shall not promote any vitamin, supplement, protein, fitness or wellness product.",
    "6.1. VitaPeak may remove Ambassador from the Program at any time.",
  ]);
  assert.deepEqual(blocks.map((b) => b.heading), [true, true, false, true, false, false]);
});

test("locate finds a quote across a joined line break, with straight quotes and other case", () => {
  const { doc } = reflow(PDF);
  const r = locate(doc, "Ambassador's content, name and likeness on its website, social media accounts");
  assert.ok(r);
  assert.equal(doc.slice(...r), "Ambassador’s Content, name and likeness on its website, social media accounts");
  assert.equal(locate(doc, "not in this contract"), null);
  assert.equal(locate(doc, "  "), null);
});

test("spans keep reading order; an overlapping flag is trimmed, a contained one dropped", () => {
  const doc = "one two three four five six";
  const hits = spans(doc, ["four five", "two three four", "three", "missing words"]);
  assert.deepEqual(hits.map((h) => [doc.slice(h.start, h.end), h.i]), [
    ["two three four", 1],
    [" five", 0],
  ]);
});

test("segments cut a highlight that crosses two clauses at the break", () => {
  const { doc, blocks } = reflow("1. First clause ends here.\n2. Second clause starts here.");
  const hits = spans(doc, ["ends here. 2. Second"]);
  const pieces = segments(doc, blocks, hits);
  assert.deepEqual(pieces, [
    [{ text: "1. First clause ", i: null }, { text: "ends here.", i: 0 }],
    [{ text: "2. Second", i: 0 }, { text: " clause starts here.", i: null }],
  ]);
});
