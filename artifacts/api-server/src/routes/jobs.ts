import { Router, type IRouter } from "express";
import { db, jobs } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateJobBody, UpdateJobBody } from "@workspace/api-zod";
import type { Requirement } from "@workspace/db";

const router: IRouter = Router();

router.get("/jobs", async (_req, res) => {
  const rows = await db.select().from(jobs).orderBy(jobs.createdAt);
  res.json(rows);
});

router.get("/jobs/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.post("/jobs", async (req, res) => {
  const body = CreateJobBody.parse(req.body);
  const [row] = await db
    .insert(jobs)
    .values({
      title: body.title,
      department: body.department,
      description: body.description,
      requirements: body.requirements as Requirement[],
      status: body.status ?? "active",
    })
    .returning();
  res.status(201).json(row);
});

router.patch("/jobs/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = UpdateJobBody.parse(req.body);
  const [row] = await db
    .update(jobs)
    .set({
      title: body.title,
      department: body.department,
      description: body.description,
      requirements: body.requirements as Requirement[],
      ...(body.status ? { status: body.status } : {}),
    })
    .where(eq(jobs.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.delete("/jobs/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(jobs).where(eq(jobs.id, id));
  res.status(204).end();
});

export default router;
