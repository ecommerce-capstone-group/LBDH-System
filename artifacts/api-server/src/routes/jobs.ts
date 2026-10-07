import { Router, type IRouter } from "express";
import { db, jobs, applicants, manpowerRequests, pool } from "@workspace/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { CreateJobBody, UpdateJobBody } from "@workspace/api-zod";
import type { Requirement } from "@workspace/db";
import { ensureManpowerRequestSchema } from "./manpower-requests";

const router: IRouter = Router();

type JobRow = typeof jobs.$inferSelect;

let staffNeededReady: Promise<void> | null = null;

function ensureStaffNeededColumn(): Promise<void> {
  if (!staffNeededReady) {
    staffNeededReady = pool
      .query(
        `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS staff_needed integer NOT NULL DEFAULT 1;
         ALTER TABLE jobs ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT ''`,
      )
      .then(() => undefined)
      .catch((err) => {
        staffNeededReady = null;
        throw err;
      });
  }
  return staffNeededReady;
}

type JobCounts = { applicantCount: number; hiredCount: number };

async function jobCountsByIds(jobIds: number[]): Promise<Map<number, JobCounts>> {
  const map = new Map<number, JobCounts>();
  if (jobIds.length === 0) return map;

  const [applicantRows, hiredRows] = await Promise.all([
    db
      .select({
        jobId: applicants.jobId,
        count: sql<number>`count(*)::int`,
      })
      .from(applicants)
      .where(inArray(applicants.jobId, jobIds))
      .groupBy(applicants.jobId),
    db
      .select({
        jobId: applicants.jobId,
        count: sql<number>`count(*)::int`,
      })
      .from(applicants)
      .where(
        and(inArray(applicants.jobId, jobIds), eq(applicants.stage, "Onboarded")),
      )
      .groupBy(applicants.jobId),
  ]);
  for (const jobId of jobIds) map.set(jobId, { applicantCount: 0, hiredCount: 0 });
  for (const row of applicantRows) {
    map.get(row.jobId)!.applicantCount = Number(row.count) || 0;
  }
  for (const row of hiredRows) {
    map.get(row.jobId)!.hiredCount = Number(row.count) || 0;
  }
  return map;
}

function withJobCounts(row: JobRow, counts: JobCounts = { applicantCount: 0, hiredCount: 0 }) {
  const staffNeeded =
    typeof row.staffNeeded === "number" && row.staffNeeded >= 1 ? row.staffNeeded : 1;
  return {
    ...row,
    staffNeeded,
    applicantCount: counts.applicantCount,
    hiredCount: counts.hiredCount,
    remainingVacancy: Math.max(0, staffNeeded - counts.hiredCount),
  };
}

router.get("/jobs", async (req, res) => {
  try {
    await ensureStaffNeededColumn();
    await ensureManpowerRequestSchema();
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await db
      .select()
      .from(jobs)
      .where(status ? eq(jobs.status, status) : undefined)
      .orderBy(desc(jobs.createdAt));
    const counts = await jobCountsByIds(rows.map((r) => r.id));
    res.json(rows.map((row) => withJobCounts(row, counts.get(row.id))));
  } catch (err) {
    console.error("list jobs failed", err);
    res.status(500).json({ error: "Could not list jobs" });
  }
});

router.get("/jobs/:id", async (req, res) => {
  try {
    await ensureStaffNeededColumn();
    await ensureManpowerRequestSchema();
    const id = Number(req.params.id);
    const [row] = await db.select().from(jobs).where(eq(jobs.id, id));
    if (!row) return res.status(404).json({ error: "Not found" });
    const counts = await jobCountsByIds([id]);
    res.json(withJobCounts(row, counts.get(id)));
  } catch (err) {
    console.error("get job failed", err);
    res.status(500).json({ error: "Could not get job" });
  }
});

router.post("/jobs", async (req, res) => {
  try {
    await ensureStaffNeededColumn();
    await ensureManpowerRequestSchema();
    const body = CreateJobBody.parse(req.body);
    const manpowerRequestId = body.manpowerRequestId;
    if (typeof manpowerRequestId !== "number" || !Number.isInteger(manpowerRequestId) || manpowerRequestId < 1) {
      return res.status(400).json({ error: "An approved manpower request is required to post a job." });
    }
    const result = await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(manpowerRequests)
        .where(eq(manpowerRequests.id, manpowerRequestId))
        .for("update");
      if (!request) {
        return { ok: false as const, error: "Manpower request not found", status: 404 };
      }
      const approvals = request.approvals;
      if (
        request.status !== "approved" ||
        !Array.isArray(approvals) ||
        approvals.length !== 3 ||
        approvals.some((step) => step.status !== "approved")
      ) {
        return {
          ok: false as const,
          error: "The manpower request must have all three approvals before posting.",
          status: 400,
        };
      }
      const [existingJob] = await tx
        .select({ id: jobs.id })
        .from(jobs)
        .where(eq(jobs.manpowerRequestId, request.id));
      if (existingJob) {
        return {
          ok: false as const,
          error: "A job has already been posted for this manpower request.",
          status: 409,
        };
      }
      const [row] = await tx
        .insert(jobs)
        .values({
          title: request.position,
          unit: request.unit,
          department: request.department,
          description: `Job Description\n${request.jobDescription}\n\nQualifications\n${request.qualifications}`,
          requirements: body.requirements as Requirement[],
          staffNeeded: request.staffNeeded,
          manpowerRequestId: request.id,
          status: "active",
        })
        .returning();
      return { ok: true as const, row: row! };
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.status(201).json(withJobCounts(result.row, { applicantCount: 0, hiredCount: 0 }));
  } catch (err) {
    console.error("create job failed", err);
    res.status(500).json({ error: "Could not create job" });
  }
});

router.patch("/jobs/:id", async (req, res) => {
  try {
    await ensureStaffNeededColumn();
    await ensureManpowerRequestSchema();
    const id = Number(req.params.id);
    const body = UpdateJobBody.parse(req.body);
    const patch: Partial<JobRow> = {
      title: body.title,
      department: body.department,
      description: body.description,
      requirements: body.requirements as Requirement[],
    };
    if (typeof body.unit === "string") {
      patch.unit = body.unit.trim() || body.department.trim();
    }
    if (body.status) {
      patch.status = body.status;
    }
    if (typeof body.staffNeeded === "number" && body.staffNeeded >= 1) {
      patch.staffNeeded = Math.floor(body.staffNeeded);
    }
    const [row] = await db.update(jobs).set(patch).where(eq(jobs.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    const counts = await jobCountsByIds([id]);
    res.json(withJobCounts(row, counts.get(id)));
  } catch (err) {
    console.error("update job failed", err);
    res.status(500).json({ error: "Could not update job" });
  }
});

router.delete("/jobs/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await ensureManpowerRequestSchema();
    await db.delete(jobs).where(eq(jobs.id, id));
    res.status(204).end();
  } catch (err) {
    console.error("delete job failed", err);
    res.status(500).json({ error: "Could not delete job" });
  }
});

export default router;
