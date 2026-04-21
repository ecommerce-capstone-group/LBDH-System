import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, Clock, GraduationCap, ShieldAlert } from "lucide-react";
import { useListRequests, getListRequestsQueryKey, useListLeaves, getListLeavesQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";

export default function SelfService() {
  const { user } = useAuth();
  
  // Using a hardcoded employee ID 1 for the employee role since auth is mocked
  const employeeId = 1;

  const { data: requests, isLoading: isRequestsLoading } = useListRequests(
    { employeeId },
    { query: { queryKey: getListRequestsQueryKey({ employeeId }) } }
  );

  const { data: leaves, isLoading: isLeavesLoading } = useListLeaves(
    { employeeId },
    { query: { queryKey: getListLeavesQueryKey({ employeeId }) } }
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Self Service Portal</h2>
        <p className="text-gray-500">Submit requests and manage your employment needs.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Button variant="outline" className="h-24 flex-col gap-2 border-primary/20 hover:border-primary hover:bg-primary/5">
          <Calendar className="h-6 w-6 text-primary" />
          <span>File Leave</span>
        </Button>
        <Button variant="outline" className="h-24 flex-col gap-2 border-primary/20 hover:border-primary hover:bg-primary/5">
          <Clock className="h-6 w-6 text-primary" />
          <span>Overtime</span>
        </Button>
        <Button variant="outline" className="h-24 flex-col gap-2 border-primary/20 hover:border-primary hover:bg-primary/5">
          <FileText className="h-6 w-6 text-primary" />
          <span>Certificate</span>
        </Button>
        <Button variant="outline" className="h-24 flex-col gap-2 border-primary/20 hover:border-primary hover:bg-primary/5">
          <ShieldAlert className="h-6 w-6 text-primary" />
          <span>Loan</span>
        </Button>
        <Button variant="outline" className="h-24 flex-col gap-2 border-primary/20 hover:border-primary hover:bg-primary/5">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span>Training</span>
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>My Leave History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLeavesLoading ? (
              <div className="py-4 text-center text-sm text-gray-500">Loading leaves...</div>
            ) : leaves?.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">No leave requests found.</div>
            ) : (
              <div className="space-y-4">
                {leaves?.slice(0, 5).map(leave => (
                  <div key={leave.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium text-sm">{leave.leaveType} Leave</div>
                      <div className="text-xs text-gray-500">{new Date(leave.startDate).toLocaleDateString()} ({leave.days} days)</div>
                    </div>
                    <StatusBadge status={leave.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Other Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {isRequestsLoading ? (
              <div className="py-4 text-center text-sm text-gray-500">Loading requests...</div>
            ) : requests?.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">No recent requests found.</div>
            ) : (
              <div className="space-y-4">
                {requests?.slice(0, 5).map(req => (
                  <div key={req.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium text-sm">{req.title}</div>
                      <div className="text-xs text-gray-500 uppercase">{req.type}</div>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
