import type { ApprovalStep } from "@workspace/db";

export function trainingRequestSteps(): ApprovalStep[] {
  return [
    { name: "Unit Head", status: "pending" },
    { name: "Department Head", status: "pending" },
    { name: "HR", status: "pending" },
  ];
}

export function appraisalWorkflowSteps(
  templateType: "non_supervisory" | "supervisory",
): ApprovalStep[] {
  const steps: ApprovalStep[] = [
    { name: "Employee Self-Assessment", status: "pending" },
    { name: "Appraiser Evaluation", status: "pending" },
  ];
  if (templateType === "non_supervisory") {
    steps.push({ name: "Department Head Review", status: "pending" });
  }
  steps.push({ name: "HR Final Review", status: "pending" });
  return steps;
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
    return { steps: next, status: "approved", currentStep: "Approved" };
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
