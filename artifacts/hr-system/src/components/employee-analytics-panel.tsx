import {
  useGetIncidentAnalytics,
  getGetIncidentAnalyticsQueryKey,
  type IncidentAnalytics,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrainingProgressBar } from "@/components/training-progress-bar";
import { formatTrainingDate } from "@/lib/training-progress";
import { isRecord } from "@/lib/api-guards";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  employeeId?: number;
  title?: string;
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

export function EmployeeAnalyticsPanel({
  employeeId,
  title = "Employee analytics",
}: Props) {
  const { data, isLoading } = useGetIncidentAnalytics(
    employeeId != null ? { employeeId } : undefined,
    {
      query: {
        queryKey: getGetIncidentAnalyticsQueryKey(
          employeeId != null ? { employeeId } : undefined,
        ),
      },
    },
  );

  const analytics: IncidentAnalytics | null =
    data && isRecord(data) ? (data as IncidentAnalytics) : null;

  if (isLoading) {
    return <p className="text-gray-500 py-8 text-center">Loading analytics…</p>;
  }

  if (!analytics) {
    return <p className="text-gray-500 py-8 text-center">No analytics data available.</p>;
  }

  const compliantCount = analytics.trainingCompliance.filter((t) => t.isCompliant).length;
  const totalTraining = analytics.trainingCompliance.length;
  const complianceRate =
    totalTraining > 0 ? Math.round((compliantCount / totalTraining) * 100) : 100;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-gray-500">
          Compliance monitoring, violations, and performance correlation.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active incidents" value={analytics.activeIncidents} />
        <StatCard label="Resolved incidents" value={analytics.resolvedIncidents} />
        <StatCard
          label="Repeated violations (2+)"
          value={analytics.repeatedViolators.length}
        />
        <StatCard label="Training compliance" value={complianceRate} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Policy violation trends</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.policyTrends.length === 0 ? (
              <p className="text-sm text-gray-500">No violation trends recorded.</p>
            ) : (
              <ul className="space-y-3">
                {analytics.policyTrends.map((t) => {
                  const max = analytics.policyTrends[0]?.count ?? 1;
                  const width = Math.max(8, Math.round((t.count / max) * 100));
                  return (
                    <li key={t.policy}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium truncate pr-2">{t.policy}</span>
                        <span className="text-gray-500 shrink-0">{t.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${width}%` }}
                        />
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
            <CardTitle className="text-base">
              Violation history vs appraisal scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.violationVsAppraisal.length === 0 ? (
              <p className="text-sm text-gray-500">No correlation data yet.</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {!employeeId ? <TableHead>Employee</TableHead> : null}
                      <TableHead>Violations</TableHead>
                      <TableHead>Avg score</TableHead>
                      <TableHead>Latest period</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.violationVsAppraisal.map((row) => (
                      <TableRow key={row.employeeId}>
                        {!employeeId ? (
                          <TableCell className="font-medium">{row.employeeName}</TableCell>
                        ) : null}
                        <TableCell>{row.violationCount}</TableCell>
                        <TableCell>
                          {row.avgAppraisalScore != null ? row.avgAppraisalScore : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {row.latestAppraisalPeriod ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Training compliance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {analytics.trainingCompliance.length === 0 ? (
            <p className="text-sm text-gray-500">No assigned trainings to measure.</p>
          ) : (
            analytics.trainingCompliance.map((t) => (
              <div key={t.planId} className="border-b pb-4 last:border-0">
                <div className="flex justify-between gap-2 mb-1">
                  <p className="font-medium text-sm">{t.title}</p>
                  <span
                    className={`text-xs font-medium ${t.isCompliant ? "text-emerald-600" : "text-amber-600"}`}
                  >
                    {t.isCompliant ? "Compliant" : "In progress"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Scheduled: {formatTrainingDate(t.plannedDate)} · Required {t.requiredHours}h
                </p>
                <TrainingProgressBar
                  progress={{
                    completedHours: t.completedHours,
                    requiredHours: t.requiredHours,
                    label: `${t.completedHours}/${t.requiredHours} hours completed`,
                  }}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {!employeeId && analytics.repeatedViolators.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employees with repeated violations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {analytics.repeatedViolators.map((v) => (
                <li
                  key={v.employeeId}
                  className="flex justify-between py-2 text-sm"
                >
                  <span className="font-medium">{v.employeeName}</span>
                  <span className="text-gray-500">{v.violationCount} incidents</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
