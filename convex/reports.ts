// A user's saved scans. Every function looks up the caller from their Auth0 token
// and only ever reads or deletes rows they own.
import { v } from "convex/values";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";

const DAY = 864e5;
const DAILY_SCANS = 20;

async function owner(ctx: QueryCtx) {
  const user = await ctx.auth.getUserIdentity();
  if (!user) throw new Error("Sign in first.");
  return user.tokenIdentifier;
}

// Reports are deleted 1 week after the contract ends. If the contract gives no end date we can work out
// (perpetual, or no dates at all), 30 days after the scan. A contract that already ended gets 1 more week.
function deleteAtFor(end: unknown): number {
  const t = typeof end === "string" ? Date.parse(end) : NaN;
  if (Number.isNaN(t)) return Date.now() + 30 * DAY;
  return Math.max(t, Date.now()) + 7 * DAY;
}

// Called by the scan route before any AI call. Counts even if the scan later fails.
export const reserveScan = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await owner(ctx);
    const day = new Date().toISOString().slice(0, 10);
    const row = await ctx.db.query("usage").withIndex("by_owner_day", (q) => q.eq("owner", me).eq("day", day)).unique();
    const used = row?.count ?? 0;
    if (used >= DAILY_SCANS) return { ok: false, limit: DAILY_SCANS };
    if (row) await ctx.db.patch(row._id, { count: used + 1 });
    else await ctx.db.insert("usage", { owner: me, day, count: 1 });
    return { ok: true, limit: DAILY_SCANS };
  },
});

export const save = mutation({
  args: { fileName: v.string(), report: v.any() },
  handler: async (ctx, { fileName, report }) =>
    ctx.db.insert("reports", {
      owner: await owner(ctx),
      fileName: fileName.slice(0, 200),
      brand: String(report?.offer?.brand ?? "").slice(0, 200),
      flagCount: Array.isArray(report?.flags) ? report.flags.length : 0,
      underpaidBy: typeof report?.verdict?.underpaid_by === "number" ? report.verdict.underpaid_by : null,
      report,
      deleteAt: deleteAtFor(report?.contract_end_date),
    }),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) return [];
    const rows = await ctx.db
      .query("reports")
      .withIndex("by_owner", (q) => q.eq("owner", user.tokenIdentifier))
      .order("desc")
      .take(50);
    return rows.map(({ report: _, ...summary }) => summary);
  },
});

export const get = query({
  args: { id: v.id("reports") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    return row && row.owner === (await owner(ctx)) ? row : null;
  },
});

export const remove = mutation({
  args: { id: v.id("reports") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (row && row.owner === (await owner(ctx))) await ctx.db.delete(id);
  },
});

// Runs hourly (convex/crons.ts). Rows saved before auto-delete existed have no deleteAt and are kept.
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("reports")
      .withIndex("by_deleteAt", (q) => q.gt("deleteAt", 0).lt("deleteAt", Date.now()))
      .take(200);
    for (const row of expired) await ctx.db.delete(row._id);
  },
});
