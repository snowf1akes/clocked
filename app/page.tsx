"use client";
import { useAuth0 } from "@auth0/auth0-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Fragment, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Verdict } from "@/lib/rate";
import { CATEGORY_LABEL, type Category, type Risk } from "@/lib/rubric";
import type { Scan, ScanFlag } from "@/lib/scan";
import s from "./page.module.css";

type Result = Omit<Scan, "flags"> & {
  flags: ScanFlag[];
  hidden: { page: number; text: string; why: string }[];
  dropped: number;
  verdict: Verdict | null;
  brand_posts: { n: number; median: number } | null;
  removed: Record<string, number>;
  from_photo: boolean;
  lawyer?: { recommend: boolean; reason: string };
  community_as_of?: string | null;
};

const RISK_LABEL: Record<Risk, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };

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


export default function Home() {
  const { loginWithRedirect, logout, user, getAccessTokenSilently } = useAuth0();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [openId, setOpenId] = useState<Id<"reports"> | null>(null);
  const saved = useQuery(api.reports.get, openId ? { id: openId } : "skip");
  const shown = openId ? (saved?.report as Result | undefined) : result;

  async function scan(file: File) {
    setBusy(true);
    setError("");
    setResult(null);
    setOpenId(null);
    try {
      const id_token = (await getAccessTokenSilently({ detailedResponse: true }))?.id_token;
      if (!id_token) throw new Error("Your sign-in expired. Sign in again.");
      const body = new FormData();
      const upload = await shrink(file);
      if (upload.size > 4.4e6) throw new Error("File is over 4.4 MB. Try a smaller PDF or a photo.");
      body.append("file", upload);
      const res = await fetch("/api/scan", { method: "POST", body, headers: { Authorization: `Bearer ${id_token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Scan failed.");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setBusy(false);
    }
  }

  async function demo(name: string) {
    const blob = await (await fetch(`/${name}`)).blob();
    scan(new File([blob], name, { type: "application/pdf" }));
  }

  return (
    <main className={s.main}>
      <nav className={s.topbar}>
        <p className={s.brand}>Clocked</p>
        {isAuthenticated ? (
          <span className={s.account}>
            <span>{user?.email ?? user?.name}</span>
            <button className={s.link} onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
              Sign out
            </button>
          </span>
        ) : (
          <button className={s.link} onClick={() => loginWithRedirect()} disabled={isLoading}>
            Sign in
          </button>
        )}
      </nav>
      <header className={s.header}>
        <h1>Know what you&apos;re signing and what you&apos;re worth.</h1>
        <p className={s.lede}>
          Drop in a brand deal. We flag the clauses that take your rights, explain them in plain English, and check the pay against real UGC deals.
        </p>
      </header>

      {!isAuthenticated ? (
        <section className={s.gate}>
          <p>Sign in to scan a contract. Your reports are saved to your account and only you can see them.</p>
          <button className={s.primary} onClick={() => loginWithRedirect()} disabled={isLoading}>
            {isLoading ? "Checking…" : "Sign in to start"}
          </button>
        </section>
      ) : (
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
        <span className={s.demos}>
          <button className={s.ghost} onClick={() => demo("demo-contract.pdf")} disabled={busy}>
            Demo: obvious traps
          </button>
          <button className={s.ghost} onClick={() => demo("demo-subtle.pdf")} disabled={busy}>
            Demo: subtle wording
          </button>
        </span>
      </section>
      )}

      {busy && <p className={s.status}>Checking for hidden text, reading every clause, comparing the pay. About 25 seconds.</p>}
      {error && <p className={s.error} role="alert">{error}</p>}
      {shown && <Report r={shown} />}
      {isAuthenticated && <History openId={openId} onOpen={(id) => { setOpenId(id); window.scrollTo({ top: 0 }); }} />}

      <footer className={s.footer}>Clocked explains contract terms. It is not legal advice.</footer>
    </main>
  );
}

function Report({ r }: { r: Result }) {
  const [copied, setCopied] = useState(false);
  const v = r.verdict;
  return (
    <div className={s.report}>
      {r.overall_risk && (
        <section className={s.summary} data-sev={r.overall_risk}>
          <p className={s.disclaimer}>This explains your contract so you can decide what to ask for. It is not legal advice.</p>
          <h2>
            Overall risk: <span className={s.level}>{RISK_LABEL[r.overall_risk]}</span>
          </h2>
          {r.top_3?.length > 0 && (
            <>
              <h3>Top 3 things to fix before signing</h3>
              <ol>{r.top_3.map((t) => <li key={t}>{t}</li>)}</ol>
            </>
          )}
          {r.governing_law && <p className={s.note}>Governing law named in the contract: {r.governing_law}.</p>}
        </section>
      )}
      {Object.keys(r.removed ?? {}).length > 0 && (
        <section className={s.privacy}>
          <h2>{Object.values(r.removed).reduce((a, b) => a + b, 0)} personal details removed before analysis</h2>
          <p>
            {Object.entries(r.removed).map(([k, n]) => `${n} ${k}${n > 1 ? "s" : ""}`).join(", ")}. Your file is never stored; only this scrubbed report is saved to your account.
            {r.from_photo && " Photos are read before scrubbing, so the saved report is scrubbed afterward."}
          </p>
        </section>
      )}
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
              {usd(v.offer_per_video)} per video. Only {v.percentile}% of {v.n} {v.compared_to ?? "UGC deals"} creators reported were lower. Typical range: {usd(v.p25)}–{usd(v.p75)} per video.
            </p>
            {v.category_note && <p className={s.note}>{v.category_note}</p>}
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
              <p className={s.note}>Rates creators reported on r/UGCcreators (a one-time research sample, scraped with Apify). Each price was checked against the post it came from; posts are not stored or shown. Upwork job posts are brand offers, so they are shown for context, not used as the fair rate.</p>
            </details>
          </>
        ) : (
          <p className={s.note}>Market check unavailable: no rate data loaded yet.</p>
        )}
      </section>

      <Flags
        title="Clearly unfair"
        note="Terms that take something from you as written."
        flags={r.flags.filter((f) => f.tier !== "vague")}
      />
      <Flags
        title="Looks fine, reads against you"
        note="Small wording choices that a brand could use against you later. These are the ones people miss."
        flags={r.flags.filter((f) => f.tier === "vague")}
      />


      {r.missing_protections?.length > 0 && (
        <section>
          <h2 className={s.h2}>Missing protections</h2>
          <p className={s.note}>A contract that says nothing usually helps the side that wrote it.</p>
          <ul className={s.missing}>{r.missing_protections.map((m) => <li key={m}>{m}</li>)}</ul>
        </section>
      )}

      {r.lawyer?.recommend && (
        <section className={s.lawyer}>
          <h2>When to get a lawyer</h2>
          <p>
            {r.lawyer.reason} A short review by an entertainment or contracts lawyer is worth it for this deal. Many offer flat-fee contract reviews.
          </p>
        </section>
      )}

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

// The signed-in user's past scans. Convex only returns rows they own.
function History({ openId, onOpen }: { openId: Id<"reports"> | null; onOpen: (id: Id<"reports"> | null) => void }) {
  const rows = useQuery(api.reports.list);
  const remove = useMutation(api.reports.remove);
  if (!rows?.length) return null;
  return (
    <section className={s.history}>
      <h2 className={s.h2}>Your scans</h2>
      <ul>
        {rows.map((r) => (
          <li key={r._id} data-open={r._id === openId}>
            <button className={s.row} onClick={() => onOpen(r._id)}>
              <strong>{r.brand || r.fileName}</strong>
              <span>
                {new Date(r._creationTime).toLocaleDateString()} · {r.flagCount} red flags
                {r.underpaidBy && r.underpaidBy > 0 ? ` · underpaid ${usd(r.underpaidBy)}` : ""}
                {r.deleteAt ? ` · auto-deletes ${new Date(r.deleteAt).toLocaleDateString()}` : ""}
              </span>
            </button>
            <button
              className={s.link}
              aria-label={`Delete scan of ${r.brand || r.fileName}`}
              onClick={() => {
                if (r._id === openId) onOpen(null);
                remove({ id: r._id });
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Flags({ title, note, flags }: { title: string; note: string; flags: ScanFlag[] }) {
  if (!flags.length) return null;
  return (
    <section>
      <h2 className={s.h2}>
        {title} <span className={s.count}>{flags.length}</span>
      </h2>
      <p className={s.note}>{note}</p>
      <div className={s.flags}>
        {flags.map((f, i) => (
          <article key={i} className={s.flag} data-sev={f.severity}>
            <p className={s.sev}>
              {RISK_LABEL[f.severity as Risk] ?? f.severity} risk
              {CATEGORY_LABEL[f.category as Category] && <span className={s.cat}> · {CATEGORY_LABEL[f.category as Category]}</span>}
            </p>
            <h3>{f.title}</h3>
            {f.standard ? (
              <div className={s.diff}>
                <p>
                  <span className={s.label}>Your contract</span>
                  <Changed a={f.quote} b={f.standard} />
                </p>
                <p className={s.fair}>
                  <span className={s.label}>Fair version</span>
                  <Changed a={f.standard} b={f.quote} />
                </p>
              </div>
            ) : (
              <blockquote>&ldquo;{f.quote}&rdquo;</blockquote>
            )}
            <dl>
              <dt>What it means</dt>
              <dd>{f.meaning}</dd>
              <dt>What could happen</dt>
              <dd>{f.risk}</dd>
              <dt>Ask for instead</dt>
              <dd>{f.ask}</dd>
            </dl>
            {f.case_ref && (
              <p className={s.example}>
                <span className={s.label}>Real-world example</span>
                {f.case_ref}
              </p>
            )}
            {f.community && (
              <p className={s.example}>
                <span className={s.label}>Community signal</span>
                Creators are warning each other about this: {f.community.mentions} posts from the last 90 days in our research sample of r/UGCcreators.
                {f.community.negotiated_pct ? ` ${Math.round(f.community.negotiated_pct * 100)}% of them say they got it changed by asking.` : ""}
              </p>
            )}
            {f.law_note && <p className={s.law}>{f.law_note}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

// Shows `a` with the words that are not in `b` highlighted (longest common word sequence).
function Changed({ a, b }: { a: string; b: string }) {
  const A = a.split(/\s+/);
  const B = b.split(/\s+/);
  const key = (w: string) => w.toLowerCase().replace(/[^\w$%]/g, "");
  const L = Array.from({ length: A.length + 1 }, () => new Array<number>(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--)
    for (let j = B.length - 1; j >= 0; j--)
      L[i][j] = key(A[i]) === key(B[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: { w: string; on: boolean }[] = [];
  let i = 0;
  let j = 0;
  while (i < A.length) {
    if (j < B.length && key(A[i]) === key(B[j])) {
      out.push({ w: A[i], on: false });
      i++;
      j++;
    } else if (j < B.length && L[i][j + 1] >= L[i + 1][j]) {
      j++;
    } else {
      out.push({ w: A[i], on: true });
      i++;
    }
  }
  return (
    <>
      {out.map((t, i) => (
        <Fragment key={i}>
          {t.on ? <mark>{t.w}</mark> : t.w}{" "}
        </Fragment>
      ))}
    </>
  );
}
