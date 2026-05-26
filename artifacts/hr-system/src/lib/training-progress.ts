import type { TrainingPlan, TrainingRecord } from "@workspace/api-client-react";

export type TrainingProgress = {
  completedHours: number;
  requiredHours: number;
  label: string;
};

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
