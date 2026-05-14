import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useListJobs,
  getListJobsQueryKey,
  useCreateJob,
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
import { PlusCircle, ExternalLink } from "lucide-react";
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

  const { data: jobs, isLoading } = useListJobs({
    query: { queryKey: getListJobsQueryKey() },
  });

  const createJob = useCreateJob();
  const rows = asArray<Job>(jobs);

  const handlePostJob = async () => {
    if (!title.trim() || !department.trim() || !description.trim()) {
      toast.error("Title, department, and description are required.");
      return;
    }
    try {
      await createJob.mutateAsync({
        data: {
          title: title.trim(),
          department: department.trim(),
          description: description.trim(),
          requirements: defaultRequirements,
          status: "active",
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast.success("Job posted.");
      setTitle("");
      setDepartment("");
      setDescription("");
      setPostOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not create job.";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Recruitment</h2>
          <p className="text-gray-500">Manage job postings and review applicants.</p>
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
              Creates an open position. Applicants will answer a default qualification checklist on the public apply page.
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
              <Label htmlFor="job-desc">Description *</Label>
              <Textarea
                id="job-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Responsibilities, schedule, qualifications…"
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
          <CardTitle>Open Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Posted On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading jobs...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No jobs posted yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">
                        <Link href={`/recruitment/${job.id}`} className="hover:underline text-primary">
                          {job.title}
                        </Link>
                      </TableCell>
                      <TableCell>{job.department}</TableCell>
                      <TableCell>
                        <StatusBadge status={job.status} />
                      </TableCell>
                      <TableCell>{new Date(job.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/apply/${job.id}`} target="_blank">
                            <ExternalLink className="h-4 w-4 mr-2" /> View Public Page
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
