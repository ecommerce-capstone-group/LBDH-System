import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Calendar, Clock, GraduationCap, ShieldAlert } from "lucide-react";
import {
  useListRequests,
  getListRequestsQueryKey,
  useListLeaves,
  getListLeavesQueryKey,
  useListEmployees,
  getListEmployeesQueryKey,
  useCreateRequest,
  useCreateLeave,
  type Employee,
  type HrRequest,
  type HrRequestInput,
  type LeaveRequest,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { asArray } from "@/lib/api-guards";

export default function SelfService() {
  const { user } = useAuth();
  const [leaveType, setLeaveType] = useState("VL");
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [requestType, setRequestType] = useState("overtime");
  const [requestTitle, setRequestTitle] = useState("");
  const [requestDetails, setRequestDetails] = useState("");

  const { data: employees } = useListEmployees(undefined, {
    query: { queryKey: getListEmployeesQueryKey() },
  });

  const employeeList = asArray<Employee>(employees);

  const employee = useMemo((): Employee | null => {
    if (!user) return null;
    const found = employeeList.find(
      (item) =>
        item.name === user.name ||
        item.email?.toLowerCase().includes(user.username),
    );
    return found ?? employeeList[0] ?? null;
  }, [employeeList, user]);

  const employeeId = employee?.id ?? 1;
  const employeeLabel = employee ? `${employee.name} (EMP-${String(employee.id).padStart(4, "0")})` : "Employee";

  const { data: requests, isLoading: isRequestsLoading } = useListRequests(
    { employeeId },
    { query: { queryKey: getListRequestsQueryKey({ employeeId }) } }
  );

  const { data: leaves, isLoading: isLeavesLoading } = useListLeaves(
    { employeeId },
    { query: { queryKey: getListLeavesQueryKey({ employeeId }) } }
  );

  const leaveRows = asArray<LeaveRequest>(leaves);
  const requestRows = asArray<HrRequest>(requests);

  const createRequest = useCreateRequest();
  const createLeave = useCreateLeave();

  const submitLeave = async () => {
    if (!leaveStartDate || !leaveEndDate || !leaveReason) {
      toast.error("Complete the leave form first");
      return;
    }
    await createLeave.mutateAsync({
      data: {
        employeeId,
        leaveType,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        days: 1,
        reason: leaveReason,
      },
    });
    toast.success("Leave filed");
    setLeaveReason("");
  };

  const submitRequest = async () => {
    if (!requestTitle || !requestDetails) {
      toast.error("Complete the request form first");
      return;
    }
    await createRequest.mutateAsync({
      data: {
        employeeId,
        type: requestType as HrRequestInput["type"],
        title: requestTitle,
        details: requestDetails,
      },
    });
    toast.success("Request submitted");
    setRequestTitle("");
    setRequestDetails("");
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Self Service Portal</h2>
        <p className="text-gray-500">Submit requests and manage your employment needs.</p>
        <p className="mt-2 text-sm text-gray-600">Logged in as {employeeLabel}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <CardHeader className="p-0 pb-2"><CardTitle className="text-base">File Leave</CardTitle></CardHeader>
          <CardContent className="p-0 space-y-2">
            <Label>Type</Label>
            <Input value={leaveType} onChange={(e) => setLeaveType(e.target.value)} placeholder="VL or SL" />
            <Label>Start</Label>
            <Input type="date" value={leaveStartDate} onChange={(e) => setLeaveStartDate(e.target.value)} />
            <Label>End</Label>
            <Input type="date" value={leaveEndDate} onChange={(e) => setLeaveEndDate(e.target.value)} />
            <Textarea value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="Reason" />
            <Button onClick={submitLeave} className="w-full">Submit Leave</Button>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardHeader className="p-0 pb-2"><CardTitle className="text-base">Overtime</CardTitle></CardHeader>
          <CardContent className="p-0 space-y-2">
            <Input value={requestTitle} onChange={(e) => setRequestTitle(e.target.value)} placeholder="Overtime title" />
            <Textarea value={requestDetails} onChange={(e) => setRequestDetails(e.target.value)} placeholder="Overtime details" />
            <Button onClick={submitRequest} className="w-full">Submit Overtime</Button>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardHeader className="p-0 pb-2"><CardTitle className="text-base">Certificate</CardTitle></CardHeader>
          <CardContent className="p-0 space-y-2">
            <Input value={requestTitle} onChange={(e) => setRequestTitle(e.target.value)} placeholder="Certificate title" />
            <Textarea value={requestDetails} onChange={(e) => setRequestDetails(e.target.value)} placeholder="Certificate details" />
            <Button onClick={submitRequest} className="w-full">Submit Certificate</Button>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardHeader className="p-0 pb-2"><CardTitle className="text-base">Loan</CardTitle></CardHeader>
          <CardContent className="p-0 space-y-2">
            <Input value={requestTitle} onChange={(e) => setRequestTitle(e.target.value)} placeholder="Loan title" />
            <Textarea value={requestDetails} onChange={(e) => setRequestDetails(e.target.value)} placeholder="Loan details" />
            <Button onClick={submitRequest} className="w-full">Submit Loan</Button>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardHeader className="p-0 pb-2"><CardTitle className="text-base">Training</CardTitle></CardHeader>
          <CardContent className="p-0 space-y-2">
            <Input value={requestTitle} onChange={(e) => setRequestTitle(e.target.value)} placeholder="Training title" />
            <Textarea value={requestDetails} onChange={(e) => setRequestDetails(e.target.value)} placeholder="Training details" />
            <Button onClick={submitRequest} className="w-full">Submit Training</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>My Leave History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLeavesLoading ? (
              <div className="py-4 text-center text-sm text-gray-500">Loading leaves...</div>
            ) : leaveRows.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">No leave requests found.</div>
            ) : (
              <div className="space-y-4">
                {leaveRows.slice(0, 5).map((leave: any) => (
                  <div key={leave.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium text-sm">{leave.leaveType} Leave</div>
                      <div className="text-xs text-gray-500">{employeeLabel} • {new Date(leave.startDate).toLocaleDateString()} ({leave.days} days)</div>
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
            ) : requestRows.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">No recent requests found.</div>
            ) : (
              <div className="space-y-4">
                {requestRows.slice(0, 5).map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium text-sm">{req.title}</div>
                      <div className="text-xs text-gray-500 uppercase">{req.type} • {employeeLabel}</div>
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
