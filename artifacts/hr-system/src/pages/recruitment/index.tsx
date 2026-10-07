import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useListJobs,
  getListJobsQueryKey,
  useCreateJob,
  useUpdateJob,
  customFetch,
  type Job,
  type ManpowerRequest,
  type ManpowerRequestInput,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "wouter";
import { PlusCircle, ExternalLink, XCircle, Check } from "lucide-react";
import { asArray } from "@/lib/api-guards";
import { useAuth } from "@/hooks/use-auth";
import { ReportDateTools } from "@/components/report-date-tools";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const defaultRequirements = [
  { label: "Meets posted qualifications", kind: "checkbox" as const, weight: 100 },
];

export default function Recruitment() {
  const { user } = useAuth();
  const initialPrf: ManpowerRequestInput = {
    position: "",
    unit: "",
    department: "",
    staffNeeded: 1,
    vacancyType: "New Position",
    vacancyDetails: "",
    jobDescription: "",
    qualifications: "",
  };
  const queryClient = useQueryClient();
  const [postOpen, setPostOpen] = useState(false);
  const [prfOpen, setPrfOpen] = useState(false);
  const [prfForm, setPrfForm] = useState<ManpowerRequestInput>(initialPrf);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [closingId, setClosingId] = useState<number | null>(null);

  const { data: jobs, isLoading } = useListJobs(undefined, {
    query: { queryKey: getListJobsQueryKey() },
  });

  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const rows = asArray<Job>(jobs);
  const {
    data: manpowerRequests,
    isLoading: isLoadingManpowerRequests,
    isError: manpowerRequestsError,
  } = useQuery({
    queryKey: ["/api/manpower-requests"],
    queryFn: () => customFetch<ManpowerRequest[]>("/api/manpower-requests"),
  });
  const requestRows = manpowerRequests ?? [];
  const createPrf = useMutation({
    mutationFn: (data: ManpowerRequestInput) =>
      customFetch<ManpowerRequest>("/api/manpower-requests", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
  const updatePrfApproval = useMutation({
    mutationFn: (data: { id: number; name: string; approved: boolean }) =>
      customFetch<ManpowerRequest>(`/api/manpower-requests/${data.id}/approvals`, {
        method: "PATCH",
        body: JSON.stringify({
          name: data.name,
          approved: data.approved,
          actor: user?.name ?? "HR",
        }),
      }),
  });

  const unpostedApprovedRequests = requestRows.filter(
    (request) =>
      request.status === "approved" &&
      !rows.some((job) => job.manpowerRequestId === request.id),
  );
  const jobByRequestId = new Map(
    rows
      .filter((job) => job.manpowerRequestId != null)
      .map((job) => [job.manpowerRequestId!, job] as const),
  );

  const invalidateJobs = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/manpower-requests"] });
  };

  const handleCreatePrf = async () => {
    if (
      !prfForm.position.trim() ||
      !prfForm.unit.trim() ||
      !prfForm.department.trim() ||
      !Number.isInteger(prfForm.staffNeeded) ||
      prfForm.staffNeeded < 1 ||
      !prfForm.vacancyDetails.trim() ||
      !prfForm.jobDescription.trim() ||
      !prfForm.qualifications.trim()
    ) {
      toast.error("Complete all PRF fields and enter a positive number of staff.");
      return;
    }
    try {
      await createPrf.mutateAsync({
        ...prfForm,
        position: prfForm.position.trim(),
        unit: prfForm.unit.trim(),
        department: prfForm.department.trim(),
        vacancyDetails: prfForm.vacancyDetails.trim(),
        jobDescription: prfForm.jobDescription.trim(),
        qualifications: prfForm.qualifications.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/manpower-requests"] });
      toast.success("Manpower request submitted for approval.");
      setPrfForm(initialPrf);
      setPrfOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create manpower request.");
    }
  };

  const handlePostJob = async () => {
    const request = requestRows.find((item) => item.id === Number(selectedRequestId));
    if (!request || request.status !== "approved") {
      toast.error("Select a fully approved manpower request before posting.");
      return;
    }
    try {
      await createJob.mutateAsync({
        data: {
          manpowerRequestId: request.id,
          title: request.position,
          unit: request.unit,
          department: request.department,
          description: request.jobDescription,
          requirements: defaultRequirements,
          staffNeeded: request.staffNeeded,
          status: "active",
        },
      });
      await invalidateJobs();
      toast.success("Job posted.");
      setSelectedRequestId("");
      setPostOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not create job.";
      toast.error(msg);
    }
  };

  const handleCloseJob = async (job: Job) => {
    if (job.status !== "active") return;
    const ok = window.confirm(
      `Close "${job.title}"? It will be removed from the careers page. Existing applicants are kept.`,
    );
    if (!ok) return;
    setClosingId(job.id);
    try {
      await updateJob.mutateAsync({
        id: job.id,
        data: {
          title: job.title,
          unit: job.unit,
          department: job.department,
          description: job.description,
          requirements: job.requirements,
          staffNeeded: job.staffNeeded ?? 1,
          status: "closed",
        },
      });
      await invalidateJobs();
      toast.success("Job listing closed. New applications are blocked.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not close job.";
      toast.error(msg);
    } finally {
      setClosingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Recruitment</h2>
          <p className="text-gray-500">Manage job postings and review applicants.</p>
          <p className="text-sm text-primary mt-1">
            Public careers page:{" "}
            <a href="/careers" target="_blank" rel="noreferrer" className="underline font-medium">
              /careers
            </a>
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setPrfOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> New Manpower Request / PRF
          </Button>
          <Button
            type="button"
            disabled={unpostedApprovedRequests.length === 0}
            onClick={() => setPostOpen(true)}
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Post Job
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="font-medium text-gray-900">Applicant Monitoring</p>
            <p className="text-sm text-gray-500">Review every applicant and track recruitment progress.</p>
          </div>
          <Button type="button" variant="outline" asChild>
            <Link href="/applicant-monitoring">Open monitoring</Link>
          </Button>
        </CardContent>
      </Card>

      <ReportDateTools
        title="Manpower Request / PRF Report"
        records={requestRows}
        dateOf={(request) => request.createdAt}
        columns={[
          { header: "Created", value: (request) => request.createdAt },
          { header: "Position", value: (request) => request.position },
          { header: "Unit", value: (request) => request.unit },
          { header: "Department", value: (request) => request.department },
          { header: "Staff needed", value: (request) => request.staffNeeded },
          { header: "Vacancy type", value: (request) => request.vacancyType },
          { header: "Vacancy details", value: (request) => request.vacancyDetails },
          { header: "Job description", value: (request) => request.jobDescription },
          { header: "Qualifications", value: (request) => request.qualifications },
          { header: "Approval status", value: (request) => request.approvals.map((approval) => `${approval.name}: ${approval.status}${approval.actor ? ` (${approval.actor})` : ""}${approval.timestamp ? ` at ${approval.timestamp}` : ""}`).join("\n") },
          { header: "Status", value: (request) => request.status },
          { header: "Linked job ID", value: (request) => jobByRequestId.get(request.id)?.id },
        ]}
      >
      {(reportRequestRows) => <Card>
        <CardHeader>
          <CardTitle>Manpower Requests / Personnel Requisition Forms</CardTitle>
          <p className="text-sm text-gray-500">
            Complete the Department Head, HR Manager, and President approval checklist before posting each job.
            HR can toggle any approval item here.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {manpowerRequestsError ? (
            <p className="text-sm text-red-700">Could not load manpower requests. Refresh the page and try again.</p>
          ) : isLoadingManpowerRequests ? (
            <p className="text-sm text-gray-500">Loading manpower requests...</p>
          ) : reportRequestRows.length === 0 ? (
            <p className="text-sm text-gray-500">No manpower requests for this period.</p>
          ) : (
            reportRequestRows.map((request) => {
              const linkedJob = jobByRequestId.get(request.id);
              return (
                <div key={request.id} className="rounded-lg border p-4 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{request.position}</h3>
                      <p className="text-sm text-gray-600">
                        {request.unit} · {request.department} · {request.staffNeeded} staff needed · {request.vacancyType}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Created {new Date(request.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={request.status} />
                      {linkedJob ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/recruitment/${linkedJob.id}`}>Open linked job</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    <span className="font-medium">Vacancy / replacement details: </span>
                    {request.vacancyDetails}
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Job description</p>
                      <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{request.jobDescription}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Qualifications</p>
                      <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{request.qualifications}</p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {request.approvals.map((approval) => {
                      const approved = approval.status === "approved";
                      return (
                        <button
                          key={approval.name}
                          type="button"
                          role="checkbox"
                          aria-checked={approved}
                          disabled={updatePrfApproval.isPending}
                          className={`flex items-start gap-3 rounded-md border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                            approved
                              ? "border-green-300 bg-green-50 text-green-900"
                              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                          onClick={async () => {
                            try {
                              await updatePrfApproval.mutateAsync({
                                id: request.id,
                                name: approval.name,
                                approved: !approved,
                              });
                              await queryClient.invalidateQueries({ queryKey: ["/api/manpower-requests"] });
                              toast.success(`${approval.name} ${approved ? "approval cleared" : "approved"}.`);
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Could not update approval.");
                            }
                          }}
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-current">
                            {approved ? <Check className="h-4 w-4" /> : null}
                          </span>
                          <span>
                            <span className="block text-sm font-medium">{approval.name}</span>
                            <span className="block text-xs">
                              {approved
                                ? `Approved${approval.actor ? ` by ${approval.actor}` : ""}${approval.timestamp ? ` · ${new Date(approval.timestamp).toLocaleString()}` : ""}`
                                : "Pending"}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {!linkedJob && request.status === "approved" ? (
                    <p className="text-sm font-medium text-green-800">
                      Approved — this request is ready to be linked to a job posting.
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>}
      </ReportDateTools>

      <Dialog open={prfOpen} onOpenChange={setPrfOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manpower Request / Personnel Requisition Form</DialogTitle>
            <DialogDescription>
              Submit the requested role and hiring details. The job cannot be posted until all three approval items are checked.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="prf-position">Requested position *</Label>
              <Input
                id="prf-position"
                value={prfForm.position}
                onChange={(event) => setPrfForm({ ...prfForm, position: event.target.value })}
                placeholder="Staff Nurse"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prf-unit">Unit *</Label>
              <Input
                id="prf-unit"
                value={prfForm.unit}
                onChange={(event) => setPrfForm({ ...prfForm, unit: event.target.value })}
                placeholder="ICU"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prf-department">Department *</Label>
              <Input
                id="prf-department"
                value={prfForm.department}
                onChange={(event) => setPrfForm({ ...prfForm, department: event.target.value })}
                placeholder="Nursing"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prf-staff-needed">Number of staff needed *</Label>
              <Input
                id="prf-staff-needed"
                type="number"
                min={1}
                step={1}
                value={prfForm.staffNeeded}
                onChange={(event) => setPrfForm({ ...prfForm, staffNeeded: Number(event.target.value) })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prf-vacancy-type">Vacancy type *</Label>
              <select
                id="prf-vacancy-type"
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={prfForm.vacancyType}
                onChange={(event) =>
                  setPrfForm({
                    ...prfForm,
                    vacancyType: event.target.value as ManpowerRequestInput["vacancyType"],
                  })
                }
              >
                <option value="New Position">New Position</option>
                <option value="Replacement">Replacement</option>
              </select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="prf-vacancy-details">Vacancy / replacement information *</Label>
              <Textarea
                id="prf-vacancy-details"
                value={prfForm.vacancyDetails}
                onChange={(event) => setPrfForm({ ...prfForm, vacancyDetails: event.target.value })}
                rows={3}
                placeholder="Reason for the new position or position/person being replaced"
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="prf-description">Job description *</Label>
              <Textarea
                id="prf-description"
                value={prfForm.jobDescription}
                onChange={(event) => setPrfForm({ ...prfForm, jobDescription: event.target.value })}
                rows={4}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="prf-qualifications">Qualifications *</Label>
              <Textarea
                id="prf-qualifications"
                value={prfForm.qualifications}
                onChange={(event) => setPrfForm({ ...prfForm, qualifications: event.target.value })}
                rows={4}
                placeholder="Enter one qualification per line"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPrfOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={createPrf.isPending} onClick={handleCreatePrf}>
              {createPrf.isPending ? "Submitting…" : "Submit for approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Post a job from an approved PRF</DialogTitle>
            <DialogDescription>
              Only fully approved manpower requests can be posted. The approved PRF supplies the position, unit,
              department, staff count, job description, and qualifications.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="job-prf">Approved manpower request *</Label>
              <select
                id="job-prf"
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedRequestId}
                onChange={(event) => setSelectedRequestId(event.target.value)}
              >
                <option value="">Select an approved PRF</option>
                {unpostedApprovedRequests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.position} — {request.unit} / {request.department} ({request.staffNeeded} needed)
                  </option>
                ))}
              </select>
              {unpostedApprovedRequests.length === 0 ? (
                <p className="text-sm text-amber-700">There are no approved, unposted PRFs available.</p>
              ) : null}
            </div>
            {requestRows.find((request) => request.id === Number(selectedRequestId)) ? (
              <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                Applicants will apply through the public careers page. The posting remains linked to its approved PRF
                and preserves the requested staffing count.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPostOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={createJob.isPending || !selectedRequestId}
              onClick={handlePostJob}
            >
              {createJob.isPending ? "Posting…" : "Publish job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReportDateTools
        title="Recruitment Job Vacancy Report"
        records={rows}
        dateOf={(job) => job.createdAt}
        columns={[
          { header: "Posted", value: (job) => job.createdAt },
          { header: "Position", value: (job) => job.title },
          { header: "Unit", value: (job) => job.unit },
          { header: "Department", value: (job) => job.department },
          { header: "Staff needed", value: (job) => job.staffNeeded },
          { header: "Applicants", value: (job) => job.applicantCount },
          { header: "Hired / onboarded", value: (job) => job.hiredCount },
          { header: "Remaining vacancy", value: (job) => job.remainingVacancy },
          { header: "Status", value: (job) => job.status },
          { header: "Linked PRF ID", value: (job) => job.manpowerRequestId },
        ]}
      >
      {(reportJobRows) => <Card>
        <CardHeader>
          <CardTitle>Job Listings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Staff Needed</TableHead>
                  <TableHead>Applicants</TableHead>
                  <TableHead>Hired / Onboarded</TableHead>
                  <TableHead>Remaining Vacancy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Posted On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading jobs...
                    </TableCell>
                  </TableRow>
                ) : reportJobRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      No jobs posted yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  reportJobRows.map((job) => {
                    const needed = job.staffNeeded ?? 1;
                    const hired = job.hiredCount ?? 0;
                    const remaining = Math.max(0, needed - hired);
                    return (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">
                          <Link href={`/recruitment/${job.id}`} className="hover:underline text-primary">
                            {job.title}
                          </Link>
                        </TableCell>
                        <TableCell>{job.department}</TableCell>
                        <TableCell>{needed}</TableCell>
                        <TableCell>{job.applicantCount}</TableCell>
                        <TableCell>{hired}</TableCell>
                        <TableCell>{remaining}</TableCell>
                        <TableCell>
                          <StatusBadge status={job.status} />
                        </TableCell>
                        <TableCell>{new Date(job.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {job.status === "active" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-700 hover:text-red-800 hover:bg-red-50"
                                disabled={closingId === job.id || updateJob.isPending}
                                onClick={() => handleCloseJob(job)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                {closingId === job.id ? "Closing…" : "Close"}
                              </Button>
                            ) : null}
                            {job.status === "active" ? (
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/apply/${job.id}`} target="_blank">
                                  <ExternalLink className="h-4 w-4 mr-2" /> Apply link
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>}
      </ReportDateTools>
    </div>
  );
}
