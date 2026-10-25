import Anthropic from "@anthropic-ai/sdk";
import { execFile } from "node:child_process";
import { unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import rateRows from "@/data/rates.json";
import { judge, quantile, type RateRow } from "@/lib/rate";
import { checkFlags, scanImage, scanText } from "@/lib/scan";

export const maxDuration = 120;

const client = new Anthropic();
const run = promisify(execFile);
const IMAGES = ["image/jpeg", "image/png", "image/webp"] as const;
type Hidden = { page: number; text: string; why: string };
type PdfText = { text: string; hidden: Hidden[]; error?: string };

// On Vercel, api/pdftext.py is a Python function; locally `next dev` can't serve it, so run the script.
async function pdfText(buf: Buffer, origin: string): Promise<PdfText> {
  if (process.env.VERCEL) {
    const res = await fetch(new URL("/api/pdftext", origin), { method: "POST", body: new Uint8Array(buf) });
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
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return Response.json({ error: "Attach a contract PDF or photo." }, { status: 400 });
  if (file.size > 4.4e6) return Response.json({ error: "File is over 4.4 MB." }, { status: 413 });
  const buf = Buffer.from(await file.arrayBuffer());

  let text = "";
  let hidden: Hidden[] = [];
  let scan;
  if (file.type === "application/pdf") {
    const pdf = await pdfText(buf, req.url);
    if (pdf.error) return Response.json({ error: pdf.error }, { status: 422 });
    ({ text, hidden } = pdf);
    if (!text.trim()) return Response.json({ error: "This PDF has no text layer. Take a photo of it instead." }, { status: 422 });
    scan = await scanText(client, text);
  } else if ((IMAGES as readonly string[]).includes(file.type)) {
    const img = await scanImage(client, buf.toString("base64"), file.type as (typeof IMAGES)[number]);
    text = img?.transcript ?? "";
    scan = img;
  } else {
    return Response.json({ error: "Upload a PDF, JPG, PNG or WebP." }, { status: 415 });
  }
  if (!scan) return Response.json({ error: "The scan failed. Try again." }, { status: 502 });

  const flags = checkFlags(scan.flags, text);
  // Fair rate = what creators report charging. Upwork posts are brand offers, the thing being judged,
  // so they are shown as context, not mixed into the baseline.
  const all = rateRows as RateRow[];
  const verdict = judge(scan.offer, all.filter((r) => r.source !== "upwork"));
  const posts = all.filter((r) => r.source === "upwork").map((r) => r.per_video_usd).sort((a, b) => a - b);
  const brand_posts = posts.length >= 5 ? { n: posts.length, median: quantile(posts, 0.5) } : null;
  const price = verdict ? `$${(Math.round(verdict.fair_total / 10) * 10).toLocaleString("en-US")}` : "a market rate";
  return Response.json({
    hidden,
    flags,
    dropped: scan.flags.length - flags.length,
    offer: scan.offer,
    timeline: scan.timeline,
    counteroffer: scan.counteroffer.replaceAll("[FAIR_PRICE]", price),
    verdict,
    brand_posts,
  });
}
