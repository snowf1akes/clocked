import { test } from "node:test";
import assert from "node:assert/strict";
import { scrub } from "./scrub.ts";

const CONTRACT = `This Agreement is made between Lumora Skin Co. ("Brand") and Maya Chen ("Creator").
Brand will pay $300 within 30 days to account number 000123456789.
Creator: Maya Chen
Email: maya.chen@gmail.com  Phone: (415) 555-0142  TikTok: @mayamakes
Address: 1250 Mission Street, Apt 4B, San Francisco, CA
SSN 123-45-6789`;

test("removes the creator's personal details and keeps the deal terms and brand", () => {
  const { text, removed } = scrub(CONTRACT);
  for (const secret of ["Maya", "Chen", "maya.chen@gmail.com", "555-0142", "@mayamakes", "1250 Mission", "123-45-6789", "000123456789"]) {
    assert.ok(!text.includes(secret), `still contains ${secret}:\n${text}`);
  }
  assert.ok(text.includes("Lumora Skin Co."));
  assert.ok(text.includes("$300 within 30 days"));
  assert.deepEqual(Object.keys(removed).sort(), ["address", "bank", "email", "handle", "name", "phone", "ssn"]);
});

test("leaves a contract with no personal details unchanged", () => {
  const clean = "Payment will be made within ninety (90) days after approval. Usage: 90 days.";
  assert.equal(scrub(clean).text, clean);
});
