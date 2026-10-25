import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Only scrubbed reports are stored. The contract file itself is never saved.
export default defineSchema({
  reports: defineTable({
    owner: v.string(), // Auth0 token identifier
    fileName: v.string(),
    brand: v.string(),
    flagCount: v.number(),
    underpaidBy: v.union(v.number(), v.null()),
    report: v.any(),
    deleteAt: v.optional(v.number()), // auto-delete time: 1 week after the contract ends
  })
    .index("by_owner", ["owner"])
    .index("by_deleteAt", ["deleteAt"]),
  // scans per user per day (UTC), so one account can't run up the AI bill
  usage: defineTable({ owner: v.string(), day: v.string(), count: v.number() }).index("by_owner_day", ["owner", "day"]),
});
