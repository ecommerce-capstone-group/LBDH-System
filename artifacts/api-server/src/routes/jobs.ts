import { Router, type IRouter } from "express";
import { db, jobs, onboardings, pool } from "@workspace/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { CreateJobBody, UpdateJobBody } from "@workspace/api-zod";
import type { Requirement } from "@workspace/db";

const router: IRouter = Router();

type JobRow = typeof jobs.$inferSelect;

let staffNeededReady: Promise<void> | null = null;

function ensureStaffNeededColumn(): Promise<void> {
  if (!staffNeededReady) {
    staffNeededReady = pool
      .query(
        `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS staff_needed integer NOT NULL DEFAULT 1`,
      )
      .then(() => undefined)
      .catch((err) => {
        staffNeededReady = null;
        throw err;
      });
  }
  return staffNeededReady;
}

async function hiredCountByJobIds(jobIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (jobIds.length === 0) return map;

  try {
    const rows = await db
      .select({
        jobId: onboardings.jobId,
        count: sql<number>`count(*)::int`,
      })
      .from(onboardings)
      .where(and(inArray(onboardings.jobId, jobIds), eq(onboardings.status, "hired")))
      .groupBy(onboardings.jobId);

    for (const row of rows) {
      map.set(row.jobId, Number(row.count) || 0);
    }
  } catch (err) {
    console.error("hiredCountByJobIds failed; returning zeros", err);
  }
  return map;
}

function withHiredCount(row: JobRow, hiredCount: number) {
  return {
    ...row,
    staffNeeded: typeof row.staffNeeded === "number" && row.staffNeeded >= 1 ? row.staffNeeded : 1,
    hiredCount,
  };
}

router.get("/jobs", async (req, res) => {
  try {
    await ensureStaffNeededColumn();
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await db
      .select()
      .from(jobs)
      .where(status ? eq(jobs.status, status) : undefined)
      .orderBy(desc(jobs.createdAt));
    const counts = await hiredCountByJobIds(rows.map((r) => r.id));
    res.json(rows.map((row) => withHiredCount(row, counts.get(row.id) ?? 0)));
  } catch (err) {
    console.error("list jobs failed", err);
    res.status(500).json({ error: "Could not list jobs" });
  }
});

router.get("/jobs/:id", async (req, res) => {
  try {
    await ensureStaffNeededColumn();
    const id = Number(req.params.id);
    const [row] = await db.select().from(jobs).where(eq(jobs.id, id));
    if (!row) return res.status(404).json({ error: "Not found" });
    const counts = await hiredCountByJobIds([id]);
    res.json(withHiredCount(row, counts.get(id) ?? 0));
  } catch (err) {
    console.error("get job failed", err);
    res.status(500).json({ error: "Could not get job" });
  }
});

router.post("/jobs", async (req, res) => {
  try {
    await ensureStaffNeededColumn();
    const body = CreateJobBody.parse(req.body);
    const staffNeeded =
      typeof body.staffNeeded === "number" && body.staffNeeded >= 1
        ? Math.floor(body.staffNeeded)
        : 1;
    const [row] = await db
      .insert(jobs)
      .values({
        title: body.title,
        department: body.department,
        description: body.description,
        requirements: body.requirements as Requirement[],
        staffNeeded,
        status: body.status ?? "active",
      })
      .returning();
    res.status(201).json(withHiredCount(row!, 0));
  } catch (err) {
    console.error("create job failed", err);
    res.status(500).json({ error: "Could not create job" });
  }
});

router.patch("/jobs/:id", async (req, res) => {
  try {
    await ensureStaffNeededColumn();
    const id = Number(req.params.id);
    const body = UpdateJobBody.parse(req.body);
    const patch: Partial<JobRow> = {
      title: body.title,
      department: body.department,
      description: body.description,
      requirements: body.requirements as Requirement[],
    };
    if (body.status) {
      patch.status = body.status;
    }
    if (typeof body.staffNeeded === "number" && body.staffNeeded >= 1) {
      patch.staffNeeded = Math.floor(body.staffNeeded);
    }
    const [row] = await db.update(jobs).set(patch).where(eq(jobs.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    const counts = await hiredCountByJobIds([id]);
    res.json(withHiredCount(row, counts.get(id) ?? 0));
  } catch (err) {
    console.error("update job failed", err);
    res.status(500).json({ error: "Could not update job" });
  }
});

router.delete("/jobs/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(jobs).where(eq(jobs.id, id));
  res.status(204).end();
});

export default router;
