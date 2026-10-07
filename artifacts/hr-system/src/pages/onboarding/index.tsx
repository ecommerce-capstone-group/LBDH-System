import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useListOnboardings,
  getListOnboardingsQueryKey,
  getGetApplicantQueryKey,
  getListApplicantsQueryKey,
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
import {
  EmployeeCredentialsDialog,
  type EmployeeAccountCredentials,
} from "@/components/employee-credentials-dialog";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function OnboardingPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [editRecord, setEditRecord] = useState<Onboarding | null>(null);
  const [hireRecord, setHireRecord] = useState<Onboarding | null>(null);
  const [credentials, setCredentials] = useState<EmployeeAccountCredentials | null>(null);

  const [startingDate, setStartingDate] = useState("");
  const [medicalStatus, setMedicalStatus] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [medicalDocuments, setMedicalDocuments] = useState("");
  const [hrNotes, setHrNotes] = useState("");
  const [progressStage, setProgressStage] = useState("Pre-Employment Requirements");
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
    setStartingDate(row.startingDate || "");
    setMedicalStatus(row.medicalStatus || "");
    setMedicalNotes(row.medicalNotes || "");
    setMedicalDocuments(row.medicalDocuments || "");
    setHrNotes(row.hrNotes || "");
    setProgressStage(row.progressStage || "Pre-Employment Requirements");
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
    const data: Parameters<typeof updateOnboarding.mutateAsync>[0]["data"] = {
      progressStage,
    };
    if (progressStage === "Pre-Employment Requirements") {
      data.preEmploymentRequirements = requirements;
    } else if (
      progressStage === "Medical / Physical Exam" ||
      progressStage === "Fit to Work"
    ) {
      data.medicalStatus = medicalStatus || null;
      data.medicalNotes = medicalNotes.trim();
      if (progressStage === "Medical / Physical Exam") {
        data.medicalDocuments = medicalDocuments.trim();
      }
    } else if (progressStage === "Starting Date") {
      data.startingDate = startingDate || null;
    } else if (progressStage === "Onboarding") {
      data.hrNotes = hrNotes.trim();
    }
    try {
      await updateOnboarding.mutateAsync({
        id: editRecord.id,
        data,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/onboardings"] });
      await queryClient.invalidateQueries({ queryKey: getListApplicantsQueryKey() });
      await queryClient.invalidateQueries({
        queryKey: getGetApplicantQueryKey(editRecord.applicantId),
      });
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
      await queryClient.invalidateQueries({ queryKey: getListApplicantsQueryKey() });
      await queryClient.invalidateQueries({
        queryKey: getGetApplicantQueryKey(hireRecord.applicantId),
      });
      setHireRecord(null);
      if (result.account?.username && result.account.temporaryPassword) {
        setCredentials({
          username: result.account.username,
          temporaryPassword: result.account.temporaryPassword,
          employeeName: result.employee.name,
          employeeCode: `EMP-${String(result.employee.id).padStart(4, "0")}`,
        });
        toast.success(
          `Employee created: EMP-${String(result.employee.id).padStart(4, "0")}. Login credentials shown once.`,
        );
      } else {
        toast.error(
          `Employee profile EMP-${String(result.employee.id).padStart(4, "0")} was created, but no login credentials were returned.`,
          { duration: 10000 },
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not create employee.";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <EmployeeCredentialsDialog
        credentials={credentials}
        onClose={() => setCredentials(null)}
      />
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
            <DialogTitle>Update onboarding step</DialogTitle>
            <DialogDescription>
              {editRecord?.applicantName} — {editRecord?.jobTitle}. Choose a step and update only its information.
            </DialogDescription>
          </DialogHeader>
          {editRecord && (
            <>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="ob-progress-stage">Onboarding progress</Label>
                  <select
                    id="ob-progress-stage"
                    className={selectClass}
                    value={progressStage}
                    onChange={(e) => {
                      const nextStage = e.target.value;
                      setProgressStage(nextStage);
                      if (nextStage === "Fit to Work" && medicalStatus === "For Physical Exam") {
                        setMedicalStatus("");
                      }
                    }}
                  >
                    <option value="Pre-Employment Requirements">Pre-Employment Requirements</option>
                    <option value="Medical / Physical Exam">Medical / Physical Exam</option>
                    <option value="Fit to Work">Fit to Work</option>
                    <option value="Starting Date">Starting Date</option>
                    <option value="Onboarding">Onboarding</option>
                  </select>
                  <p className="text-xs text-gray-500">
                    You can select any step and update it directly. Changes are shared with Applicant Monitoring.
                  </p>
                </div>
                {progressStage === "Pre-Employment Requirements" ? (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Pre-employment requirements</h4>
                    <p className="mb-3 text-xs text-gray-500">
                      This checklist is shared with the applicant record in Applicant Monitoring.
                    </p>
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
                          <Label htmlFor={`req-${i}`} className="cursor-pointer text-sm font-normal">
                            {req.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {progressStage === "Medical / Physical Exam" ? (
                  <div className="space-y-4 rounded-md border p-3">
                    <h4 className="text-sm font-semibold">Medical / Physical Exam</h4>
                    <div className="grid gap-2">
                      <Label htmlFor="ob-medical-status">
                        Assessment status
                      </Label>
                      <select
                        id="ob-medical-status"
                        className={selectClass}
                        value={medicalStatus}
                        onChange={(event) => setMedicalStatus(event.target.value)}
                      >
                        <option value="">Not recorded</option>
                        <option value="For Physical Exam">For Physical Exam</option>
                        <option value="Fit to Work">Fit to Work</option>
                        <option value="Not Fit">Not Fit</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="ob-medical-notes">Medical notes / relevant information</Label>
                      <Textarea
                        id="ob-medical-notes"
                        value={medicalNotes}
                        onChange={(event) => setMedicalNotes(event.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="ob-medical-documents">Document names or secure references</Label>
                      <Textarea
                        id="ob-medical-documents"
                        value={medicalDocuments}
                        onChange={(event) => setMedicalDocuments(event.target.value)}
                        rows={2}
                        placeholder="Record document names or an existing secure reference"
                      />
                      <p className="text-xs text-gray-500">
                        The system records references only; it does not upload or store medical files.
                      </p>
                    </div>
                    {editRecord.medicalUpdatedAt ? (
                      <p className="text-xs text-gray-500">
                        Last updated: {new Date(editRecord.medicalUpdatedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {progressStage === "Fit to Work" ? (
                  <div className="space-y-4 rounded-md border p-3">
                    <h4 className="text-sm font-semibold">Fit to Work decision</h4>
                    <div className="grid gap-2">
                      <Label htmlFor="ob-medical-status">Assessment result</Label>
                      <select
                        id="ob-medical-status"
                        className={selectClass}
                        value={medicalStatus}
                        onChange={(event) => setMedicalStatus(event.target.value)}
                      >
                        <option value="">Not recorded</option>
                        <option value="Fit to Work">Fit to Work</option>
                        <option value="Not Fit">Not Fit</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="ob-medical-notes">Decision notes</Label>
                      <Textarea
                        id="ob-medical-notes"
                        value={medicalNotes}
                        onChange={(event) => setMedicalNotes(event.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                ) : null}
                {progressStage === "Starting Date" ? (
                  <div className="grid gap-2">
                    <Label htmlFor="ob-starting-date">Starting date</Label>
                    <Input
                      id="ob-starting-date"
                      type="date"
                      value={startingDate}
                      onChange={(e) => setStartingDate(e.target.value)}
                    />
                  </div>
                ) : null}
                {progressStage === "Onboarding" ? (
                  <div className="grid gap-2">
                    <Label htmlFor="ob-hr-notes">Onboarding notes</Label>
                    <Textarea
                      id="ob-hr-notes"
                      value={hrNotes}
                      onChange={(e) => setHrNotes(e.target.value)}
                      rows={3}
                    />
                    <p className="text-xs text-gray-500">
                      Once the checklist, Fit to Work decision, and starting date are complete, you can onboard the employee from their record below.
                    </p>
                  </div>
                ) : null}
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
              No onboarding records yet. Set the applicant status to Accepted Offer in Applicant Monitoring, then start pre-employment requirements.
            </CardContent>
          </Card>
        ) : (
          rows.map((row) => {
            const reqs = asArray<PreEmploymentRequirement>(row.preEmploymentRequirements);
            const doneCount = reqs.filter((r) => r.done).length;
            const readyToOnboard =
              reqs.length > 0 &&
              reqs.every((requirement) => requirement.done) &&
              row.medicalStatus === "Fit to Work" &&
              Boolean(row.startingDate) &&
              row.progressStage === "Onboarding" &&
              row.status !== "cancelled" &&
              !row.employeeId;
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
                  <p className="text-sm text-gray-600 mt-1">
                    Starting date: {row.startingDate ? new Date(`${row.startingDate}T00:00:00`).toLocaleDateString() : "Not set"}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Onboarding progress: <strong>{row.progressStage}</strong>
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Medical assessment: <strong>{row.medicalStatus || "Not recorded"}</strong>
                    {row.medicalUpdatedAt ? ` · Updated ${new Date(row.medicalUpdatedAt).toLocaleString()}` : ""}
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
                      {row.medicalNotes || row.medicalDocuments ? (
                        <div className="mt-4 space-y-2 rounded-md border p-3 text-sm">
                          {row.medicalNotes ? (
                            <p className="whitespace-pre-wrap">
                              <strong>Medical notes: </strong>{row.medicalNotes}
                            </p>
                          ) : null}
                          {row.medicalDocuments ? (
                            <p className="whitespace-pre-wrap">
                              <strong>Document references: </strong>{row.medicalDocuments}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        {row.status !== "hired" && row.status !== "cancelled" && (
                          <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                            Update onboarding step
                          </Button>
                        )}
                        {readyToOnboard && (
                          <Button type="button" size="sm" onClick={() => openHire(row)}>
                            <UserPlus className="mr-2 h-4 w-4" /> Onboard employee
                          </Button>
                        )}
                        {row.progressStage === "Onboarding" &&
                        row.status !== "cancelled" &&
                        !row.employeeId &&
                        !readyToOnboard ? (
                          <p className="self-center text-xs text-amber-700">
                            Finish all checklist items, record Fit to Work, and set the starting date to onboard.
                          </p>
                        ) : null}
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
