import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmployeeTrainingPanel } from "@/components/employee-training-panel";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { asArray } from "@/lib/api-guards";
import {
  CalendarDays,
  Clock,
  FileBadge,
  Landmark,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type ServiceRequestKind = "leave" | "overtime" | "certificate" | "loan";

const requestOptions: {
  id: ServiceRequestKind;
  label: string;
  description: string;
  icon: typeof CalendarDays;
}[] = [
  {
    id: "leave",
    label: "File Leave",
    description: "Vacation, sick, or emergency leave",
    icon: CalendarDays,
  },
  {
    id: "overtime",
    label: "Overtime",
    description: "Request authorized overtime work",
    icon: Clock,
  },
  {
    id: "certificate",
    label: "Certificate",
    description: "Certificate of employment or similar",
    icon: FileBadge,
  },
  {
    id: "loan",
    label: "Loan",
    description: "Salary or emergency loan application",
    icon: Landmark,
  },
];

function diffLeaveDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  return Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function formatDetails(lines: Record<string, string | number | undefined>): string {
  return Object.entries(lines)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

export default function SelfService() {
  const { user } = useAuth();
  const [activeRequest, setActiveRequest] = useState<ServiceRequestKind | null>(null);

  const [leaveType, setLeaveType] = useState("VL");
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveContact, setLeaveContact] = useState("");
  const [leaveReliever, setLeaveReliever] = useState("");

  const [otDate, setOtDate] = useState("");
  const [otHours, setOtHours] = useState("1");
  const [otStartTime, setOtStartTime] = useState("");
  const [otEndTime, setOtEndTime] = useState("");
  const [otPurpose, setOtPurpose] = useState("");
  const [otTasks, setOtTasks] = useState("");

  const [certType, setCertType] = useState("Certificate of Employment");
  const [certPurpose, setCertPurpose] = useState("");
  const [certCopies, setCertCopies] = useState("1");
  const [certDelivery, setCertDelivery] = useState("Pick up at HR");
  const [certRemarks, setCertRemarks] = useState("");

  const [loanType, setLoanType] = useState("Salary Loan");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanPurpose, setLoanPurpose] = useState("");
  const [loanTerm, setLoanTerm] = useState("");
  const [loanRemarks, setLoanRemarks] = useState("");

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
  const employeeLabel = employee
    ? `${employee.name} (EMP-${String(employee.id).padStart(4, "0")})`
    : "Employee";
  const employeeDept = employee?.department ?? "—";
  const employeePosition = employee?.position ?? "—";

  const leaveDays = useMemo(
    () => diffLeaveDays(leaveStartDate, leaveEndDate),
    [leaveStartDate, leaveEndDate],
  );

  const { data: requests, isLoading: isRequestsLoading } = useListRequests(
    { employeeId },
    { query: { queryKey: getListRequestsQueryKey({ employeeId }) } },
  );

  const { data: leaves, isLoading: isLeavesLoading } = useListLeaves(
    { employeeId },
    { query: { queryKey: getListLeavesQueryKey({ employeeId }) } },
  );

  const leaveRows = asArray<LeaveRequest>(leaves);
  const requestRows = asArray<HrRequest>(requests);

  const createRequest = useCreateRequest();
  const createLeave = useCreateLeave();

  const submitLeave = async () => {
    if (!leaveStartDate || !leaveEndDate || !leaveReason.trim()) {
      toast.error("Complete all required leave fields.");
      return;
    }
    if (leaveDays < 1) {
      toast.error("End date must be on or after start date.");
      return;
    }
    await createLeave.mutateAsync({
      data: {
        employeeId,
        leaveType,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        days: leaveDays,
        reason: formatDetails({
          Purpose: leaveReason.trim(),
          "Contact during leave": leaveContact.trim() || undefined,
          "Relief officer": leaveReliever.trim() || undefined,
          Department: employeeDept,
          Position: employeePosition,
        }),
      },
    });
    toast.success("Leave request submitted for approval.");
    setLeaveReason("");
    setLeaveContact("");
    setLeaveReliever("");
    setActiveRequest(null);
  };

  const submitOvertime = async () => {
    const hours = Number(otHours);
    if (!otDate || !otPurpose.trim()) {
      toast.error("Date and purpose are required.");
      return;
    }
    if (!Number.isInteger(hours) || hours < 1) {
      toast.error("Overtime hours must be at least 1 (whole hours only).");
      return;
    }
    const dateLabel = new Date(otDate).toLocaleDateString();
    await createRequest.mutateAsync({
      data: {
        employeeId,
        type: "overtime" as HrRequestInput["type"],
        title: `Overtime — ${hours} hour${hours === 1 ? "" : "s"} — ${dateLabel}`,
        details: formatDetails({
          "Employee name": employee?.name,
          "Employee ID": `EMP-${String(employeeId).padStart(4, "0")}`,
          Department: employeeDept,
          Position: employeePosition,
          "Overtime date": dateLabel,
          "Hours requested": hours,
          "Time from": otStartTime || undefined,
          "Time to": otEndTime || undefined,
          "Work performed": otTasks.trim() || undefined,
          "Justification / purpose": otPurpose.trim(),
        }),
      },
    });
    toast.success("Overtime request submitted for approval.");
    setOtDate("");
    setOtHours("1");
    setOtStartTime("");
    setOtEndTime("");
    setOtPurpose("");
    setOtTasks("");
    setActiveRequest(null);
  };

  const submitCertificate = async () => {
    if (!certPurpose.trim()) {
      toast.error("Purpose of certificate is required.");
      return;
    }
    await createRequest.mutateAsync({
      data: {
        employeeId,
        type: "certificate" as HrRequestInput["type"],
        title: `${certType} Request`,
        details: formatDetails({
          "Employee name": employee?.name,
          "Employee ID": `EMP-${String(employeeId).padStart(4, "0")}`,
          Department: employeeDept,
          Position: employeePosition,
          "Certificate type": certType,
          Purpose: certPurpose.trim(),
          "Number of copies": certCopies,
          "Delivery / pickup": certDelivery,
          Remarks: certRemarks.trim() || undefined,
        }),
      },
    });
    toast.success("Certificate request submitted for approval.");
    setCertPurpose("");
    setCertRemarks("");
    setActiveRequest(null);
  };

  const submitLoan = async () => {
    if (!loanAmount.trim() || !loanPurpose.trim()) {
      toast.error("Loan amount and purpose are required.");
      return;
    }
    await createRequest.mutateAsync({
      data: {
        employeeId,
        type: "loan" as HrRequestInput["type"],
        title: `${loanType} — ₱${loanAmount.trim()}`,
        details: formatDetails({
          "Employee name": employee?.name,
          "Employee ID": `EMP-${String(employeeId).padStart(4, "0")}`,
          Department: employeeDept,
          Position: employeePosition,
          "Loan type": loanType,
          "Amount requested (PHP)": loanAmount.trim(),
          Purpose: loanPurpose.trim(),
          "Preferred payment term": loanTerm.trim() || undefined,
          Remarks: loanRemarks.trim() || undefined,
        }),
      },
    });
    toast.success("Loan request submitted for approval.");
    setLoanAmount("");
    setLoanPurpose("");
    setLoanTerm("");
    setLoanRemarks("");
    setActiveRequest(null);
  };

  const renderRequestForm = () => {
    if (!activeRequest) return null;

    const backButton = (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2"
        onClick={() => setActiveRequest(null)}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to request menu
      </Button>
    );

    if (activeRequest === "leave") {
      return (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            {backButton}
            <CardTitle>Leave Application Form</CardTitle>
            <CardDescription>
              Los Baños Doctors Hospital — Employee leave filing (routed to Unit Head →
              Department Head → HR).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4 p-3 rounded-md bg-muted/40 text-sm">
              <p>
                <span className="text-gray-500">Employee:</span> {employeeLabel}
              </p>
              <p>
                <span className="text-gray-500">Department:</span> {employeeDept}
              </p>
              <p>
                <span className="text-gray-500">Position:</span> {employeePosition}
              </p>
              <p>
                <span className="text-gray-500">Date filed:</span>{" "}
                {new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Leave type *</Label>
                <select
                  className={selectClass}
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                >
                  <option value="VL">Vacation Leave (VL)</option>
                  <option value="SL">Sick Leave (SL)</option>
                  <option value="EL">Emergency Leave (EL)</option>
                  <option value="ML">Maternity Leave (ML)</option>
                  <option value="PL">Paternity Leave (PL)</option>
                  <option value="BL">Birthday Leave (BL)</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Total days</Label>
                <Input value={leaveDays > 0 ? String(leaveDays) : "—"} readOnly />
              </div>
              <div className="grid gap-2">
                <Label>Start date *</Label>
                <Input
                  type="date"
                  value={leaveStartDate}
                  onChange={(e) => setLeaveStartDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>End date *</Label>
                <Input
                  type="date"
                  value={leaveEndDate}
                  onChange={(e) => setLeaveEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Reason / purpose of leave *</Label>
              <Textarea
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                rows={3}
                placeholder="State the reason for your leave request…"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Contact number while on leave</Label>
                <Input
                  value={leaveContact}
                  onChange={(e) => setLeaveContact(e.target.value)}
                  placeholder="Mobile number"
                />
              </div>
              <div className="grid gap-2">
                <Label>Relief officer (if applicable)</Label>
                <Input
                  value={leaveReliever}
                  onChange={(e) => setLeaveReliever(e.target.value)}
                  placeholder="Name of covering staff"
                />
              </div>
            </div>
            <Button onClick={submitLeave} className="w-full sm:w-auto">
              Submit leave application
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (activeRequest === "overtime") {
      return (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            {backButton}
            <CardTitle>Overtime Authorization Request</CardTitle>
            <CardDescription>
              Request must be filed before or on the date of overtime. Minimum 1 hour,
              in 1-hour increments.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4 p-3 rounded-md bg-muted/40 text-sm">
              <p>
                <span className="text-gray-500">Employee:</span> {employeeLabel}
              </p>
              <p>
                <span className="text-gray-500">Department:</span> {employeeDept}
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Overtime date *</Label>
                <Input
                  type="date"
                  value={otDate}
                  onChange={(e) => setOtDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Hours requested *</Label>
                <select
                  className={selectClass}
                  value={otHours}
                  onChange={(e) => setOtHours(e.target.value)}
                >
                  {Array.from({ length: 16 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={String(h)}>
                      {h} hour{h === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Time in</Label>
                <Input
                  type="time"
                  value={otStartTime}
                  onChange={(e) => setOtStartTime(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Time out</Label>
                <Input
                  type="time"
                  value={otEndTime}
                  onChange={(e) => setOtEndTime(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Work to be performed</Label>
              <Textarea
                value={otTasks}
                onChange={(e) => setOtTasks(e.target.value)}
                rows={2}
                placeholder="Describe tasks during overtime…"
              />
            </div>
            <div className="grid gap-2">
              <Label>Justification / purpose *</Label>
              <Textarea
                value={otPurpose}
                onChange={(e) => setOtPurpose(e.target.value)}
                rows={3}
                placeholder="Explain why overtime is necessary…"
              />
            </div>
            <Button onClick={submitOvertime} className="w-full sm:w-auto">
              Submit overtime request
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (activeRequest === "certificate") {
      return (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            {backButton}
            <CardTitle>Certificate Request Form</CardTitle>
            <CardDescription>
              Request official certificates from Human Resources.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Certificate type *</Label>
                <select
                  className={selectClass}
                  value={certType}
                  onChange={(e) => setCertType(e.target.value)}
                >
                  <option>Certificate of Employment</option>
                  <option>Certificate of Compensation</option>
                  <option>Certificate of No Pending Case</option>
                  <option>Service Record</option>
                  <option>Other (specify in remarks)</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Number of copies *</Label>
                <Input
                  type="number"
                  min={1}
                  value={certCopies}
                  onChange={(e) => setCertCopies(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Purpose *</Label>
              <Textarea
                value={certPurpose}
                onChange={(e) => setCertPurpose(e.target.value)}
                rows={2}
                placeholder="e.g. Bank loan, visa application, government requirement…"
              />
            </div>
            <div className="grid gap-2">
              <Label>Delivery / pickup</Label>
              <select
                className={selectClass}
                value={certDelivery}
                onChange={(e) => setCertDelivery(e.target.value)}
              >
                <option>Pick up at HR</option>
                <option>Send to department</option>
                <option>Email soft copy (if available)</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Additional remarks</Label>
              <Textarea
                value={certRemarks}
                onChange={(e) => setCertRemarks(e.target.value)}
                rows={2}
              />
            </div>
            <Button onClick={submitCertificate} className="w-full sm:w-auto">
              Submit certificate request
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          {backButton}
          <CardTitle>Loan Application Form</CardTitle>
          <CardDescription>
            Salary or emergency loan request subject to HR and management approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Loan type *</Label>
              <select
                className={selectClass}
                value={loanType}
                onChange={(e) => setLoanType(e.target.value)}
              >
                <option>Salary Loan</option>
                <option>Emergency Loan</option>
                <option>Multi-Purpose Loan</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Amount requested (PHP) *</Label>
              <Input
                type="number"
                min={0}
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Purpose of loan *</Label>
            <Textarea
              value={loanPurpose}
              onChange={(e) => setLoanPurpose(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid gap-2">
            <Label>Preferred payment term</Label>
            <Input
              value={loanTerm}
              onChange={(e) => setLoanTerm(e.target.value)}
              placeholder="e.g. 6 months payroll deduction"
            />
          </div>
          <div className="grid gap-2">
            <Label>Remarks</Label>
            <Textarea
              value={loanRemarks}
              onChange={(e) => setLoanRemarks(e.target.value)}
              rows={2}
            />
          </div>
          <Button onClick={submitLoan} className="w-full sm:w-auto">
            Submit loan application
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Self Service Portal</h2>
        <p className="text-gray-500">Submit requests and manage your employment needs.</p>
        <p className="mt-2 text-sm text-gray-600">Logged in as {employeeLabel}</p>
      </div>

      {activeRequest === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {requestOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setActiveRequest(opt.id)}
                className={cn(
                  "text-left rounded-lg border bg-card p-5 shadow-sm transition-colors",
                  "hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <Icon className="h-8 w-8 text-primary mb-3" />
                <p className="font-semibold text-gray-900">{opt.label}</p>
                <p className="text-sm text-gray-500 mt-1">{opt.description}</p>
              </button>
            );
          })}
        </div>
      ) : (
        renderRequestForm()
      )}

      <EmployeeTrainingPanel employeeId={employeeId} department={employee?.department} />

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>My Leave History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLeavesLoading ? (
              <div className="py-4 text-center text-sm text-gray-500">Loading leaves…</div>
            ) : leaveRows.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">No leave requests found.</div>
            ) : (
              <div className="space-y-4">
                {leaveRows.slice(0, 5).map((leave) => (
                  <div
                    key={leave.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="font-medium text-sm">{leave.leaveType} Leave</div>
                      <div className="text-xs text-gray-500">
                        {new Date(leave.startDate).toLocaleDateString()} –{" "}
                        {new Date(leave.endDate).toLocaleDateString()} ({leave.days} day
                        {leave.days === 1 ? "" : "s"})
                      </div>
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
              <div className="py-4 text-center text-sm text-gray-500">Loading requests…</div>
            ) : requestRows.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">No recent requests found.</div>
            ) : (
              <div className="space-y-4">
                {requestRows.slice(0, 5).map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                  >
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
