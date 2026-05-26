import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApprovalStepper } from "@/components/approval-stepper";
import { TrainingProgressBar } from "@/components/training-progress-bar";
import {
  useListTrainingPlans,
  getListTrainingPlansQueryKey,
  useListTrainingRecords,
  getListTrainingRecordsQueryKey,
  useListTrainingEnrollments,
  getListTrainingEnrollmentsQueryKey,
  useCreateTrainingPlan,
  useEnrollTrainingPlan,
  type TrainingPlan,
  type TrainingRecord,
  type TrainingEnrollment,
} from "@workspace/api-client-react";
import { asArray } from "@/lib/api-guards";
import {
  formatTrainingDate,
  getPlanProgress,
  getRecordProgress,
} from "@/lib/training-progress";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  employeeId: number;
  department?: string;
};

const categoryLabel: Record<string, string> = {
  doh_initiated: "DOH / Compliance",
  hospital_required: "Hospital-required",
  departmental_request: "Department-requested",
};

function isVisiblePlan(plan: TrainingPlan) {
  return plan.status === "published" || plan.status === "approved";
}

export function EmployeeTrainingPanel({ employeeId, department }: Props) {
  const queryClient = useQueryClient();
  const year = new Date().getFullYear();
  const [reqTitle, setReqTitle] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [reqHours, setReqHours] = useState("8");
  const [reqDate, setReqDate] = useState("");

  const { data: plans } = useListTrainingPlans(
    { year },
    { query: { queryKey: getListTrainingPlansQueryKey({ year }) } },
  );
  const { data: records } = useListTrainingRecords(
    { employeeId },
    { query: { queryKey: getListTrainingRecordsQueryKey({ employeeId }) } },
  );
  const { data: enrollments } = useListTrainingEnrollments(
    { employeeId },
    { query: { queryKey: getListTrainingEnrollmentsQueryKey({ employeeId }) } },
  );

  const createPlan = useCreateTrainingPlan();
  const enroll = useEnrollTrainingPlan();

  const planRows = asArray<TrainingPlan>(plans);
  const recordRows = asArray<TrainingRecord>(records);
  const enrollmentRows = asArray<TrainingEnrollment>(enrollments);

  const assignedPlans = enrollmentRows
    .map((e) => planRows.find((p) => p.id === e.planId))
    .filter((p): p is TrainingPlan => p != null && isVisiblePlan(p));

  const openHospitalPlans = planRows.filter(
    (p) =>
      p.category === "hospital_required" &&
      p.status === "published" &&
      !enrollmentRows.some((e) => e.planId === p.id),
  );

  const myRequests = planRows.filter(
    (p) => p.category === "departmental_request" && p.employeeId === employeeId,
  );

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/training-plans"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/training-records"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/training-enrollments"] });
  };

  const submitDepartmental = async () => {
    if (!reqTitle.trim()) {
      toast.error("Training title is required.");
      return;
    }
    try {
      await createPlan.mutateAsync({
        data: {
          year,
          category: "departmental_request",
          title: reqTitle.trim(),
          description: reqDesc.trim(),
          trainingHours: Number(reqHours) || 0,
          plannedDate: reqDate || null,
          department: department ?? null,
          employeeId,
        },
      });
      await invalidate();
      toast.success("Departmental training request submitted for approval.");
      setReqTitle("");
      setReqDesc("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not submit request.");
    }
  };

  const applyToHospital = async (planId: number) => {
    try {
      await enroll.mutateAsync({ id: planId, data: { employeeId } });
      await invalidate();
      toast.success("Enrolled in training.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not enroll.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My assigned trainings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignedPlans.length === 0 ? (
            <p className="text-sm text-gray-500">
              No trainings assigned yet. HR will assign required trainings to you.
            </p>
          ) : (
            assignedPlans.map((p) => {
              const progress = getPlanProgress(p, recordRows, employeeId);
              return (
                <div key={p.id} className="text-sm border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <p className="font-medium">{p.title}</p>
                    <StatusBadge status="enrolled" />
                  </div>
                  <p className="text-xs text-gray-500">
                    {categoryLabel[p.category] ?? p.category} · Required {p.trainingHours}h
                  </p>
                  <p className="text-xs font-medium text-primary mt-1">
                    Scheduled: {formatTrainingDate(p.plannedDate)}
                  </p>
                  <TrainingProgressBar progress={progress} className="mt-3" />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {openHospitalPlans.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open hospital trainings (self-enroll)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openHospitalPlans.map((p) => (
              <div key={p.id} className="flex justify-between items-start gap-2 text-sm">
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-gray-500">
                    Required: {p.trainingHours}h · Scheduled: {formatTrainingDate(p.plannedDate)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => applyToHospital(p.id)}
                >
                  Apply
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request departmental training</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <Label>Title *</Label>
            <Input value={reqTitle} onChange={(e) => setReqTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea value={reqDesc} onChange={(e) => setReqDesc(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Hours</Label>
              <Input
                type="number"
                value={reqHours}
                onChange={(e) => setReqHours(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Preferred date</Label>
              <Input type="date" value={reqDate} onChange={(e) => setReqDate(e.target.value)} />
            </div>
          </div>
          <Button type="button" className="w-full" onClick={submitDepartmental}>
            Submit for approval
          </Button>
          <p className="text-xs text-gray-500">
            Route: Unit Head → Department Head → HR
          </p>
        </CardContent>
      </Card>

      {myRequests.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My training requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {myRequests.map((p) => (
              <div key={p.id}>
                <div className="flex justify-between mb-2">
                  <span className="font-medium text-sm">{p.title}</span>
                  <StatusBadge status={p.status} />
                </div>
                <p className="text-xs text-primary mb-2">
                  Preferred date: {formatTrainingDate(p.plannedDate)}
                </p>
                {p.steps?.length > 0 ? (
                  <ApprovalStepper steps={p.steps} currentStep={p.currentStep} />
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My training records</CardTitle>
        </CardHeader>
        <CardContent>
          {recordRows.length === 0 ? (
            <p className="text-sm text-gray-500">No completed trainings on file.</p>
          ) : (
            <ul className="space-y-4 text-sm">
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
                  <li key={r.id} className="border-b pb-3 last:border-0">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{r.trainingName}</span>
                      <span className="text-gray-500 shrink-0">
                        Logged {new Date(r.trainingDate).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Scheduled: {formatTrainingDate(linkedPlan?.plannedDate)} · This session:{" "}
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
    </div>
  );
}
