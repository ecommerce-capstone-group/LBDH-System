import { Router, type IRouter } from "express";
import { db, applicants, jobs } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateApplicantBody } from "@workspace/api-zod";
import type { Requirement, RequirementMatch } from "@workspace/db";

const router: IRouter = Router();

router.get("/applicants", async (req, res) => {
  const jobId = req.query.jobId ? Number(req.query.jobId) : undefined;
  const rows = await db
    .select()
    .from(applicants)
    .where(jobId ? eq(applicants.jobId, jobId) : undefined)
    .orderBy(desc(applicants.totalScore));
  res.json(rows);
});

router.get("/applicants/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(applicants).where(eq(applicants.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.post("/applicants", async (req, res) => {
  const body = CreateApplicantBody.parse(req.body);
  const [job] = await db.select().from(jobs).where(eq(jobs.id, body.jobId));
  if (!job) return res.status(404).json({ error: "Job not found" });

  const reqs = (job.requirements as Requirement[]) ?? [];
  const answersByLabel = new Map<string, boolean | number>();
  for (const a of body.answers) answersByLabel.set(a.label, a.value);

  let total = 0;
  const matches: RequirementMatch[] = [];
  for (const r of reqs) {
    const value = answersByLabel.get(r.label);
    let score = 0;
    if (r.kind === "checkbox") {
      const checked = value === true;
      score = checked ? r.weight : 0;
    } else if (r.kind === "number") {
      const num = typeof value === "number" ? value : 0;
      const max = r.max && r.max > 0 ? r.max : 1;
      const ratio = Math.min(num / max, 1);
      score = ratio * r.weight;
    }
    total += score;
    matches.push({
      label: r.label,
      kind: r.kind,
      value: value ?? (r.kind === "checkbox" ? false : 0),
      score: Math.round(score * 100) / 100,
      weight: r.weight,
    });
  }
  const totalScore = Math.min(Math.round(total * 100) / 100, 100);

  if (job.status !== "active") {
    return res.status(400).json({ error: "This job is no longer accepting applications" });
  }

  const [row] = await db
    .insert(applicants)
    .values({
      jobId: body.jobId,
      name: body.name,
      email: body.email,
      phone: body.phone,
      skills: body.skills,
      experience: body.experience,
      resume: body.resume,
      totalScore,
      matches,
    })
    .returning();
  res.status(201).json(row);
});

router.delete("/applicants/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(applicants).where(eq(applicants.id, id));
  res.status(204).end();
});

export default router;
