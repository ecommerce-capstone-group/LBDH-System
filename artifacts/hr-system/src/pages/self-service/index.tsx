import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmployeeTrainingPanel } from "@/components/employee-training-panel";
import { ApprovalStageControls } from "@/components/approval-stage-controls";
import {
  useListRequests,
  getListRequestsQueryKey,
  useListLeaves,
  getListLeavesQueryKey,
  useGetEmployee,
  getGetEmployeeQueryKey,
  useGetLeaveBalance,
  getGetLeaveBalanceQueryKey,
  useCreateRequest,
  useCreateLeave,
  type HrRequest,
  type HrRequestInput,
  type LeaveRequest,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { asArray } from "@/lib/api-guards";
import {
  finalApprovalDate,
  formatApprovalDate,
} from "@/lib/approval-display";
import {
  CalendarDays,
  Clock,
  FileBadge,
  Landmark,
  Users,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BALANCED_LEAVE_TYPES = new Set(["VL", "SL"]);

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type ServiceRequestKind =
  | "leave"
  | "overtime"
  | "certificate"
  | "loan"
  | "reliever";

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
  {
    id: "reliever",
    label: "Reliever",
    description: "Request a covering / relief officer",
    icon: Users,
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
  const queryClient = useQueryClient();
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

  const [relieverName, setRelieverName] = useState("");
  const [relieverDates, setRelieverDates] = useState("");
  const [relieverReason, setRelieverReason] = useState("");

  const linkedEmployeeId =
    user?.role === "employee" && user.employeeId != null ? user.employeeId : 0;

  const { data: employee } = useGetEmployee(linkedEmployeeId, {
    query: {
      queryKey: getGetEmployeeQueryKey(linkedEmployeeId),
      enabled: linkedEmployeeId > 0,
    },
  });

  const employeeId = linkedEmployeeId;
  const employeeLabel = employee
    ? `${employee.name} (EMP-${String(employee.id).padStart(4, "0")})`
    : user?.name ?? "Employee";
  const employeeDept = employee?.department ?? "—";
  const employeePosition = employee?.role ?? "—";

  const leaveDays = useMemo(
    () => diffLeaveDays(leaveStartDate, leaveEndDate),
    [leaveStartDate, leaveEndDate],
  );

  const { data: requests, isLoading: isRequestsLoading } = useListRequests(
    { employeeId },
    {
      query: {
        queryKey: getListRequestsQueryKey({ employeeId }),
        refetchOnMount: "always",
        enabled: employeeId > 0,
      },
    },
  );

  const { data: leaves, isLoading: isLeavesLoading } = useListLeaves(
    { employeeId },
    {
      query: {
        queryKey: getListLeavesQueryKey({ employeeId }),
        refetchOnMount: "always",
        enabled: employeeId > 0,
      },
    },
  );

  const refreshMyRequests = async () => {
    await queryClient.invalidateQueries({
      queryKey: getListLeavesQueryKey({ employeeId }),
    });
    await queryClient.invalidateQueries({
      queryKey: getListRequestsQueryKey({ employeeId }),
    });
    await queryClient.invalidateQueries({ queryKey: ["/api/leaves"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
  };
  const { data: leaveBalance } = useGetLeaveBalance(employeeId, {
    query: {
      queryKey: getGetLeaveBalanceQueryKey(employeeId),
      enabled: Number.isFinite(employeeId) && employeeId > 0,
    },
  });

  const remainingForType = useMemo(() => {
    if (!leaveBalance) return null;
    if (leaveType === "VL") return leaveBalance.vlBalance;
    if (leaveType === "SL") return leaveBalance.slBalance;
    return null;
  }, [leaveBalance, leaveType]);

  const exceedsBalance =
    remainingForType !== null &&
    BALANCED_LEAVE_TYPES.has(leaveType) &&
    leaveDays > remainingForType;

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
    if (
      BALANCED_LEAVE_TYPES.has(leaveType) &&
      remainingForType !== null &&
      leaveDays > remainingForType
    ) {
      toast.error(
        `Insufficient ${leaveType} balance. You have ${remainingForType} day(s) remaining but requested ${leaveDays}.`,
      );
      return;
    }
    try {
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
      await queryClient.invalidateQueries({
        queryKey: getGetLeaveBalanceQueryKey(employeeId),
      });
      await refreshMyRequests();
      toast.success(
        "Leave request submitted for approval. Balance is deducted only after approval.",
      );      setLeaveReason("");
      setLeaveContact("");
      setLeaveReliever("");
      setActiveRequest(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit leave request.");
    }
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
    await refreshMyRequests();
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
    await refreshMyRequests();
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
    await refreshMyRequests();
    toast.success("Loan request submitted for approval.");
    setLoanAmount("");
    setLoanPurpose("");
    setLoanTerm("");
    setLoanRemarks("");
    setActiveRequest(null);
  };

  const submitReliever = async () => {
    if (!relieverName.trim() || !relieverReason.trim()) {
      toast.error("Reliever name and reason are required.");
      return;
    }
    await createRequest.mutateAsync({
      data: {
        employeeId,
        type: "reliever" as HrRequestInput["type"],
        title: `Reliever — ${relieverName.trim()}`,
        details: formatDetails({
          "Employee name": employee?.name,
          "Employee ID": `EMP-${String(employeeId).padStart(4, "0")}`,
          Department: employeeDept,
          Position: employeePosition,
          "Proposed reliever": relieverName.trim(),
          "Coverage dates": relieverDates.trim() || undefined,
          Reason: relieverReason.trim(),
        }),
      },
    });
    await refreshMyRequests();
    toast.success("Reliever request submitted for approval.");
    setRelieverName("");
    setRelieverDates("");
    setRelieverReason("");
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
              <p>
                <span className="text-gray-500">VL remaining:</span>{" "}
                {leaveBalance ? `${leaveBalance.vlBalance} day(s)` : "…"}
              </p>
              <p>
                <span className="text-gray-500">SL remaining:</span>{" "}
                {leaveBalance ? `${leaveBalance.slBalance} day(s)` : "…"}
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
              {BALANCED_LEAVE_TYPES.has(leaveType) && (
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Remaining {leaveType} balance</Label>
                  <Input
                    value={
                      remainingForType !== null
                        ? `${remainingForType} day(s) available`
                        : "Loading…"
                    }
                    readOnly
                    className={exceedsBalance ? "border-destructive text-destructive" : undefined}
                  />
                  {exceedsBalance && (
                    <p className="text-sm text-destructive">
                      Requested {leaveDays} day(s) exceeds your remaining {leaveType}{" "}
                      balance of {remainingForType} day(s). Reduce the date range or choose
                      another leave type.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Leave is deducted from your balance only after the request is approved.
                    Pending and rejected requests do not reduce your balance.
                  </p>
                </div>
              )}
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
            <Button
              onClick={submitLeave}
              className="w-full sm:w-auto"
              disabled={exceedsBalance || createLeave.isPending}
            >
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
              Request official certificates from Human Resources. Routed to Unit
              Head → Department Head.
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

    if (activeRequest === "loan") {
      return (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            {backButton}
            <CardTitle>Loan Application Form</CardTitle>
            <CardDescription>
              Salary or emergency loan request. Fully approved after Unit Head and
              Department Head.
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
    }

    return (
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          {backButton}
          <CardTitle>Reliever Request Form</CardTitle>
          <CardDescription>
            Request a covering / relief officer. Routed to Unit Head → Department
            Head.
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
          <div className="grid gap-2">
            <Label>Proposed reliever *</Label>
            <Input
              value={relieverName}
              onChange={(e) => setRelieverName(e.target.value)}
              placeholder="Name of covering staff"
            />
          </div>
          <div className="grid gap-2">
            <Label>Coverage dates</Label>
            <Input
              value={relieverDates}
              onChange={(e) => setRelieverDates(e.target.value)}
              placeholder="e.g. Mar 10–14, 2026"
            />
          </div>
          <div className="grid gap-2">
            <Label>Reason *</Label>
            <Textarea
              value={relieverReason}
              onChange={(e) => setRelieverReason(e.target.value)}
              rows={3}
              placeholder="Why a reliever is needed…"
            />
          </div>
          <Button onClick={submitReliever} className="w-full sm:w-auto">
            Submit reliever request
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
            <CardDescription>
              Same leave records shown to HR — status updates when Unit Head or
              Department Head act.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLeavesLoading ? (
              <div className="py-4 text-center text-sm text-gray-500">Loading leaves…</div>
            ) : leaveRows.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">No leave requests found.</div>
            ) : (
              <div className="space-y-5">
                {leaveRows.slice(0, 8).map((leave) => {
                  const approvedOn = finalApprovalDate(leave.status, leave.steps);
                  return (
                    <div
                      key={leave.id}
                      className="border-b pb-4 last:border-0 last:pb-0 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-sm">
                            Leave — {leave.leaveType}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            Submitted{" "}
                            {new Date(leave.createdAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(leave.startDate).toLocaleDateString()} –{" "}
                            {new Date(leave.endDate).toLocaleDateString()} (
                            {leave.days} day{leave.days === 1 ? "" : "s"})
                          </div>
                        </div>
                        <StatusBadge status={leave.status} />
                      </div>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                        <dt>Approval stage</dt>
                        <dd className="font-medium text-gray-900">
                          {leave.status === "approved"
                            ? "Completed"
                            : leave.status === "rejected"
                              ? leave.currentStep
                              : leave.currentStep}
                        </dd>
                        <dt>Approval date</dt>
                        <dd className="font-medium text-gray-900">
                          {formatApprovalDate(approvedOn)}
                        </dd>
                      </dl>
                      <ApprovalStageControls
                        steps={leave.steps}
                        currentStep={leave.currentStep}
                        overallStatus={leave.status}
                        actorName=""
                        readOnly
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Other Requests</CardTitle>
            <CardDescription>
              Overtime, loan, certificate, reliever — shared with the HR approval
              queue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isRequestsLoading ? (
              <div className="py-4 text-center text-sm text-gray-500">Loading requests…</div>
            ) : requestRows.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">No recent requests found.</div>
            ) : (
              <div className="space-y-5">
                {requestRows.slice(0, 8).map((req) => {
                  const approvedOn = finalApprovalDate(req.status, req.steps);
                  return (
                    <div
                      key={req.id}
                      className="border-b pb-4 last:border-0 last:pb-0 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-sm">{req.title}</div>
                          <div className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">
                            {req.type}
                          </div>
                          <div className="text-xs text-gray-500">
                            Submitted{" "}
                            {new Date(req.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <StatusBadge status={req.status} />
                      </div>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                        <dt>Approval stage</dt>
                        <dd className="font-medium text-gray-900">
                          {req.status === "approved" ? "Completed" : req.currentStep}
                        </dd>
                        <dt>Approval date</dt>
                        <dd className="font-medium text-gray-900">
                          {formatApprovalDate(approvedOn)}
                        </dd>
                      </dl>
                      <ApprovalStageControls
                        steps={req.steps}
                        currentStep={req.currentStep}
                        overallStatus={req.status}
                        actorName=""
                        readOnly
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
