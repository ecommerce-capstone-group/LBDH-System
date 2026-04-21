import { useListOffboardings, getListOffboardingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { UserMinus } from "lucide-react";

export default function Offboarding() {
  const { data: offboardings, isLoading } = useListOffboardings({
    query: { queryKey: getListOffboardingsQueryKey() }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Offboarding</h2>
          <p className="text-gray-500">Manage employee exits and clearance procedures.</p>
        </div>
        <Button>
          <UserMinus className="mr-2 h-4 w-4" /> Start Offboarding
        </Button>
      </div>

      <div className="grid gap-6">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading offboarding records...</div>
        ) : offboardings?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No active offboarding processes.
            </CardContent>
          </Card>
        ) : (
          offboardings?.map((offboarding) => (
            <Card key={offboarding.id} className={offboarding.status === 'Completed' ? "opacity-75" : ""}>
              <CardHeader className="pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">EMP-{offboarding.employeeId.toString().padStart(4, '0')}</CardTitle>
                    <StatusBadge status={offboarding.status} />
                  </div>
                  <p className="text-sm text-gray-500">Started {new Date(offboarding.createdAt).toLocaleDateString()}</p>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Exit Details</h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500">Reason</p>
                        <p className="text-sm font-medium">{offboarding.reason}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Exit Interview Notes</p>
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded border border-gray-100">{offboarding.exitInterview}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Clearance Checklist</h4>
                    <div className="space-y-3 bg-gray-50 p-4 rounded-md border border-gray-100">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={offboarding.hrCleared} disabled />
                        <span className="text-sm font-medium">HR Clearance</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox checked={offboarding.itCleared} disabled />
                        <span className="text-sm font-medium">IT Clearance</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox checked={offboarding.financeCleared} disabled />
                        <span className="text-sm font-medium">Finance Clearance</span>
                      </div>
                    </div>
                    {offboarding.status === 'Pending' && (
                      <div className="mt-4 flex justify-end">
                        <Button variant="outline" size="sm">Update Checklist</Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
