import { Router, type IRouter } from "express";
import { db, appraisals } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateAppraisalBody } from "@workspace/api-zod";
import { validateAndComputeAppraisal } from "../lib/appraisal-validation";

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

  const { criterionScores, totalScore } = validateAndComputeAppraisal(
    body.templateType,
    body.criterionScores,
  );

  const [row] = await db
    .insert(appraisals)
    .values({
      employeeId: body.employeeId,
      templateType: body.templateType,
      appraisalType: body.appraisalType,
      employeeName: body.employeeName,
      department: body.department,
      position: body.position,
      hireDate: body.hireDate ?? null,
      appraisalPeriod: body.appraisalPeriod,
      evaluator: body.evaluator,
      evaluatorPosition: body.evaluatorPosition,
      appraisalDate: body.appraisalDate ?? null,
      strengths: body.strengths ?? "",
      areasForImprovement: body.areasForImprovement ?? "",
      suggestedActionPlan: body.suggestedActionPlan ?? "",
      shortTermGoals: body.shortTermGoals ?? "",
      longTermGoals: body.longTermGoals ?? "",
      criterionScores,
      totalScore,
      recommendation: body.recommendation ?? "",
      employeeAcknowledgement: body.employeeAcknowledgement ?? "",
      signatories: body.signatories,
    })
    .returning();
  res.status(201).json(row);
});

export default router;
