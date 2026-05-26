import type { TrainingPlan, TrainingRecord } from "@workspace/api-client-react";

export type TrainingProgress = {
  completedHours: number;
  requiredHours: number;
  label: string;
};

export function getProgressPercent(progress: TrainingProgress): number {
  if (progress.requiredHours <= 0) return 0;
  return Math.min(
    100,
    Math.round((progress.completedHours / progress.requiredHours) * 100),
  );
}

export function formatTrainingDate(date: string | null | undefined): string {
  if (!date) return "Date to be announced";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Date to be announced";
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function recordsForPlan(
  plan: TrainingPlan,
  records: TrainingRecord[],
  employeeId?: number,
): TrainingRecord[] {
  return records.filter((r) => {
    if (employeeId != null && r.employeeId !== employeeId) return false;
    if (r.planId != null && r.planId === plan.id) return true;
    return (
      r.trainingName.trim().toLowerCase() === plan.title.trim().toLowerCase()
    );
  });
}

export function getPlanProgress(
  plan: TrainingPlan,
  records: TrainingRecord[],
  employeeId?: number,
): TrainingProgress {
  const relevant = recordsForPlan(plan, records, employeeId);
  const completed = relevant.reduce((sum, r) => sum + (r.trainingHours || 0), 0);
  const required = plan.trainingHours || 0;
  return {
    completedHours: completed,
    requiredHours: required,
    label:
      required > 0
        ? `${completed}/${required} hours completed`
        : `${completed} hours logged`,
  };
}

export function getRecordProgress(
  record: TrainingRecord,
  records: TrainingRecord[],
  plans: TrainingPlan[],
): TrainingProgress {
  const plan =
    record.planId != null
      ? plans.find((p) => p.id === record.planId)
      : plans.find(
          (p) =>
            p.title.trim().toLowerCase() ===
            record.trainingName.trim().toLowerCase(),
        );

  if (plan) {
    return getPlanProgress(plan, records, record.employeeId);
  }

  const sameTraining = records.filter(
    (r) =>
      r.employeeId === record.employeeId &&
      r.trainingName.trim().toLowerCase() ===
        record.trainingName.trim().toLowerCase(),
  );
  const completed = sameTraining.reduce((sum, r) => sum + (r.trainingHours || 0), 0);
  return {
    completedHours: completed,
    requiredHours: 0,
    label: `${completed} hours logged`,
  };
}
