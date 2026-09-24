import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useListOnboardings,
  getListOnboardingsQueryKey,
  useUpdateOnboarding,
  useCreateEmployeeFromOnboarding,
  type Onboarding,
  type PreEmploymentRequirement,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserPlus, ClipboardList } from "lucide-react";
import { asArray } from "@/lib/api-guards";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function OnboardingPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [editRecord, setEditRecord] = useState<Onboarding | null>(null);
  const [hireRecord, setHireRecord] = useState<Onboarding | null>(null);

  const [interviewScheduledAt, setInterviewScheduledAt] = useState("");
  const [interviewStatus, setInterviewStatus] = useState("pending");
  const [interviewResult, setInterviewResult] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [hrNotes, setHrNotes] = useState("");
  const [onboardingStatus, setOnboardingStatus] = useState("in_progress");
  const [requirements, setRequirements] = useState<PreEmploymentRequirement[]>([]);

  const [hireName, setHireName] = useState("");
  const [hireRole, setHireRole] = useState("");
  const [hireDepartment, setHireDepartment] = useState("");
  const [hireEmail, setHireEmail] = useState("");
  const [hirePhone, setHirePhone] = useState("");
  const [hireLicenseName, setHireLicenseName] = useState("");
  const [hireLicenseExpiry, setHireLicenseExpiry] = useState("");

  const listParams = useMemo(
    () => (statusFilter ? { status: statusFilter } : undefined),
    [statusFilter],
  );

  const { data, isLoading } = useListOnboardings(listParams, {
    query: { queryKey: getListOnboardingsQueryKey(listParams) },
  });
  const updateOnboarding = useUpdateOnboarding();
  const createEmployeeFromOnboarding = useCreateEmployeeFromOnboarding();

  const rows = asArray<Onboarding>(data);

  const openEdit = (row: Onboarding) => {
    setEditRecord(row);
    setInterviewScheduledAt(toDatetimeLocalValue(row.interviewScheduledAt));
    setInterviewStatus(row.interviewStatus || "pending");
    setInterviewResult(row.interviewResult || "");
    setInterviewNotes(row.interviewNotes || "");
    setHrNotes(row.hrNotes || "");
    setOnboardingStatus(row.status || "in_progress");
    setRequirements(
      Array.isArray(row.preEmploymentRequirements)
        ? row.preEmploymentRequirements.map((r) => ({ ...r }))
        : [],
    );
  };

  const openHire = (row: Onboarding) => {
    setHireRecord(row);
    setHireName(row.applicantName);
    setHireRole(row.jobTitle);
    setHireDepartment(row.jobDepartment);
    setHireEmail(row.applicantEmail);
    setHirePhone(row.applicantPhone);
    setHireLicenseName("");
    setHireLicenseExpiry("");
  };

  const handleSave = async () => {
    if (!editRecord) return;
    try {
      await updateOnboarding.mutateAsync({
        id: editRecord.id,
        data: {
          interviewScheduledAt: fromDatetimeLocalValue(interviewScheduledAt),
          interviewStatus,
          interviewResult: interviewResult.trim() || "",
          interviewNotes: interviewNotes.trim() || "",
          hrNotes: hrNotes.trim() || "",
          status: onboardingStatus,
          preEmploymentRequirements: requirements,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/onboardings"] });
      toast.success("Onboarding updated.");
      setEditRecord(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not update onboarding.";
      toast.error(msg);
    }
  };

  const handleCreateEmployee = async () => {
    if (!hireRecord) return;
    if (!hireName.trim() || !hireRole.trim() || !hireDepartment.trim() || !hireEmail.trim()) {
      toast.error("Name, role, department, and email are required.");
      return;
    }
    try {
      const result = await createEmployeeFromOnboarding.mutateAsync({
        id: hireRecord.id,
        data: {
          name: hireName.trim(),
          role: hireRole.trim(),
          department: hireDepartment.trim(),
          email: hireEmail.trim(),
          phone: hirePhone.trim() || null,
          licenseName: hireLicenseName.trim() || null,
          licenseExpiry: hireLicenseExpiry.trim() || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/onboardings"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast.success(`Employee created: EMP-${String(result.employee.id).padStart(4, "0")}`);
      setHireRecord(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not create employee.";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Onboarding</h2>
          <p className="text-gray-500">
            Track selected applicants through interview, pre-employment, and hire into the employee directory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className={selectClass + " w-44"}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="in_progress">In progress</option>
            <option value="approved">Approved</option>
            <option value="hired">Hired</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Button type="button" variant="outline" asChild>
            <Link href="/recruitment">
              <ClipboardList className="mr-2 h-4 w-4" /> From recruitment
            </Link>
          </Button>
        </div>
      </div>

      <Dialog open={!!editRecord} onOpenChange={(o) => !o && setEditRecord(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update onboarding</DialogTitle>
            <DialogDescription>
              {editRecord?.applicantName} — {editRecord?.jobTitle}
            </DialogDescription>
          </DialogHeader>
          {editRecord && (
            <>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="ob-interview-at">Interview schedule</Label>
                  <Input
                    id="ob-interview-at"
                    type="datetime-local"
                    value={interviewScheduledAt}
                    onChange={(e) => setInterviewScheduledAt(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ob-interview-status">Interview status</Label>
                  <select
                    id="ob-interview-status"
                    className={selectClass}
                    value={interviewStatus}
                    onChange={(e) => setInterviewStatus(e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ob-interview-result">Interview result</Label>
                  <Textarea
                    id="ob-interview-result"
                    value={interviewResult}
                    onChange={(e) => setInterviewResult(e.target.value)}
                    rows={2}
                    placeholder="Recommended for hire, needs second interview, …"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ob-interview-notes">Interview notes</Label>
                  <Textarea
                    id="ob-interview-notes"
                    value={interviewNotes}
                    onChange={(e) => setInterviewNotes(e.target.value)}
                    rows={2}
                  />
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">Pre-employment requirements</h4>
                  <div className="space-y-2 rounded-md border bg-gray-50 p-3">
                    {requirements.map((req, i) => (
                      <div key={`${req.label}-${i}`} className="flex items-center gap-2">
                        <Checkbox
                          id={`req-${i}`}
                          checked={req.done}
                          onCheckedChange={(v) =>
                            setRequirements((prev) =>
                              prev.map((r, idx) => (idx === i ? { ...r, done: v === true } : r)),
                            )
                          }
                        />
                        <Label htmlFor={`req-${i}`} className="text-sm font-normal cursor-pointer">
                          {req.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ob-status">Onboarding status</Label>
                  <select
                    id="ob-status"
                    className={selectClass}
                    value={onboardingStatus}
                    onChange={(e) => setOnboardingStatus(e.target.value)}
                  >
                    <option value="in_progress">In progress</option>
                    <option value="approved">Approved (ready to create employee)</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ob-hr-notes">HR notes</Label>
                  <Textarea id="ob-hr-notes" value={hrNotes} onChange={(e) => setHrNotes(e.target.value)} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditRecord(null)}>
                  Cancel
                </Button>
                <Button type="button" disabled={updateOnboarding.isPending} onClick={handleSave}>
                  {updateOnboarding.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!hireRecord} onOpenChange={(o) => !o && setHireRecord(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create employee profile</DialogTitle>
            <DialogDescription>
              Prefills from the applicant and job. Creates a normal employee record (same as Employees → Add).
            </DialogDescription>
          </DialogHeader>
          {hireRecord && (
            <>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="hire-name">Full name *</Label>
                  <Input id="hire-name" value={hireName} onChange={(e) => setHireName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hire-role">Role / title *</Label>
                  <Input id="hire-role" value={hireRole} onChange={(e) => setHireRole(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hire-dept">Department *</Label>
                  <Input id="hire-dept" value={hireDepartment} onChange={(e) => setHireDepartment(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hire-email">Email *</Label>
                  <Input id="hire-email" type="email" value={hireEmail} onChange={(e) => setHireEmail(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hire-phone">Phone</Label>
                  <Input id="hire-phone" value={hirePhone} onChange={(e) => setHirePhone(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hire-license">License name</Label>
                  <Input
                    id="hire-license"
                    value={hireLicenseName}
                    onChange={(e) => setHireLicenseName(e.target.value)}
                    placeholder="PRC Nursing License"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hire-license-exp">License expiry</Label>
                  <Input
                    id="hire-license-exp"
                    type="date"
                    value={hireLicenseExpiry}
                    onChange={(e) => setHireLicenseExpiry(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setHireRecord(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={createEmployeeFromOnboarding.isPending}
                  onClick={handleCreateEmployee}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {createEmployeeFromOnboarding.isPending ? "Creating…" : "Create employee"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid gap-6">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading onboarding records…</div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No onboarding records yet. Open a job in Recruitment and click{" "}
              <span className="font-medium">Start onboarding</span> on the chosen applicant.
            </CardContent>
          </Card>
        ) : (
          rows.map((row) => {
            const reqs = asArray<PreEmploymentRequirement>(row.preEmploymentRequirements);
            const doneCount = reqs.filter((r) => r.done).length;
            return (
              <Card key={row.id} className={row.status === "hired" || row.status === "cancelled" ? "opacity-80" : ""}>
                <CardHeader className="pb-3 border-b border-gray-100">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <CardTitle className="text-lg truncate">{row.applicantName}</CardTitle>
                      <StatusBadge status={row.status} />
                    </div>
                    <p className="text-sm text-gray-500">
                      Started {new Date(row.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {row.jobTitle} · {row.jobDepartment} · Applicant #{row.applicantId} · Job #{row.jobId}
                    {row.employeeId != null ? ` · EMP-${String(row.employeeId).padStart(4, "0")}` : ""}
                  </p>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Applicant</h4>
                        <div className="text-sm space-y-1 text-gray-700">
                          <p>{row.applicantEmail || "—"}</p>
                          <p>{row.applicantPhone || "—"}</p>
                          <p>
                            <Link href={`/recruitment/${row.jobId}`} className="text-primary hover:underline">
                              View original job application
                            </Link>
                          </p>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Interview</h4>
                        <div className="text-sm space-y-1">
                          <p>
                            <span className="text-gray-500">Schedule: </span>
                            {row.interviewScheduledAt
                              ? new Date(row.interviewScheduledAt).toLocaleString()
                              : "Not scheduled"}
                          </p>
                          <p>
                            <span className="text-gray-500">Status: </span>
                            {row.interviewStatus}
                          </p>
                          {row.interviewResult ? (
                            <p className="text-gray-700 bg-gray-50 border rounded p-2 whitespace-pre-wrap">
                              {row.interviewResult}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">
                        Pre-employment ({doneCount}/{reqs.length})
                      </h4>
                      <div className="space-y-2 bg-gray-50 p-4 rounded-md border border-gray-100 max-h-48 overflow-auto">
                        {reqs.map((req, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <Checkbox checked={req.done} disabled />
                            <span className="text-sm">{req.label}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        {row.status !== "hired" && row.status !== "cancelled" && (
                          <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                            Update
                          </Button>
                        )}
                        {row.status === "approved" && !row.employeeId && (
                          <Button type="button" size="sm" onClick={() => openHire(row)}>
                            <UserPlus className="mr-2 h-4 w-4" /> Create employee
                          </Button>
                        )}
                        {row.employeeId != null && (
                          <Button type="button" variant="outline" size="sm" asChild>
                            <Link href={`/employees/${row.employeeId}`}>Open employee</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
