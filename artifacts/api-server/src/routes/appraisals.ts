import { Router, type IRouter } from "express";
import { db, appraisals } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateAppraisalBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/appraisals", async (req, res) => {
  const employeeId = req.query.employeeId
    ? Number(req.query.employeeId)
    : undefined;
  const rows = await db
    .select()
    .from(appraisals)
    .where(employeeId ? eq(appraisals.employeeId, employeeId) : undefined)
    .orderBy(desc(appraisals.createdAt));
  res.json(rows);
});

router.post("/appraisals", async (req, res) => {
  const body = CreateAppraisalBody.parse(req.body);
  const [row] = await db.insert(appraisals).values(body).returning();
  res.status(201).json(row);
});

export default router;
