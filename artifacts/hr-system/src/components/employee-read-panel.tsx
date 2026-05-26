import {
  useListAppraisals,
  getListAppraisalsQueryKey,
  useListTrainingRecords,
  getListTrainingRecordsQueryKey,
  useListTrainingPlans,
  getListTrainingPlansQueryKey,
  useListIncidents,
  getListIncidentsQueryKey,
  type Appraisal,
  type TrainingRecord,
  type EmployeeIncident,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TrainingProgressBar } from "@/components/training-progress-bar";
import { asArray } from "@/lib/api-guards";
import { formatTrainingDate, getRecordProgress } from "@/lib/training-progress";
import { APPRAISAL_TEMPLATES, maxPossibleTotal } from "@workspace/db/appraisal-templates";
import { Star } from "lucide-react";
const actionLabels: Record<string, string> = {
  oral_reprimand: "Oral reprimand",
  warning: "Warning",
  suspension: "Suspension",
  other: "Other disciplinary action",
};

type Props = {
  employeeId: number;
};

export function EmployeeReadPanel({ employeeId }: Props) {
  const year = new Date().getFullYear();

  const { data: records, isLoading: recordsLoading } = useListTrainingRecords(
    { employeeId },
    { query: { queryKey: getListTrainingRecordsQueryKey({ employeeId }) } },
  );
  const { data: plans } = useListTrainingPlans(
    { year },
    { query: { queryKey: getListTrainingPlansQueryKey({ year }) } },
  );
  const { data: appraisals, isLoading: appraisalsLoading } = useListAppraisals(
    { employeeId },
    { query: { queryKey: getListAppraisalsQueryKey({ employeeId }) } },
  );
  const { data: incidents, isLoading: incidentsLoading } = useListIncidents(
    { employeeId },
    { query: { queryKey: getListIncidentsQueryKey({ employeeId }) } },
  );

  const recordRows = asArray<TrainingRecord>(records);
  const planRows = asArray(plans);
  const appraisalRows = asArray<Appraisal>(appraisals);
  const incidentRows = asArray<EmployeeIncident>(incidents);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Training history</CardTitle>
        </CardHeader>
        <CardContent>
          {recordsLoading ? (
            <p className="text-sm text-gray-500">Loading training records…</p>
          ) : recordRows.length === 0 ? (
            <p className="text-sm text-gray-500">No training logs on file.</p>
          ) : (
            <ul className="divide-y">
              {recordRows.map((r) => {
                const progress = getRecordProgress(r, recordRows, planRows);
                const linkedPlan =
                  r.planId != null
                    ? planRows.find((p) => p.id === r.planId)
                    : planRows.find(
                        (p) =>
                          p.title.trim().toLowerCase() ===
                          r.trainingName.trim().toLowerCase(),
                      );
                return (
                  <li key={r.id} className="py-3">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{r.trainingName}</span>
                      <span className="text-xs text-gray-500 shrink-0">
                        Logged {new Date(r.trainingDate).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Scheduled: {formatTrainingDate(linkedPlan?.plannedDate)} · Session:{" "}
                      {r.trainingHours}h
                    </p>
                    <TrainingProgressBar progress={progress} className="mt-2" />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance appraisal history</CardTitle>
        </CardHeader>
        <CardContent>
          {appraisalsLoading ? (
            <p className="text-sm text-gray-500">Loading appraisals…</p>
          ) : appraisalRows.length === 0 ? (
            <p className="text-sm text-gray-500">No appraisals on file.</p>
          ) : (
            <ul className="divide-y">
              {appraisalRows.map((a) => {
                const template = APPRAISAL_TEMPLATES[a.templateType];
                const maxTotal = maxPossibleTotal(template);
                return (
                  <li key={a.id} className="flex justify-between py-3 gap-4">
                    <div>
                      <p className="font-medium">{a.appraisalType}</p>
                      <p className="text-sm text-gray-500">
                        {a.appraisalPeriod} · {template.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {a.appraisalDate
                          ? new Date(a.appraisalDate).toLocaleDateString()
                          : new Date(a.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-emerald-600 font-medium text-sm">
                        <Star className="h-4 w-4 fill-emerald-500" />
                        {a.totalScore}/{maxTotal}
                      </span>
                      <StatusBadge status={a.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Policy violations & incidents</CardTitle>
        </CardHeader>
        <CardContent>
          {incidentsLoading ? (
            <p className="text-sm text-gray-500">Loading incidents…</p>
          ) : incidentRows.length === 0 ? (
            <p className="text-sm text-gray-500">No incidents recorded.</p>
          ) : (
            <ul className="divide-y">
              {incidentRows.map((inc) => (
                <li key={inc.id} className="py-3">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium">{inc.policyViolated}</p>
                    <StatusBadge status={inc.status} />
                  </div>
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                    {inc.violationDescription}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(inc.incidentDate).toLocaleDateString()}
                    {inc.department ? ` · ${inc.department}` : ""}
                    {" · "}
                    {actionLabels[inc.actionTaken] ?? inc.actionTaken}
                    {inc.relatedAppraisalPeriod
                      ? ` · Appraisal: ${inc.relatedAppraisalPeriod}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
