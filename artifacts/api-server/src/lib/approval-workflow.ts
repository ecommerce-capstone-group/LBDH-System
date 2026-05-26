import type { ApprovalStep } from "@workspace/db";
import {
  appraisalWorkflowSteps,
  type AppraisalTemplateType,
} from "@workspace/db/appraisal-templates";

export { appraisalWorkflowSteps };

export function trainingRequestSteps(): ApprovalStep[] {
  return [
    { name: "Unit Head", status: "pending" },
    { name: "Department Head", status: "pending" },
    { name: "HR", status: "pending" },
  ];
}

export function initialAppraisalWorkflow(
  templateType: AppraisalTemplateType,
  opts: {
    evaluator?: string;
    employeeName?: string;
    employeeSelfAssessment?: string;
    hasAppraiserEvaluation?: boolean;
  },
): { steps: ApprovalStep[]; status: string; currentStep: string } {
  const steps: ApprovalStep[] = appraisalWorkflowSteps(templateType).map((s) => ({
    ...s,
  }));
  const ts = new Date().toISOString();

  const approve = (index: number, actor: string) => {
    if (steps[index]) {
      steps[index] = {
        ...steps[index]!,
        status: "approved",
        actor,
        timestamp: ts,
      };
    }
  };

  if (templateType === "non_supervisory") {
    if (opts.hasAppraiserEvaluation) {
      approve(0, opts.evaluator ?? "Appraiser");
    }
  } else {
    if (opts.employeeSelfAssessment?.trim()) {
      approve(0, opts.employeeName ?? "Employee");
    }
    if (opts.hasAppraiserEvaluation) {
      const appraiserIdx = 1;
      if (steps[appraiserIdx]) approve(appraiserIdx, opts.evaluator ?? "Appraiser");
    }
  }

  const pendingIdx = steps.findIndex((s) => s.status === "pending");
  if (pendingIdx < 0) {
    return { steps, status: "approved", currentStep: "Ready for archive" };
  }
  return { steps, status: "pending", currentStep: steps[pendingIdx]!.name };
}

export type AdvanceInput = {
  decision: "approve" | "reject";
  actor?: string | null;
  note?: string | null;
};

export type AdvanceResult = {
  steps: ApprovalStep[];
  status: string;
  currentStep: string;
};

export function advanceApprovalSteps(
  steps: ApprovalStep[],
  existingStatus: string,
  body: AdvanceInput,
  options?: { skipAuto?: boolean },
): AdvanceResult | { error: string; statusCode: number } {
  if (existingStatus !== "pending") {
    return { error: "Already finalized", statusCode: 400 };
  }

  const next = [...steps];
  const idx = next.findIndex((s) => s.status === "pending");
  if (idx < 0) {
    return { error: "No pending step", statusCode: 400 };
  }

  const ts = new Date().toISOString();

  if (body.decision === "reject") {
    next[idx] = {
      ...next[idx]!,
      status: "rejected",
      actor: body.actor ?? null,
      note: body.note ?? null,
      timestamp: ts,
    };
    return {
      steps: next,
      status: "rejected",
      currentStep: next[idx]!.name,
    };
  }

  next[idx] = {
    ...next[idx]!,
    status: "approved",
    actor: body.actor ?? null,
    note: body.note ?? null,
    timestamp: ts,
  };

  const pendingIdx = next.findIndex((s) => s.status === "pending");
  if (pendingIdx < 0) {
    return { steps: next, status: "approved", currentStep: "Ready for archive" };
  }

  if (!options?.skipAuto && next[pendingIdx]!.name === "Auto") {
    next[pendingIdx] = {
      ...next[pendingIdx]!,
      status: "approved",
      actor: "system",
      note: "Auto-approved",
      timestamp: ts,
    };
    return { steps: next, status: "approved", currentStep: "Approved" };
  }

  return {
    steps: next,
    status: "pending",
    currentStep: next[pendingIdx]!.name,
  };
}
