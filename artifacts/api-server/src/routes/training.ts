import { Router, type IRouter } from "express";
import {
  db,
  trainingPlans,
  trainingRecords,
  trainingEnrollments,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import type { ApprovalStep } from "@workspace/db";
import {
  CreateTrainingPlanBody,
  CreateTrainingRecordBody,
  EnrollTrainingPlanBody,
  AssignTrainingPlanBody,
  AdvanceTrainingPlanBody,
} from "@workspace/api-zod";
import {
  advanceApprovalSteps,
  trainingRequestSteps,
} from "../lib/approval-workflow";

const router: IRouter = Router();

router.get("/training-plans", async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const category = req.query.category as string | undefined;
  const employeeId = req.query.employeeId
    ? Number(req.query.employeeId)
    : undefined;
  const conds = [];
  if (year && !Number.isNaN(year)) conds.push(eq(trainingPlans.year, year));
  if (category) conds.push(eq(trainingPlans.category, category));
  if (employeeId && !Number.isNaN(employeeId))
    conds.push(eq(trainingPlans.employeeId, employeeId));
  const rows = await db
    .select()
    .from(trainingPlans)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(trainingPlans.createdAt));
  res.json(rows);
});

router.post("/training-plans", async (req, res) => {
  const body = CreateTrainingPlanBody.parse(req.body);
  const isDepartmental = body.category === "departmental_request";

  let status = "published";
  let currentStep = "";
  let steps: ApprovalStep[] = [];

  if (isDepartmental) {
    if (!body.employeeId) {
      return res
        .status(400)
        .json({ error: "employeeId required for departmental training requests" });
    }
    status = "pending";
    steps = trainingRequestSteps();
    currentStep = "Unit Head";
  }

  const [row] = await db
    .insert(trainingPlans)
    .values({
      year: body.year,
      category: body.category,
      title: body.title,
      description: body.description ?? "",
      trainingHours: body.trainingHours ?? 0,
      plannedDate: body.plannedDate ?? null,
      department: body.department ?? null,
      employeeId: body.employeeId ?? null,
      status,
      currentStep,
      steps,
    })
    .returning();
  res.status(201).json(row);
});

router.post("/training-plans/:id/advance", async (req, res) => {
  const id = Number(req.params.id);
  const bodyRaw = AdvanceTrainingPlanBody.parse(req.body);
  if (bodyRaw.decision !== "approve" && bodyRaw.decision !== "reject") {
    return res.status(400).json({ error: "Invalid decision (approve | reject)" });
  }
  const body = {
    ...bodyRaw,
    decision: bodyRaw.decision as "approve" | "reject",
  };
  const [existing] = await db
    .select()
    .from(trainingPlans)
    .where(eq(trainingPlans.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.category !== "departmental_request") {
    return res.status(400).json({ error: "Only departmental requests use approval" });
  }

  const result = advanceApprovalSteps(
    [...(existing.steps as ApprovalStep[])],
    existing.status,
    body,
    { skipAuto: true },
  );
  if ("error" in result) {
    return res.status(result.statusCode).json({ error: result.error });
  }

  const [row] = await db
    .update(trainingPlans)
    .set({
      steps: result.steps,
      status: result.status,
      currentStep: result.currentStep,
    })
    .where(eq(trainingPlans.id, id))
    .returning();
  res.json(row);
});

router.post("/training-plans/:id/enroll", async (req, res) => {
  const planId = Number(req.params.id);
  const body = EnrollTrainingPlanBody.parse(req.body);
  const [plan] = await db
    .select()
    .from(trainingPlans)
    .where(eq(trainingPlans.id, planId));
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  if (plan.category !== "hospital_required") {
    return res
      .status(400)
      .json({ error: "Only hospital-required trainings accept enrollment" });
  }
  if (plan.status !== "published") {
    return res.status(400).json({ error: "Training is not open for enrollment" });
  }

  const existing = await db
    .select()
    .from(trainingEnrollments)
    .where(
      and(
        eq(trainingEnrollments.planId, planId),
        eq(trainingEnrollments.employeeId, body.employeeId),
      ),
    );
  if (existing.length > 0) {
    return res.status(400).json({ error: "Already enrolled" });
  }

  const [row] = await db
    .insert(trainingEnrollments)
    .values({
      planId,
      employeeId: body.employeeId,
      status: "enrolled",
    })
    .returning();
  res.status(201).json(row);
});

router.post("/training-plans/:id/assign", async (req, res) => {
  const planId = Number(req.params.id);
  const body = AssignTrainingPlanBody.parse(req.body);
  const [plan] = await db
    .select()
    .from(trainingPlans)
    .where(eq(trainingPlans.id, planId));
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  if (plan.status !== "published" && plan.status !== "approved") {
    return res.status(400).json({ error: "Training is not available for assignment" });
  }

  const enrolled = [];
  const skippedEmployeeIds: number[] = [];

  for (const employeeId of body.employeeIds) {
    const existing = await db
      .select()
      .from(trainingEnrollments)
      .where(
        and(
          eq(trainingEnrollments.planId, planId),
          eq(trainingEnrollments.employeeId, employeeId),
        ),
      );
    if (existing.length > 0) {
      skippedEmployeeIds.push(employeeId);
      continue;
    }

    const [row] = await db
      .insert(trainingEnrollments)
      .values({
        planId,
        employeeId,
        status: "enrolled",
      })
      .returning();
    enrolled.push(row);
  }

  res.status(201).json({ enrolled, skippedEmployeeIds });
});

router.get("/training-enrollments", async (req, res) => {
  const employeeId = req.query.employeeId
    ? Number(req.query.employeeId)
    : undefined;
  const planId = req.query.planId ? Number(req.query.planId) : undefined;
  const conds = [];
  if (employeeId && !Number.isNaN(employeeId))
    conds.push(eq(trainingEnrollments.employeeId, employeeId));
  if (planId && !Number.isNaN(planId))
    conds.push(eq(trainingEnrollments.planId, planId));
  const rows = await db
    .select()
    .from(trainingEnrollments)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(trainingEnrollments.createdAt));
  res.json(rows);
});

router.get("/training-records", async (req, res) => {
  const employeeId = req.query.employeeId
    ? Number(req.query.employeeId)
    : undefined;
  const rows = await db
    .select()
    .from(trainingRecords)
    .where(
      employeeId && !Number.isNaN(employeeId)
        ? eq(trainingRecords.employeeId, employeeId)
        : undefined,
    )
    .orderBy(desc(trainingRecords.trainingDate));
  res.json(rows);
});

router.post("/training-records", async (req, res) => {
  const body = CreateTrainingRecordBody.parse(req.body);
  const [row] = await db
    .insert(trainingRecords)
    .values({
      employeeId: body.employeeId,
      planId: body.planId ?? null,
      enrollmentId: body.enrollmentId ?? null,
      trainingName: body.trainingName,
      trainingDate: body.trainingDate,
      trainingHours: body.trainingHours,
      trainingType: body.trainingType,
      completionStatus: body.completionStatus ?? "completed",
      remarks: body.remarks ?? "",
      contractAgreement: body.contractAgreement ?? "",
      fileReference: body.fileReference ?? "",
    })
    .returning();
  res.status(201).json(row);
});

export default router;
