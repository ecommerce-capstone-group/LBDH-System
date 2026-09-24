import { Router, type IRouter } from "express";
import { db, jobs, onboardings } from "@workspace/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { CreateJobBody, UpdateJobBody } from "@workspace/api-zod";
import type { Requirement } from "@workspace/db";

const router: IRouter = Router();

type JobRow = typeof jobs.$inferSelect;

async function hiredCountByJobIds(jobIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (jobIds.length === 0) return map;

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
  return map;
}

function withHiredCount(row: JobRow, hiredCount: number) {
  return {
    ...row,
    staffNeeded: row.staffNeeded ?? 1,
    hiredCount,
  };
}

router.get("/jobs", async (req, res) => {
  const status =
    typeof req.query.status === "string" ? req.query.status : undefined;
  const rows = await db
    .select()
    .from(jobs)
    .where(status ? eq(jobs.status, status) : undefined)
    .orderBy(desc(jobs.createdAt));
  const counts = await hiredCountByJobIds(rows.map((r) => r.id));
  res.json(rows.map((row) => withHiredCount(row, counts.get(row.id) ?? 0)));
});

router.get("/jobs/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  const counts = await hiredCountByJobIds([id]);
  res.json(withHiredCount(row, counts.get(id) ?? 0));
});

router.post("/jobs", async (req, res) => {
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
});

router.patch("/jobs/:id", async (req, res) => {
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
});

router.delete("/jobs/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(jobs).where(eq(jobs.id, id));
  res.status(204).end();
});

export default router;
