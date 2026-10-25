import Anthropic from "@anthropic-ai/sdk";
import { execFile } from "node:child_process";
import { unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import community from "@/data/community_signals.json";
import benchmarks from "@/data/rate_benchmarks.json";
import { judge, type Benchmarks } from "@/lib/rate";
import { annotate, checkFlags, lawyer, scanImage, scanText, type Signal } from "@/lib/scan";
import { scrub, scrubDeep, type Removed } from "@/lib/scrub";
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const maxDuration = 120;

const client = new Anthropic();
const run = promisify(execFile);
const IMAGES = ["image/jpeg", "image/png", "image/webp"] as const;
const SIGNALS = community.signals as Signal[];
type Hidden = { page: number; text: string; why: string };
type PdfText = { text: string; hidden: Hidden[]; error?: string };

// Scans cost money and reports are private, so every scan needs a signed-in user.
// The browser sends its Auth0 ID token; Convex checks the same token again when saving.
const AUTH0 = `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/`;
const JWKS = createRemoteJWKSet(new URL(".well-known/jwks.json", AUTH0));
async function signedIn(req: Request): Promise<string | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return null;
  try {
    await jwtVerify(token, JWKS, { issuer: AUTH0, audience: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID });
    return token;
  } catch {
    return null;
  }
}

// On Vercel, api/pdftext.py is a Python function; locally `next dev` can't serve it, so run the script.
async function pdfText(buf: Buffer, origin: string): Promise<PdfText> {
  if (process.env.VERCEL) {
    const res = await fetch(new URL("/api/pdftext", origin), {
      method: "POST",
      body: new Uint8Array(buf),
      headers: { "x-pdftext-key": process.env.PDFTEXT_SECRET ?? "" },
    });
    return res.json();
  }
  const tmp = path.join(os.tmpdir(), `contract-${crypto.randomUUID()}.pdf`);
  await writeFile(tmp, buf);
  try {
    const { stdout } = await run(process.env.PYTHON ?? "python", [path.join(process.cwd(), "api", "pdftext.py"), tmp], { maxBuffer: 20e6 });
    return JSON.parse(stdout);
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

export async function POST(req: Request) {
  const token = await signedIn(req);
  if (!token) return Response.json({ error: "Sign in to scan a contract." }, { status: 401 });
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);
  const quota = await convex.mutation(api.reports.reserveScan, {});
  if (!quota.ok) return Response.json({ error: `You've used all ${quota.limit} scans for today. Try again tomorrow.` }, { status: 429 });
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return Response.json({ error: "Attach a contract PDF or photo." }, { status: 400 });
  if (file.size > 4.4e6) return Response.json({ error: "File is over 4.4 MB." }, { status: 413 });
  const buf = Buffer.from(await file.arrayBuffer());

  let text = "";
  let hidden: Hidden[] = [];
  let removed: Removed = {};
  let scan;
  if (file.type === "application/pdf") {
    const pdf = await pdfText(buf, req.url);
    if (pdf.error) return Response.json({ error: pdf.error }, { status: 422 });
    if (!pdf.text.trim()) return Response.json({ error: "This PDF has no text layer. Take a photo of it instead." }, { status: 422 });
    // personal details come out before Claude sees the text; quotes are checked against this same scrubbed text
    ({ text, removed } = scrub(pdf.text));
    hidden = pdf.hidden;
    scan = await scanText(client, text, SIGNALS);
  } else if ((IMAGES as readonly string[]).includes(file.type)) {
    const img = await scanImage(client, buf.toString("base64"), file.type as (typeof IMAGES)[number], SIGNALS);
    // ponytail: a photo reaches Claude before scrubbing (there is no text to scrub yet); scrubbed before saving
    ({ text, removed } = scrub(img?.transcript ?? ""));
    scan = img;
  } else {
    return Response.json({ error: "Upload a PDF, JPG, PNG or WebP." }, { status: 415 });
  }
  if (!scan) return Response.json({ error: "The scan failed. Try again." }, { status: 502 });

  const flags = annotate(checkFlags(scan.flags, text), SIGNALS);
  // Raymond's Pay Checker method, in code: benchmarks never mix asks, offers and deals, or rights bundles.
  const verdict = judge(scan.offer, benchmarks as Benchmarks);
  const price = verdict ? `$${verdict.counteroffer.toLocaleString("en-US")}` : "a market rate";
  // scrubDeep again over the whole report: catches anything Claude echoed from a photo, and the hidden text
  const report = scrubDeep({
    overall_risk: scan.overall_risk,
    top_3: scan.top_3.slice(0, 3),
    missing_protections: scan.missing_protections,
    governing_law: scan.governing_law,
    contract_end_date: scan.contract_end_date,
    lawyer: lawyer(scan),
    hidden,
    flags,
    offer: scan.offer,
    timeline: scan.timeline,
    counteroffer: scan.counteroffer.replaceAll("[FAIR_PRICE]", price),
    verdict,
    removed,
    from_photo: file.type !== "application/pdf",
    // the scrubbed text the quotes were checked against, so the report can show the whole contract with highlights
    text,
  });
  const id = await convex.mutation(api.reports.save, { fileName: file.name, report });
  return Response.json({ ...report, id });
}
