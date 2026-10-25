"use client";
import { useAuth0 } from "@auth0/auth0-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Fragment, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import benchmarks from "@/data/rate_benchmarks.json";
import { PRICE_TYPE_LABEL, type Benchmarks, type PayCheck, type RightsBundle } from "@/lib/rate";
import { CATEGORY_LABEL, type Category, type Risk } from "@/lib/rubric";
import type { Scan, ScanFlag } from "@/lib/scan";
import s from "./page.module.css";

type Result = Scan & {
  hidden: { page: number; text: string; why: string }[];
  verdict: PayCheck | null;
  removed: Record<string, number>;
  from_photo: boolean;
  lawyer?: { recommend: boolean; reason: string };
};
type View = "overview" | "xray" | "rate";

const RISK_LABEL: Record<Risk, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const day = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });

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
  const [view, setView] = useState<View>("overview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [openId, setOpenId] = useState<Id<"reports"> | null>(null);
  const saved = useQuery(api.reports.get, openId ? { id: openId } : "skip");
  const shown = openId ? (saved?.report as Result | undefined) : result;
  const signIn = () => loginWithRedirect();

  async function scan(file: File) {
    setView("xray");
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

  function open(id: Id<"reports">) {
    setResult(null);
    setOpenId(id);
    setView("xray");
    window.scrollTo({ top: 0 });
  }

  return (
    <div className={s.shell}>
      <aside className={s.side}>
        <p className={s.wordmark} aria-label="Clocked">
          clocked<span>.</span>
        </p>
        <nav className={s.nav} aria-label="Sections">
          <NavItem icon={<IconInbox />} label="Overview" on={view === "overview"} go={() => setView("overview")} />
          <NavItem icon={<IconScan />} label="Contract X-ray" on={view === "xray"} go={() => setView("xray")} />
          <NavItem icon={<IconDollar />} label="Rate Check" on={view === "rate"} go={() => setView("rate")} />
        </nav>
      </aside>

      <div className={s.main}>
        <header className={s.bar}>
          <p className={s.tagline}>Your brand deals, checked.</p>
          {isAuthenticated ? (
            <span className={s.account}>
              <span className={s.email}>{user?.email ?? user?.name}</span>
              <button className={s.link} onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
                Sign out
              </button>
            </span>
          ) : (
            <button className={s.link} onClick={signIn} disabled={isLoading}>
              Sign in
            </button>
          )}
        </header>

        <main className={s.page} key={view}>
          {view === "overview" && (
            <Overview signedIn={isAuthenticated} loading={isLoading} signIn={signIn} open={open} toXray={() => setView("xray")} />
          )}
          {view === "xray" && (
            <>
              <h1 className={s.h1}>Contract X-ray</h1>
              <p className={s.lede}>Upload a brand deal. Clo reads every clause, catches the fine print, and drafts your counteroffer.</p>
              {!isAuthenticated ? (
                <Gate loading={isLoading} signIn={signIn} />
              ) : (
                <section className={s.upload}>
                  <label className={s.drop} data-busy={busy}>
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])}
                    />
                    <IconUpload />
                    <span>
                      <strong>Upload a contract</strong>
                      <span>PDF, or snap a photo of a paper one</span>
                    </span>
                  </label>
                  <div className={s.demos}>
                    <span className={s.demosLabel}>Or try a demo contract</span>
                    <button className={s.secondary} onClick={() => demo("demo-contract.pdf")} disabled={busy}>
                      Obvious traps
                    </button>
                    <button className={s.secondary} onClick={() => demo("demo-subtle.pdf")} disabled={busy}>
                      Subtle wording
                    </button>
                  </div>
                </section>
              )}
              {busy && <Reading />}
              {error && (
                <p className={s.error} role="alert">
                  {error}
                </p>
              )}
              {shown && <Report r={shown} toRate={() => setView("rate")} />}
              {openId && saved === undefined && <p className={s.muted}>Opening your scan…</p>}
            </>
          )}
          {view === "rate" && <RateCheck r={shown ?? null} toXray={() => setView("xray")} />}
        </main>

        <footer className={s.footer}>Clocked explains contract terms. It is not legal advice.</footer>
      </div>
    </div>
  );
}

function NavItem({ icon, label, on, go }: { icon: React.ReactNode; label: string; on: boolean; go: () => void }) {
  return (
    <button className={s.navItem} aria-current={on ? "page" : undefined} onClick={go}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Gate({ loading, signIn }: { loading: boolean; signIn: () => void }) {
  return (
    <section className={s.gate}>
      <p>Sign in to scan a contract. Your scans are saved to your account, only you can see them, and they delete themselves a week after the contract ends.</p>
      <button className={s.primary} onClick={signIn} disabled={loading}>
        {loading ? "Checking…" : "Sign in to start"}
      </button>
    </section>
  );
}

// Clo, the team's mascot (public/clo/, one shared canvas, so swapping poses never shifts him).
// Idle is an animated loop. Shows an empty slot until the image loads.
type Pose = "idle" | "thinking" | "concerned" | "alarmed" | "celebrate";
const POSE_FOR_RISK: Record<Risk, Pose> = { critical: "alarmed", high: "concerned", medium: "concerned", low: "celebrate" };
function Clo({ size = 168, pose = "idle" }: { size?: number; pose?: Pose }) {
  const src = pose === "idle" ? "/clo/idle.webp" : `/clo/${pose}.png`;
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setLoaded(src);
    img.src = src;
  }, [src]);
  if (loaded !== src) return <span className={s.cloSlot} style={{ width: (size * 441) / 496, height: size }} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={s.clo} src={src} alt="Clo, the Clocked bunny" style={{ height: size }} />;
}

function Reading() {
  return (
    <section className={s.reading} aria-live="polite">
      <Clo size={72} pose="thinking" />
      <div>
        <strong>Clo is reading your contract</strong>
        <span>Checking for hidden text, reading every clause twice, comparing the pay. About 25 seconds.</span>
        <span className={s.sweep} aria-hidden />
      </div>
    </section>
  );
}

const FIRST_LOOK: Record<Risk, string> = {
  critical: "Cute offer. Brutal fine print.",
  high: "Cute email. Interesting fine print.",
  medium: "Mostly fine. A few things to ask about.",
  low: "This one reads clean.",
};

function Overview(props: { signedIn: boolean; loading: boolean; signIn: () => void; open: (id: Id<"reports">) => void; toXray: () => void }) {
  const rows = useQuery(api.reports.list, props.signedIn ? {} : "skip");
  const remove = useMutation(api.reports.remove);
  const [tab, setTab] = useState<"all" | "fix" | "under">("all");
  const latest = rows?.[0];
  const fix = rows?.filter((r) => r.overall === "critical" || r.overall === "high") ?? [];
  const under = rows?.filter((r) => (r.underpaidBy ?? 0) > 0) ?? [];
  const list = tab === "fix" ? fix : tab === "under" ? under : (rows ?? []);

  return (
    <>
      <h1 className={s.h1}>Let&rsquo;s clock these deals.</h1>
      <p className={s.lede}>Your brand deals. Your next move.</p>

      <section className={s.firstLook}>
        <div className={s.firstLookBody}>
          <p className={s.cloLabel}>Clo&rsquo;s first look</p>
          {!props.signedIn ? (
            <>
              <h2>Got a brand deal? Let&rsquo;s clock it.</h2>
              <p>Clo reads every clause, flags what takes your rights, and checks the pay against real creator deals.</p>
              <button className={s.primary} onClick={props.signIn} disabled={props.loading}>
                {props.loading ? "Checking…" : "Sign in to start"} <IconArrow />
              </button>
            </>
          ) : latest ? (
            <>
              <h2>{FIRST_LOOK[(latest.overall as Risk) ?? "medium"] ?? FIRST_LOOK.medium}</h2>
              <p>
                {latest.flagCount} thing{latest.flagCount === 1 ? "" : "s"} in {latest.brand || "this"} offer deserve a second look
                {(latest.underpaidBy ?? 0) > 0 ? `, and the pay is ${usd(latest.underpaidBy!)} under market.` : "."}
              </p>
              {latest.titles.length > 0 && (
                <ul className={s.chips}>
                  {latest.titles.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
              <button className={s.primary} onClick={() => props.open(latest._id)}>
                Review {latest.brand || "the"} offer <IconArrow />
              </button>
            </>
          ) : (
            <>
              <h2>No deals clocked yet.</h2>
              <p>Drop in your first contract, or try a demo one. It takes about 25 seconds.</p>
              <button className={s.primary} onClick={props.toXray}>
                Scan a contract <IconArrow />
              </button>
            </>
          )}
        </div>
        <Clo pose={props.signedIn && latest?.overall ? POSE_FOR_RISK[latest.overall as Risk] ?? "idle" : "idle"} />
      </section>

      {props.signedIn && !!rows?.length && (
        <>
          <div className={s.tabs} role="tablist" aria-label="Filter scans">
            <Tab on={tab === "all"} go={() => setTab("all")} label="All scans" n={rows.length} />
            <Tab on={tab === "fix"} go={() => setTab("fix")} label="Needs changes" n={fix.length} />
            <Tab on={tab === "under"} go={() => setTab("under")} label="Underpaid" n={under.length} />
          </div>
          <ul className={s.rows}>
            {list.map((r) => (
              <li key={r._id}>
                <button className={s.row} onClick={() => props.open(r._id)}>
                  <span className={s.avatar} aria-hidden>
                    {(r.brand || r.fileName).replace(/[^a-z0-9]/gi, "").charAt(0).toLowerCase() || "?"}
                  </span>
                  <span className={s.rowMain}>
                    <strong>{r.brand || r.fileName}</strong>
                    <span>
                      {r.flagCount} red flag{r.flagCount === 1 ? "" : "s"}
                      {r.overall ? ` · ${RISK_LABEL[r.overall as Risk]} risk` : ""}
                    </span>
                    <span>
                      Scanned {day(r._creationTime)}
                      {r.deleteAt ? ` · Deletes itself ${day(r.deleteAt)}` : ""}
                    </span>
                  </span>
                  <span className={s.rowSide}>
                    <strong>{r.pay !== null ? usd(r.pay) : "—"}</strong>
                    <span data-tone={(r.underpaidBy ?? 0) > 0 ? "bad" : undefined}>
                      {(r.underpaidBy ?? 0) > 0 ? `Underpaid ${usd(r.underpaidBy!)}` : r.pay !== null ? "Fair pay" : "No price"}
                    </span>
                  </span>
                  <IconChevron />
                </button>
                <button className={s.iconButton} aria-label={`Delete scan of ${r.brand || r.fileName}`} onClick={() => remove({ id: r._id })}>
                  <IconTrash />
                </button>
              </li>
            ))}
            {!list.length && <li className={s.emptyRow}>Nothing here yet.</li>}
          </ul>
        </>
      )}
    </>
  );
}

function Tab({ on, go, label, n }: { on: boolean; go: () => void; label: string; n: number }) {
  return (
    <button role="tab" aria-selected={on} className={s.tab} onClick={go}>
      {label} <span>{n}</span>
    </button>
  );
}

function Report({ r, toRate }: { r: Result; toRate: () => void }) {
  const [copied, setCopied] = useState(false);
  const v = payOf(r);
  const removed = Object.values(r.removed ?? {}).reduce((a, b) => a + b, 0);
  return (
    <div className={s.report}>
      {r.overall_risk && (
        <section className={s.summary} data-sev={r.overall_risk}>
          <div className={s.summaryHead}>
            <h2>
              {r.offer.brand ? `${r.offer.brand}: ` : ""}
              <span className={s.level}>{RISK_LABEL[r.overall_risk]} risk</span>
            </h2>
            {v && (
              <button className={s.payPill} data-tone={v.verdict === "underpaid" ? "bad" : "good"} onClick={toRate}>
                {v.verdict === "underpaid" ? `Underpaid by ${v.gap_vs_low_pct}% · ask ${usd(v.counteroffer)}` : VERDICT_LINE[v.verdict](v)} <IconArrow />
              </button>
            )}
          </div>
          {r.top_3?.length > 0 && (
            <>
              <h3>Top 3 things to fix before signing</h3>
              <ol>
                {r.top_3.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </>
          )}
          <p className={s.disclaimer}>
            This explains your contract so you can decide what to ask for. It is not legal advice.
            {r.governing_law ? ` Governing law named in the contract: ${r.governing_law}.` : ""}
          </p>
        </section>
      )}

      {r.hidden.length > 0 && (
        <section className={s.hidden} role="alert">
          <h2>Hidden text found</h2>
          <p>This PDF contains text you can&apos;t see but AI tools can read. Clo removed it before reading.</p>
          {r.hidden.map((h, i) => (
            <blockquote key={i}>
              &ldquo;{h.text}&rdquo; <span>Page {h.page}, {h.why}</span>
            </blockquote>
          ))}
        </section>
      )}

      {removed > 0 && (
        <p className={s.privacy}>
          <IconShield />
          <span>
            <strong>{removed} personal details removed before analysis</strong> (
            {Object.entries(r.removed).map(([k, n]) => `${n} ${k}${n > 1 ? "s" : ""}`).join(", ")}). Your file is never stored.
            {r.from_photo && " Photos are read before scrubbing, so the saved report is scrubbed afterward."}
          </span>
        </p>
      )}

      <Flags title="Clearly unfair" note="Terms that take something from you as written." flags={r.flags.filter((f) => f.tier !== "vague")} />
      <Flags
        title="Looks fine, reads against you"
        note="Small wording choices a brand could use against you later. These are the ones people miss."
        flags={r.flags.filter((f) => f.tier === "vague")}
      />

      {(r.missing_protections?.length > 0 || r.lawyer?.recommend) && (
        <div className={s.pair}>
          {r.missing_protections?.length > 0 && (
            <section className={s.panel}>
              <h2 className={s.h3}>Missing protections</h2>
              <p className={s.muted}>A contract that says nothing usually helps the side that wrote it.</p>
              <ul className={s.missing}>
                {r.missing_protections.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </section>
          )}
          {r.lawyer?.recommend && (
            <section className={s.lawyer}>
              <h2 className={s.h3}>When to get a lawyer</h2>
              <p>{r.lawyer.reason} A short review by an entertainment or contracts lawyer is worth it for this deal. Many offer flat-fee reviews.</p>
            </section>
          )}
        </div>
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
        <button className={s.primary} onClick={() => navigator.clipboard.writeText(r.counteroffer).then(() => setCopied(true))}>
          {copied ? "Copied" : "Copy email"}
        </button>
      </section>
    </div>
  );
}

function Flags({ title, note, flags }: { title: string; note: string; flags: ScanFlag[] }) {
  if (!flags.length) return null;
  return (
    <section>
      <h2 className={s.h2}>
        {title} <span className={s.count}>{flags.length}</span>
      </h2>
      <p className={s.sectionNote}>{note}</p>
      <div className={s.flags}>
        {flags.map((f, i) => (
          <article key={i} className={s.flag} data-sev={f.severity}>
            <p className={s.sev}>
              <span>{RISK_LABEL[f.severity as Risk] ?? f.severity}</span>
              {CATEGORY_LABEL[f.category as Category] && <span className={s.cat}>{CATEGORY_LABEL[f.category as Category]}</span>}
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
              <blockquote className={s.quote}>&ldquo;{f.quote}&rdquo;</blockquote>
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

// The Pay Checker result is only shown for reports scanned with Raymond's method (older reports lack fair_range).
const payOf = (r: Result | null): PayCheck | null => (r?.verdict && "fair_range" in r.verdict ? r.verdict : null);

const VERDICT_LINE: Record<PayCheck["verdict"], (p: PayCheck) => string> = {
  underpaid: (p) => `Underpaid by about ${p.gap_vs_low_pct}%`,
  fair: () => "This pay is fair",
  above_range: () => "Above the fair range. Nice.",
  cannot_fully_evaluate: () => "Can't fully evaluate",
};

function RateCheck({ r, toXray }: { r: Result | null; toXray: () => void }) {
  const p = payOf(r);
  const b = benchmarks as Benchmarks;
  const allNiche = b.buckets.filter((x) => x.niche === "all").sort((x, y) => y.n - x.n);
  return (
    <>
      <h1 className={s.h1}>Rate Check</h1>
      <p className={s.lede}>Is the offer fair for what the contract asks? An estimate from reported prices, not financial advice.</p>

      {p && r ? (
        <section className={s.money}>
          <p className={s.moneyFor}>
            {r.offer.brand} offers {p.offer ? usd(p.offer) : "no cash fee"} for {p.videos} video{p.videos === 1 ? "" : "s"}
          </p>
          <h2 className={p.verdict === "underpaid" || p.verdict === "cannot_fully_evaluate" ? s.bad : s.good}>{VERDICT_LINE[p.verdict](p)}</h2>
          <p>
            Estimated fair range <strong>{usd(p.fair_range.low)}–{usd(p.fair_range.high)}</strong>
            {p.verdict === "underpaid" ? `, about ${p.gap_vs_mid_pct}% below the ${usd(p.fair_range.midpoint)} midpoint.` : "."}
          </p>
          <FairBar p={p} />
          <div className={s.howWe}>
            <h3>How we got this</h3>
            <ul>
              <li>
                Base: {p.videos} × {usd(p.base.low)}–{usd(p.base.high)} per video ({p.base.n ? `${p.base.source}, ${p.base.n} reported prices` : p.base.source})
              </li>
              {p.uplifts.map((u) => (
                <li key={u.term}>
                  +{u.low_pct}–{u.high_pct}% for {u.term}
                </li>
              ))}
              <li>
                Confidence: <strong>{p.confidence}</strong>, {p.confidence_reason}.
              </li>
            </ul>
          </div>
          {p.verdict === "underpaid" && (
            <div className={s.fixes}>
              <h3>Two ways to fix it</h3>
              <ol>
                <li>
                  Ask for <strong>{usd(p.counteroffer)}</strong> for the same terms.
                </li>
                <li>{p.reduce_rights_option}</li>
              </ol>
              {p.script && <p className={s.script}>&ldquo;{p.script}&rdquo;</p>}
            </div>
          )}
          {p.notes.map((n) => (
            <p key={n} className={s.payNote}>
              {n}
            </p>
          ))}
        </section>
      ) : (
        <section className={s.panel}>
          <h2 className={s.h3}>{r ? "Re-scan to see the new pay check" : "Check a real offer"}</h2>
          <p className={s.muted}>Scan a contract and Clo prices it: base rate, extra rights the contract takes, a fair range and a counteroffer.</p>
          <button className={s.primary} onClick={toXray}>
            Scan a contract <IconArrow />
          </button>
        </section>
      )}

      <section>
        <h2 className={s.h2}>What creators report</h2>
        <p className={s.sectionNote}>
          Per-video prices from {String(b.validation.items_after_verification)} verified reports, kept apart by type and by the rights included. A group is used
          for pricing only with 15+ prices from 5+ threads; otherwise the default $100–$200 range applies.
        </p>
        <ul className={s.market}>
          {allNiche.slice(0, 8).map((x) => (
            <li key={`${x.price_type}${x.rights_bundle}`}>
              <span>
                {PRICE_TYPE_LABEL[x.price_type]} · {RIGHTS_LABEL[x.rights_bundle]}
              </span>
              <strong>{usd(x.median_per_video)}</strong>
              <span className={s.marketN} data-thin={!x.usable || undefined}>
                {x.n} price{x.n === 1 ? "" : "s"}
                {x.usable ? "" : " · thin data"}
              </span>
            </li>
          ))}
        </ul>
        <p className={s.muted}>
          Reference points: {b.reference_figures.slice(0, 2).map((f) => `${f.figure.toLowerCase()} ${f.value} (${f.source})`).join("; ")}. {b.sample_note}
        </p>
      </section>
    </>
  );
}

const RIGHTS_LABEL: Record<RightsBundle, string> = {
  base: "organic only",
  with_short_paid: "with 90 days or less of paid ads",
  with_long_paid: "with long or forever paid ads",
  with_exclusivity: "with exclusivity",
  unknown_rights: "rights not stated",
};

// The fair range as a band, with the offer marked.
function FairBar({ p }: { p: PayCheck }) {
  const max = Math.max(p.fair_range.high, p.offer) * 1.12 || 1;
  const x = (v: number) => 14 + (v / max) * 572;
  return (
    <svg className={s.strip} viewBox="0 0 600 76" role="img" aria-label={`Offer ${usd(p.offer)} against a fair range of ${usd(p.fair_range.low)} to ${usd(p.fair_range.high)}`}>
      <line x1="14" x2="586" y1="38" y2="38" stroke="var(--line-strong)" strokeWidth="2" strokeLinecap="round" />
      <rect x={x(p.fair_range.low)} y="30" width={x(p.fair_range.high) - x(p.fair_range.low)} height="16" rx="8" fill="var(--green-soft)" stroke="var(--green)" strokeOpacity="0.4" />
      <text x={x(p.fair_range.low)} y="18" textAnchor="middle" fontSize="12" fill="var(--muted)">
        {usd(p.fair_range.low)}
      </text>
      <text x={x(p.fair_range.high)} y="18" textAnchor="middle" fontSize="12" fill="var(--muted)">
        {usd(p.fair_range.high)}
      </text>
      <circle cx={x(p.offer)} cy="38" r="9" fill="var(--pink)" stroke="var(--surface)" strokeWidth="3" />
      <text x={x(p.offer)} y="70" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--pink-ink)">
        offer {usd(p.offer)}
      </text>
    </svg>
  );
}

// Shows `a` with the words that are not in `b` highlighted (longest common word sequence).
function Changed({ a, b }: { a: string; b: string }) {
  const A = a.split(/\s+/);
  const B = b.split(/\s+/);
  const key = (w: string) => w.toLowerCase().replace(/[^\w$%]/g, "");
  const L = Array.from({ length: A.length + 1 }, () => new Array<number>(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--)
    for (let j = B.length - 1; j >= 0; j--) L[i][j] = key(A[i]) === key(B[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
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
      {out.map((t, k) => (
        <Fragment key={k}>
          {t.on ? <mark>{t.w}</mark> : t.w}{" "}
        </Fragment>
      ))}
    </>
  );
}

// Icons: one 24px grid, 1.75 stroke, round caps.
const svg = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const IconInbox = () => (<svg {...svg}><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="M3.5 13.5h4.5l1.5 2.5h5l1.5-2.5h4.5" /></svg>);
const IconScan = () => (<svg {...svg}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10" /></svg>);
const IconDollar = () => (<svg {...svg}><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9.2c-.4-.9-1.4-1.5-2.5-1.5-1.5 0-2.6.8-2.6 2s1.1 1.7 2.6 2.1c1.6.4 2.7 1 2.7 2.2s-1.2 2-2.7 2c-1.2 0-2.2-.6-2.6-1.5M12 6.2v1.5M12 16.3v1.5" /></svg>);
const IconArrow = () => (<svg {...svg} width={18} height={18}><path d="M8 16 16 8M9 8h7v7" /></svg>);
const IconChevron = () => (<svg {...svg} className={s.chevron}><path d="m9.5 6 6 6-6 6" /></svg>);
const IconTrash = () => (<svg {...svg} width={18} height={18}><path d="M5 7h14M10 7V5h4v2M7 7l.8 11.2a2 2 0 0 0 2 1.8h4.4a2 2 0 0 0 2-1.8L17 7" /></svg>);
const IconUpload = () => (<svg {...svg} width={28} height={28}><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 14v3.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V14" /></svg>);
const IconShield = () => (<svg {...svg}><path d="M12 3.5 5 6.2v5.3c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6.2L12 3.5Z" /><path d="m9 12 2 2 4-4" /></svg>);
