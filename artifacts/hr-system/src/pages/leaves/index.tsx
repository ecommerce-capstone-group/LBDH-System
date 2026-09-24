import {
  useListLeaves,
  getListLeavesQueryKey,
  useListEmployees,
  getListEmployeesQueryKey,
  useAdvanceLeave,
} from "@workspace/api-client-react";
import type { Employee, LeaveRequest } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApprovalStepper } from "@/components/approval-stepper";
import { ApprovalStageControls } from "@/components/approval-stage-controls";
import { useMemo } from "react";
import { asArray } from "@/lib/api-guards";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Leaves() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const advanceLeave = useAdvanceLeave();

  const { data: leaves, isLoading } = useListLeaves(
    {},
    { query: { queryKey: getListLeavesQueryKey({}) } },
  );

  const { data: employees } = useListEmployees(undefined, {
    query: { queryKey: getListEmployeesQueryKey() },
  });

  const employeeRows = asArray<Employee>(employees);
  const leaveRows = asArray<LeaveRequest>(leaves);

  const empMap = useMemo(() => {
    const map = new Map<number, { name: string; code: string }>();
    employeeRows.forEach((e) => {
      map.set(e.id, {
        name: e.name || `Employee #${e.id}`,
        code: `EMP-${String(e.id).padStart(4, "0")}`,
      });
    });
    return map;
  }, [employeeRows]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/leaves"] });
    await queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey({}) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          Leave Requests
        </h2>
        <p className="text-gray-500">
          Manage employee leave applications. Fully approved only after Unit Head
          and Department Head complete their stages.
        </p>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid gap-6">
          {leaveRows.map((leave) => {
            const info = empMap.get(leave.employeeId);
            return (
              <Card key={leave.id}>
                <CardHeader className="pb-3 border-b border-gray-100">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                        {leave.leaveType} Leave
                        <StatusBadge status={leave.status} />
                      </CardTitle>
                      <p className="text-sm text-gray-500">
                        {new Date(leave.startDate).toLocaleDateString()} to{" "}
                        {new Date(leave.endDate).toLocaleDateString()} (
                        {leave.days} days)
                      </p>
                      <p className="text-xs text-gray-500">
                        Stage: {leave.currentStep}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium text-gray-900">
                        {info?.name ?? `Employee #${leave.employeeId}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {info?.code ??
                          `EMP-${String(leave.employeeId).padStart(4, "0")}`}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Requested{" "}
                        {new Date(leave.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">
                        Reason for Leave
                      </h4>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-100 whitespace-pre-wrap">
                        {leave.reason}
                      </p>
                      <div className="mt-6">
                        <h4 className="text-sm font-semibold text-gray-900 mb-4">
                          Full workflow
                        </h4>
                        <ApprovalStepper
                          steps={leave.steps}
                          currentStep={leave.currentStep}
                        />
                      </div>
                    </div>
                    <div>
                      <ApprovalStageControls
                        steps={leave.steps}
                        currentStep={leave.currentStep}
                        overallStatus={leave.status}
                        actorName={user?.name ?? "Approver"}
                        actorRole={user?.role}
                        onAdvance={async (decision, note) => {
                          try {
                            await advanceLeave.mutateAsync({
                              id: leave.id,
                              data: {
                                decision,
                                actor: user?.name ?? "Approver",
                                note: note || null,
                              },
                            });
                            await invalidate();
                            toast.success(
                              decision === "approve"
                                ? `${leave.currentStep} approved.`
                                : "Leave request rejected.",
                            );
                          } catch (e) {
                            toast.error(
                              e instanceof Error
                                ? e.message
                                : "Could not update leave request.",
                            );
                          }
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {leaveRows.length === 0 && (
            <div className="text-center py-12 text-gray-500 border rounded-lg bg-white">
              No leave requests found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
