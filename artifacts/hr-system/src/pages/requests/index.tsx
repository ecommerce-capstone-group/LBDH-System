import {
  useListRequests,
  getListRequestsQueryKey,
  useListEmployees,
  getListEmployeesQueryKey,
  type Employee,
  type HrRequest,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApprovalStepper } from "@/components/approval-stepper";
import { FileText, User } from "lucide-react";
import { useMemo } from "react";
import { asArray } from "@/lib/api-guards";

export default function Requests() {
  const { data: requests, isLoading } = useListRequests({}, {
    query: { queryKey: getListRequestsQueryKey({}) },
  });

  const { data: employees } = useListEmployees(undefined, {
    query: { queryKey: getListEmployeesQueryKey() },
  });

  const requestRows = asArray<HrRequest>(requests);
  const employeeRows = asArray<Employee>(employees);

  const empMap = useMemo(() => {
    const map = new Map<number, { name: string; code: string; position: string }>();
    employeeRows.forEach((e: any) => {
      map.set(e.id, {
        name: `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || `Employee #${e.id}`,
        code: e.employeeCode ?? `EMP-${String(e.id).padStart(4, "0")}`,
        position: e.position ?? "",
      });
    });
    return map;
  }, [employeeRows]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">HR Requests</h2>
        <p className="text-gray-500">Manage miscellaneous employee requests (overtime, loans, etc).</p>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {requestRows.map((req: any) => {
            const info = empMap.get(req.employeeId);
            return (
              <Card key={req.id} className="flex flex-col">
                <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="bg-white p-2 rounded border border-gray-200 shadow-sm mt-0.5">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold">{req.title}</CardTitle>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{req.type}</p>
                      </div>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-sm bg-white rounded-md border border-gray-200 px-3 py-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {info?.name ?? `Employee #${req.employeeId}`}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {info?.code ?? `EMP-${String(req.employeeId).padStart(4, "0")}`}
                        {info?.position ? ` • ${info.position}` : ""}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 flex-1 flex flex-col">
                  <div className="mb-6 flex-1">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{req.details}</p>
                  </div>
                  <div className="mt-auto">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <ApprovalStepper steps={req.steps} currentStep={req.currentStep} />
                    </div>
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
