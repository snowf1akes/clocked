// A user's saved scans. Every function looks up the caller from their Auth0 token
// and only ever reads or deletes rows they own.
import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";

async function owner(ctx: QueryCtx) {
  const user = await ctx.auth.getUserIdentity();
  if (!user) throw new Error("Sign in first.");
  return user.tokenIdentifier;
}

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
