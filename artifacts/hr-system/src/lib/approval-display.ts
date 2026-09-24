import type { ApprovalStep } from "@workspace/api-client-react";

export const UNIT_HEAD_STEP = "Unit Head";
export const DEPARTMENT_HEAD_STEP = "Department Head";

export type StageStatus = "pending" | "approved" | "rejected";

export function findStage(
  steps: ApprovalStep[] | null | undefined,
  name: string,
): ApprovalStep | undefined {
  return steps?.find((s) => s.name === name);
}

export function stageStatus(
  steps: ApprovalStep[] | null | undefined,
  name: string,
): StageStatus {
  const step = findStage(steps, name);
  if (!step) return "pending";
  if (step.status === "approved" || step.status === "rejected") {
    return step.status;
  }
  return "pending";
}

/** Latest approval timestamp across approved stages, if any. */
export function latestApprovalDate(
  steps: ApprovalStep[] | null | undefined,
): string | null {
  if (!steps?.length) return null;
  let latest: string | null = null;
  for (const step of steps) {
    if (step.status === "approved" && step.timestamp) {
      if (!latest || step.timestamp > latest) latest = step.timestamp;
    }
  }
  return latest;
}

/** Timestamp of final approval when overall status is approved. */
export function finalApprovalDate(
  status: string,
  steps: ApprovalStep[] | null | undefined,
): string | null {
  if (status !== "approved") return latestApprovalDate(steps);
  if (!steps?.length) return null;
  const approved = [...steps]
    .filter((s) => s.status === "approved" && s.timestamp)
    .sort((a, b) => (a.timestamp! > b.timestamp! ? -1 : 1));
  return approved[0]?.timestamp ?? null;
}

export function formatApprovalDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function canActOnStep(
  currentStep: string,
  actorRole: string | null | undefined,
): boolean {
  if (!actorRole) return false;
  if (actorRole === "hr") return true;
  if (actorRole === "unit_head") {
    return currentStep === UNIT_HEAD_STEP;
  }
  if (actorRole === "department_head") {
    return currentStep === DEPARTMENT_HEAD_STEP;
  }
  return false;
}

export function stageLabel(status: StageStatus): string {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending";
}
