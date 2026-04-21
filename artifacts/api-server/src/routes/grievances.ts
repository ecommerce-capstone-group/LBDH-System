import { Router, type IRouter } from "express";
import { db, grievances } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateGrievanceBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/grievances", async (req, res) => {
  const employeeId = req.query.employeeId
    ? Number(req.query.employeeId)
    : undefined;
  const rows = await db
    .select()
    .from(grievances)
    .where(employeeId ? eq(grievances.employeeId, employeeId) : undefined)
    .orderBy(desc(grievances.createdAt));
  res.json(rows);
});

router.post("/grievances", async (req, res) => {
  const body = CreateGrievanceBody.parse(req.body);
  const [row] = await db
    .insert(grievances)
    .values({
      employeeId: body.employeeId,
      subject: body.subject,
      description: body.description,
      status: body.status ?? "open",
    })
    .returning();
  res.status(201).json(row);
});

export default router;
