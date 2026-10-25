"use client";
import { useState } from "react";
import type { Verdict } from "@/lib/rate";
import type { Scan, ScanFlag } from "@/lib/scan";
import s from "./page.module.css";

type Result = Omit<Scan, "flags"> & {
  flags: ScanFlag[];
  hidden: { page: number; text: string; why: string }[];
  dropped: number;
  verdict: Verdict | null;
  brand_posts: { n: number; median: number } | null;
};

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

// Phone photos are often over Vercel's 4.5 MB request limit. 2000px JPEG keeps contract text readable.
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 1.5e6) return file;
  const img = await createImageBitmap(file);
  const k = Math.min(1, 2000 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * k);
  canvas.height = Math.round(img.height * k);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
  return blob ? new File([blob], "contract.jpg", { type: "image/jpeg" }) : file;
}

const LAW_NOTE: Partial<Record<ScanFlag["category"], string>> = {
  ai_likeness:
    "California's AB 2602 (in effect since 2025) can make a clause like this unenforceable when the uses aren't specifically described and you had no lawyer or union. Ask a lawyer before relying on it.",
};

export default function Home() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function scan(file: File) {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      const upload = await shrink(file);
      if (upload.size > 4.4e6) throw new Error("File is over 4.4 MB. Try a smaller PDF or a photo.");
      body.append("file", upload);
      const res = await fetch("/api/scan", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Scan failed.");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setBusy(false);
    }
  }

  async function demo() {
    const blob = await (await fetch("/demo-contract.pdf")).blob();
    scan(new File([blob], "demo-contract.pdf", { type: "application/pdf" }));
  }

  return (
    <main className={s.main}>
      <header className={s.header}>
        <p className={s.brand}>Clocked</p>
        <h1>Know what you&apos;re signing and what you&apos;re worth.</h1>
        <p className={s.lede}>
          Drop in a brand deal. We flag the clauses that take your rights, explain them in plain English, and check the pay against real UGC deals.
        </p>
      </header>

      <section className={s.upload}>
        <label className={s.drop}>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])}
          />
          <span>{busy ? "Reading your contract…" : "Upload a contract PDF or snap a photo"}</span>
        </label>
        <button className={s.ghost} onClick={demo} disabled={busy}>
          Try the demo contract
        </button>
      </section>

      {busy && <p className={s.status}>Checking for hidden text, reading every clause, comparing the pay. About 25 seconds.</p>}
      {error && <p className={s.error} role="alert">{error}</p>}
      {result && <Report r={result} />}

      <footer className={s.footer}>Clocked explains contract terms. It is not legal advice.</footer>
    </main>
  );
}

function Report({ r }: { r: Result }) {
  const [copied, setCopied] = useState(false);
  const v = r.verdict;
  return (
    <div className={s.report}>
      {r.hidden.length > 0 && (
        <section className={s.hidden} role="alert">
          <h2>Hidden text found</h2>
          <p>This PDF contains text you can&apos;t see but AI tools can read. We removed it before scanning.</p>
          {r.hidden.map((h, i) => (
            <blockquote key={i}>
              &ldquo;{h.text}&rdquo; <span>page {h.page}, {h.why}</span>
            </blockquote>
          ))}
        </section>
      )}

      <section className={s.money}>
        {v ? (
          <>
            <p className={s.kicker}>{r.offer.brand} offers {usd(r.offer.total_pay_usd ?? 0)} for {r.offer.videos} videos</p>
            <h2 className={v.underpaid_by > 0 ? s.bad : s.good}>
              {v.underpaid_by > 0 ? `This deal underpays you by ${usd(v.underpaid_by)}` : "The pay is at or above market"}
            </h2>
            <p>
              {usd(v.offer_per_video)} per video. Only {v.percentile}% of {v.n} rates creators reported were lower. Typical range: {usd(v.p25)}–{usd(v.p75)} per video.
            </p>
            {r.brand_posts && (
              <p className={s.note}>
                Brands posting UGC jobs on Upwork offer a median of {usd(r.brand_posts.median)} per video ({r.brand_posts.n} jobs). That gap is why creators get lowballed.
              </p>
            )}
            <Strip v={v} />
            {v.missing_addon && <p className={s.note}>{v.missing_addon}</p>}
            <details>
              <summary>Show the math</summary>
              <ul>{v.math.map((m) => <li key={m}>{m}</li>)}</ul>
              <p className={s.note}>Rates creators reported on r/UGCcreators, scraped with Apify. Each price is checked against the post it came from. Upwork job posts are brand offers, so they are shown for context, not used as the fair rate.</p>
            </details>
          </>
        ) : (
          <p className={s.note}>Market check unavailable: no rate data loaded yet.</p>
        )}
      </section>

      <section>
        <h2 className={s.h2}>
          {r.flags.length} red flag{r.flags.length === 1 ? "" : "s"}
        </h2>
        <div className={s.flags}>
          {r.flags.map((f, i) => (
            <article key={i} className={s.flag} data-sev={f.severity}>
              <p className={s.sev}>{f.severity} risk</p>
              <h3>{f.title}</h3>
              <blockquote>&ldquo;{f.quote}&rdquo;</blockquote>
              <dl>
                <dt>What it means</dt>
                <dd>{f.meaning}</dd>
                <dt>What could happen</dt>
                <dd>{f.risk}</dd>
                <dt>Ask for instead</dt>
                <dd>{f.ask}</dd>
              </dl>
              {LAW_NOTE[f.category] && <p className={s.law}>{LAW_NOTE[f.category]}</p>}
            </article>
          ))}
        </div>
      </section>

      {r.timeline.length > 0 && (
        <section>
          <h2 className={s.h2}>What they could do with your face</h2>
          <ol className={s.timeline}>
            {r.timeline.map((t) => (
              <li key={t.when}>
                <strong>{t.when}</strong>
                <span>{t.what}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section>
        <h2 className={s.h2}>Your counteroffer</h2>
        <pre className={s.counter}>{r.counteroffer}</pre>
        <button
          className={s.primary}
          onClick={() => navigator.clipboard.writeText(r.counteroffer).then(() => setCopied(true))}
        >
          {copied ? "Copied" : "Copy email"}
        </button>
      </section>
    </div>
  );
}

// Every scraped deal as a dot on one line, with the offer marked.
function Strip({ v }: { v: Verdict }) {
  const max = Math.max(v.points[Math.floor(v.points.length * 0.95)] ?? 0, v.offer_per_video) * 1.05;
  const x = (p: number) => 10 + (Math.min(p, max) / max) * 580;
  return (
    <svg className={s.strip} viewBox="0 0 600 70" role="img" aria-label={`Offer of ${usd(v.offer_per_video)} per video against ${v.n} deals`}>
      <line x1="10" x2="590" y1="35" y2="35" stroke="var(--line)" strokeWidth="2" />
      {v.points.map((p, i) => (
        <circle key={i} cx={x(p)} cy={35 + ((i % 5) - 2) * 4} r="4" fill="var(--muted)" opacity="0.45" />
      ))}
      <line x1={x(v.median)} x2={x(v.median)} y1="18" y2="52" stroke="var(--ink)" strokeDasharray="3 3" />
      <text x={x(v.median)} y="12" textAnchor="middle" fontSize="11" fill="var(--muted)">median {usd(v.median)}</text>
      <circle cx={x(v.offer_per_video)} cy="35" r="8" fill="var(--red)" />
      <text x={x(v.offer_per_video)} y="66" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--red)">you {usd(v.offer_per_video)}</text>
    </svg>
  );
}
