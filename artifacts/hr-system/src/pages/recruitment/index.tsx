import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useListJobs,
  getListJobsQueryKey,
  useCreateJob,
  useUpdateJob,
  type Job,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "wouter";
import { PlusCircle, ExternalLink, XCircle } from "lucide-react";
import { asArray } from "@/lib/api-guards";
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
  const queryClient = useQueryClient();
  const [postOpen, setPostOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [description, setDescription] = useState("");
  const [staffNeeded, setStaffNeeded] = useState("1");
  const [closingId, setClosingId] = useState<number | null>(null);

  const { data: jobs, isLoading } = useListJobs(undefined, {
    query: { queryKey: getListJobsQueryKey() },
  });

  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const rows = asArray<Job>(jobs);

  const invalidateJobs = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
  };

  const handlePostJob = async () => {
    if (!title.trim() || !department.trim() || !description.trim()) {
      toast.error("Title, department, and description are required.");
      return;
    }
    const needed = Math.floor(Number(staffNeeded));
    if (!Number.isFinite(needed) || needed < 1) {
      toast.error("Number of staff needed must be at least 1.");
      return;
    }
    try {
      await createJob.mutateAsync({
        data: {
          title: title.trim(),
          department: department.trim(),
          description: description.trim(),
          requirements: defaultRequirements,
          staffNeeded: needed,
          status: "active",
        },
      });
      await invalidateJobs();
      toast.success("Job posted.");
      setTitle("");
      setDepartment("");
      setDescription("");
      setStaffNeeded("1");
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
        <Button type="button" onClick={() => setPostOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Post Job
        </Button>
      </div>

      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Post a job</DialogTitle>
            <DialogDescription>
              Appears on the public /careers page in LBDH hiring-poster style. Put one qualification per line in the
              description (like your Facebook posts). Applicants complete a short checklist when they apply.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="job-title">Job title *</Label>
              <Input id="job-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Staff Nurse — ICU" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-dept">Department *</Label>
              <Input id="job-dept" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="ICU" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-staff-needed">Number of Staff Needed *</Label>
              <Input
                id="job-staff-needed"
                type="number"
                min={1}
                step={1}
                value={staffNeeded}
                onChange={(e) => setStaffNeeded(e.target.value)}
                placeholder="5"
              />
              <p className="text-xs text-gray-500">
                Shown on the careers listing as positions available. The job auto-marks as Filled when this many people
                are hired.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-desc">Qualifications (one per line) *</Label>
              <Textarea
                id="job-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={10}
                className="font-mono text-sm"
                placeholder={`FINANCE & ACCOUNTING MANAGER example:\nGraduate of BS Accountancy or related course\nAt least 5 years managerial experience in Finance and Accounting\nPreferably with hospital or healthcare industry experience\nStrong background in financial reporting and budgeting`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPostOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={createJob.isPending} onClick={handlePostJob}>
              {createJob.isPending ? "Posting…" : "Publish job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
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
                  <TableHead>Hiring</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Posted On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading jobs...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No jobs posted yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((job) => {
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
                        <TableCell className="text-sm text-gray-700">
                          {hired}/{needed} hired
                          {job.status === "active" && remaining > 0 ? (
                            <span className="block text-xs text-gray-500">
                              {remaining} position{remaining === 1 ? "" : "s"} open
                            </span>
                          ) : null}
                        </TableCell>
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
      </Card>
    </div>
  );
}
