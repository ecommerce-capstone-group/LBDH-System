import { Router, type IRouter } from "express";
import { db, appraisals } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateAppraisalBody,
  AdvanceAppraisalBody,
  ArchiveAppraisalBody,
} from "@workspace/api-zod";
import type { ApprovalStep } from "@workspace/db";
import { validateAndComputeAppraisal } from "../lib/appraisal-validation";
import {
  advanceApprovalSteps,
  initialAppraisalWorkflow,
} from "../lib/approval-workflow";

const router: IRouter = Router();

router.get("/appraisals", async (req, res) => {
  try {
    const employeeId = req.query.employeeId
      ? Number(req.query.employeeId)
      : undefined;
    const rows = await db
      .select()
      .from(appraisals)
      .where(employeeId ? eq(appraisals.employeeId, employeeId) : undefined)
      .orderBy(desc(appraisals.createdAt));
    res.json(rows);
  } catch (err) {
    console.error("list appraisals failed", err);
    const message =
      err instanceof Error ? err.message : "Could not load appraisals";
    res.status(500).json({
      error: message,
      hint: "Run pnpm run db:migrate-training-appraisals against this DATABASE_URL if schema is outdated.",
    });
  }
});

router.post("/appraisals", async (req, res) => {
  try {
    const body = CreateAppraisalBody.parse(req.body);

    const { criterionScores, totalScore } = validateAndComputeAppraisal(
      body.templateType,
      body.criterionScores,
    );

    const hasAppraiserEvaluation = body.criterionScores.length > 0;
    const { steps, status, currentStep } = initialAppraisalWorkflow(
      body.templateType,
      {
        evaluator: body.evaluator,
        employeeName: body.employeeName,
        employeeSelfAssessment: body.employeeSelfAssessment ?? "",
        hasAppraiserEvaluation,
      },
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
        status,
        currentStep,
        steps,
        employeeSelfAssessment: body.employeeSelfAssessment ?? "",
        appraiserComments: body.appraiserComments ?? "",
        departmentHeadComments: body.departmentHeadComments ?? "",
        hrComments: body.hrComments ?? "",
        signedFormReference: body.signedFormReference ?? "",
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("create appraisal failed", err);
    if (err instanceof Error && err.name === "ZodError") {
      return res.status(400).json({ error: "Invalid appraisal data" });
    }
    const message =
      err instanceof Error ? err.message : "Could not save appraisal";
    res.status(500).json({ error: message });
  }
});

router.post("/appraisals/:id/advance", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = AdvanceAppraisalBody.parse(req.body);
    const [existing] = await db
      .select()
      .from(appraisals)
      .where(eq(appraisals.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.status === "archived") {
      return res.status(400).json({ error: "Appraisal is archived" });
    }

    const stepsCopy = [...(existing.steps as ApprovalStep[])];
    const pendingIdx = stepsCopy.findIndex((s) => s.status === "pending");
    const stepName = pendingIdx >= 0 ? stepsCopy[pendingIdx]!.name : "";

    const result = advanceApprovalSteps(
      stepsCopy,
      existing.status === "archived" ? "pending" : existing.status,
      body,
      { skipAuto: true },
    );
    if ("error" in result) {
      return res.status(result.statusCode).json({ error: result.error });
    }

    const note = body.note?.trim() ?? "";
    const commentPatch: Record<string, string> = {};
    if (note) {
      if (stepName.includes("Department Head")) {
        commentPatch.departmentHeadComments = note;
      } else if (stepName.includes("HR Department")) {
        commentPatch.hrComments = note;
      } else if (
        stepName.includes("Employee Acknowledgement") ||
        stepName.includes("Supervisor/Manager Acknowledgement")
      ) {
        commentPatch.employeeAcknowledgement = note;
      } else if (stepName.includes("Appraiser")) {
        commentPatch.appraiserComments = note;
      } else if (stepName.includes("Self-Assessment")) {
        commentPatch.employeeSelfAssessment = note;
      }
    }

    const [row] = await db
      .update(appraisals)
      .set({
        steps: result.steps,
        status: result.status,
        currentStep: result.currentStep,
        ...commentPatch,
      })
      .where(eq(appraisals.id, id))
      .returning();
    res.json(row);
  } catch (err) {
    console.error("advance appraisal failed", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Could not advance appraisal",
    });
  }
});

router.post("/appraisals/:id/archive", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = ArchiveAppraisalBody.parse(req.body ?? {});
    const [existing] = await db
      .select()
      .from(appraisals)
      .where(eq(appraisals.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.status !== "approved") {
      return res.status(400).json({
        error:
          "Complete all review and signature steps before archiving to employee history.",
      });
    }

    const [row] = await db
      .update(appraisals)
      .set({
        status: "archived",
        currentStep: "Archived",
        archivedAt: new Date(),
        signedFormReference:
          body.signedFormReference ?? existing.signedFormReference,
      })
      .where(eq(appraisals.id, id))
      .returning();
    res.json(row);
  } catch (err) {
    console.error("archive appraisal failed", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Could not archive appraisal",
    });
  }
});

export default router;
