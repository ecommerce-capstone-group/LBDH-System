import {
  useListRequests,
  getListRequestsQueryKey,
  useListEmployees,
  getListEmployeesQueryKey,
  useAdvanceRequest,
  type Employee,
  type HrRequest,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApprovalStepper } from "@/components/approval-stepper";
import { ApprovalStageControls } from "@/components/approval-stage-controls";
import { FileText, User } from "lucide-react";
import { useMemo } from "react";
import { asArray } from "@/lib/api-guards";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Requests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const advanceRequest = useAdvanceRequest();

  const { data: requests, isLoading } = useListRequests(
    {},
    { query: { queryKey: getListRequestsQueryKey({}) } },
  );

  const { data: employees } = useListEmployees(undefined, {
    query: { queryKey: getListEmployeesQueryKey() },
  });

  const requestRows = asArray<HrRequest>(requests);
  const employeeRows = asArray<Employee>(employees);

  const empMap = useMemo(() => {
    const map = new Map<number, { name: string; code: string; position: string }>();
    employeeRows.forEach((e) => {
      map.set(e.id, {
        name: e.name || `Employee #${e.id}`,
        code: `EMP-${String(e.id).padStart(4, "0")}`,
        position: e.role ?? "",
      });
    });
    return map;
  }, [employeeRows]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
    await queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey({}) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          HR Requests
        </h2>
        <p className="text-gray-500">
          Overtime, loans, certificates, reliever, and related requests. Fully
          approved only after Unit Head and Department Head complete their stages.
        </p>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {requestRows.map((req) => {
            const info = empMap.get(req.employeeId);
            return (
              <Card key={req.id} className="flex flex-col">
                <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="bg-white p-2 rounded border border-gray-200 shadow-sm mt-0.5 shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base font-semibold">
                          {req.title}
                        </CardTitle>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">
                          {req.type}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Submitted{" "}
                          {new Date(req.createdAt).toLocaleDateString()} · Stage:{" "}
                          {req.currentStep}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-sm bg-white rounded-md border border-gray-200 px-3 py-2">
                    <User className="h-4 w-4 text-gray-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {info?.name ?? `Employee #${req.employeeId}`}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {info?.code ??
                          `EMP-${String(req.employeeId).padStart(4, "0")}`}
                        {info?.position ? ` • ${info.position}` : ""}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 flex-1 flex flex-col gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {req.details}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 space-y-4">
                    <ApprovalStageControls
                      steps={req.steps}
                      currentStep={req.currentStep}
                      overallStatus={req.status}
                      actorName={user?.name ?? "Approver"}
                      actorRole={user?.role}
                      onAdvance={async (decision, note) => {
                        try {
                          await advanceRequest.mutateAsync({
                            id: req.id,
                            data: {
                              decision,
                              actor: user?.name ?? "Approver",
                              note: note || null,
                            },
                          });
                          await invalidate();
                          toast.success(
                            decision === "approve"
                              ? `${req.currentStep} approved.`
                              : "Request rejected.",
                          );
                        } catch (e) {
                          toast.error(
                            e instanceof Error
                              ? e.message
                              : "Could not update request.",
                          );
                        }
                      }}
                    />
                    <details className="text-sm">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                        Full workflow detail
                      </summary>
                      <div className="mt-3">
                        <ApprovalStepper
                          steps={req.steps}
                          currentStep={req.currentStep}
                        />
                      </div>
                    </details>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {requestRows.length === 0 && (
            <div className="col-span-2 text-center py-12 text-gray-500 border rounded-lg bg-white">
              No HR requests found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
