import { Router, type IRouter } from "express";
import { db, employees, jobs, applicants, leaves, requests } from "@workspace/db";
import { eq, sql, and, lte, gte, isNotNull } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res) => {
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + 30);
  const todayStr = now.toISOString().slice(0, 10);
  const futureStr = future.toISOString().slice(0, 10);

  const [empCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(employees)
    .where(eq(employees.status, "active"));
  const [jobCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(jobs)
    .where(eq(jobs.status, "active"));
  const [appCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(applicants);
  const [pendingLeaves] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(leaves)
    .where(eq(leaves.status, "pending"));
  const [pendingReqs] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(requests)
    .where(eq(requests.status, "pending"));
  const [expiring] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(employees)
    .where(
      and(
        isNotNull(employees.licenseExpiry),
        gte(employees.licenseExpiry, todayStr),
        lte(employees.licenseExpiry, futureStr),
      ),
    );

  res.json({
    totalEmployees: empCount?.c ?? 0,
    activeJobs: jobCount?.c ?? 0,
    totalApplicants: appCount?.c ?? 0,
    pendingRequests: (pendingLeaves?.c ?? 0) + (pendingReqs?.c ?? 0),
    expiringLicenses: expiring?.c ?? 0,
  });
});

export default router;
