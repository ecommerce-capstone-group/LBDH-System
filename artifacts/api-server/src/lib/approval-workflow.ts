import type { ApprovalStep } from "@workspace/db";
import {
  appraisalWorkflowSteps,
  approverRoleForAppraisalStep,
  type AppraisalApproverRole,
  type AppraisalTemplateType,
} from "@workspace/db/appraisal-templates";

export { appraisalWorkflowSteps, approverRoleForAppraisalStep };
export type { AppraisalApproverRole };

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

  const approveByName = (nameIncludes: string, actor: string) => {
    const index = steps.findIndex((s) =>
      s.name.toLowerCase().includes(nameIncludes.toLowerCase()),
    );
    if (index >= 0 && steps[index]) {
      steps[index] = {
        ...steps[index]!,
        status: "approved",
        actor,
        timestamp: ts,
      };
    }
  };

  // Self-assessment only auto-completes when text was provided at create time.
  if (opts.employeeSelfAssessment?.trim()) {
    approveByName("Self-Assessment", opts.employeeName ?? "Employee");
  }

  // Scoring/evaluation submitted with the form marks Appraiser Evaluation done.
  // Unit Head / Department / HR remain pending for their authorized approvers.
  if (opts.hasAppraiserEvaluation) {
    approveByName("Appraiser Evaluation", opts.evaluator ?? "Appraiser");
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

export function assertAppraisalAdvanceAuthorized(
  stepName: string,
  actorRole: string | null | undefined,
): { error: string; statusCode: number } | null {
  const required = approverRoleForAppraisalStep(stepName);
  if (!required) {
    return {
      error: `Unknown appraisal step: ${stepName}`,
      statusCode: 400,
    };
  }
  if (!actorRole || actorRole !== required) {
    const label =
      required === "employee"
        ? "the employee"
        : required === "unit_head"
          ? "a Unit Head"
          : "HR";
    return {
      error: `Only ${label} can approve or reject the "${stepName}" stage.`,
      statusCode: 403,
    };
  }
  return null;
}
