import { useListLeaves, getListLeavesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApprovalStepper } from "@/components/approval-stepper";

export default function Leaves() {
  const { data: leaves, isLoading } = useListLeaves({}, {
    query: { queryKey: getListLeavesQueryKey({}) }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Leave Requests</h2>
        <p className="text-gray-500">Manage employee leave applications and approvals.</p>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid gap-6">
          {leaves?.map((leave) => (
            <Card key={leave.id}>
              <CardHeader className="pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {leave.leaveType} Leave
                      <StatusBadge status={leave.status} />
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                      {new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()} ({leave.days} days)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">EMP-{leave.employeeId}</p>
                    <p className="text-sm text-gray-500">Requested {new Date(leave.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Reason for Leave</h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-100">
                      {leave.reason}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-4">Approval Workflow</h4>
                    <ApprovalStepper steps={leave.steps} currentStep={leave.currentStep} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!leaves || leaves.length === 0) && (
             <div className="text-center py-12 text-gray-500 border rounded-lg bg-white">
               No leave requests found.
             </div>
          )}
        </div>
      )}
    </div>
  );
}
