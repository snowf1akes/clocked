import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("delete expired reports", { hours: 1 }, internal.reports.purgeExpired);
export default crons;
