import { Router, type IRouter } from "express";
import { db, offboardings, employees, jobs } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateOffboardingBody,
  UpdateOffboardingBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/offboardings", async (_req, res) => {
  const rows = await db
    .select()
    .from(offboardings)
    .orderBy(desc(offboardings.createdAt));
  res.json(rows);
});

router.post("/offboardings", async (req, res) => {
  const body = CreateOffboardingBody.parse(req.body);
  const [emp] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, body.employeeId));
  if (!emp) return res.status(404).json({ error: "Employee not found" });

  let replacementJobId: number | null = null;
  if (body.createReplacementJob) {
    const [job] = await db
      .insert(jobs)
      .values({
        title: emp.role,
        department: emp.department,
        description: `Replacement role for ${emp.name} (${emp.role}, ${emp.department}).`,
        requirements: [],
        status: "active",
      })
      .returning();
    replacementJobId = job?.id ?? null;
  }

  await db
    .update(employees)
    .set({ status: "offboarding" })
    .where(eq(employees.id, body.employeeId));

  const [row] = await db
    .insert(offboardings)
    .values({
      employeeId: body.employeeId,
      reason: body.reason,
      exitInterview: body.exitInterview ?? "",
      replacementJobId,
    })
    .returning();
  res.status(201).json(row);
});

router.patch("/offboardings/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = UpdateOffboardingBody.parse(req.body);
  const [existing] = await db
    .select()
    .from(offboardings)
    .where(eq(offboardings.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  const next = {
    exitInterview: body.exitInterview ?? existing.exitInterview,
    hrCleared: body.hrCleared ?? existing.hrCleared,
    itCleared: body.itCleared ?? existing.itCleared,
    financeCleared: body.financeCleared ?? existing.financeCleared,
    status: body.status ?? existing.status,
  };

  if (
    next.hrCleared &&
    next.itCleared &&
    next.financeCleared &&
    next.status !== "Completed"
  ) {
    next.status = "Completed";
  }

  const [row] = await db
    .update(offboardings)
    .set(next)
    .where(eq(offboardings.id, id))
    .returning();

  if (next.status === "Completed") {
    await db
      .update(employees)
      .set({ status: "left" })
      .where(eq(employees.id, existing.employeeId));
  }

  res.json(row);
});

export default router;
