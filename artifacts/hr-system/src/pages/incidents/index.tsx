import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListIncidents,
  getListIncidentsQueryKey,
  useListEmployees,
  getListEmployeesQueryKey,
  useCreateIncident,
  useUpdateIncident,
  type Employee,
  type EmployeeIncident,
  type EmployeeIncidentInput,
  type IncidentActionTaken,
  type IncidentStatus,
} from "@workspace/api-client-react";
import { EmployeeAnalyticsPanel } from "@/components/employee-analytics-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { asArray } from "@/lib/api-guards";
import { ShieldAlert, PlusCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const actionLabels: Record<IncidentActionTaken, string> = {
  oral_reprimand: "Oral reprimand",
  warning: "Warning",
  suspension: "Suspension",
  other: "Other disciplinary action",
};

const emptyForm = {
  employeeId: "",
  incidentDate: "",
  policyViolated: "",
  violationDescription: "",
  department: "",
  actionTaken: "warning" as IncidentActionTaken,
  actionDetails: "",
  status: "ongoing" as IncidentStatus,
  hrRemarks: "",
  approvingAuthority: "",
  relatedAppraisalPeriod: "",
};

export default function Incidents() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeIncident | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: incidents, isLoading } = useListIncidents(
    statusFilter !== "all" ? { status: statusFilter as IncidentStatus } : undefined,
    { query: { queryKey: getListIncidentsQueryKey(statusFilter !== "all" ? { status: statusFilter as IncidentStatus } : undefined) } },
  );
  const { data: employees } = useListEmployees(undefined, {
    query: { queryKey: getListEmployeesQueryKey() },
  });

  const createIncident = useCreateIncident();
  const updateIncident = useUpdateIncident();

  const incidentRows = asArray<EmployeeIncident>(incidents);
  const employeeRows = asArray<Employee>(employees);

  const empMap = new Map(employeeRows.map((e) => [e.id, e]));

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (inc: EmployeeIncident) => {
    setEditing(inc);
    setForm({
      employeeId: String(inc.employeeId),
      incidentDate: inc.incidentDate.slice(0, 10),
      policyViolated: inc.policyViolated,
      violationDescription: inc.violationDescription,
      department: inc.department,
      actionTaken: inc.actionTaken,
      actionDetails: inc.actionDetails ?? "",
      status: inc.status,
      hrRemarks: inc.hrRemarks ?? "",
      approvingAuthority: inc.approvingAuthority ?? "",
      relatedAppraisalPeriod: inc.relatedAppraisalPeriod ?? "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.employeeId || !form.incidentDate || !form.policyViolated || !form.violationDescription) {
      toast.error("Complete all required fields.");
      return;
    }
    const payload: EmployeeIncidentInput = {
      employeeId: Number(form.employeeId),
      incidentDate: form.incidentDate,
      policyViolated: form.policyViolated.trim(),
      violationDescription: form.violationDescription.trim(),
      department: form.department.trim() || undefined,
      actionTaken: form.actionTaken,
      actionDetails: form.actionDetails.trim() || undefined,
      status: form.status,
      hrRemarks: form.hrRemarks.trim() || undefined,
      approvingAuthority: form.approvingAuthority.trim() || undefined,
      relatedAppraisalPeriod: form.relatedAppraisalPeriod.trim() || undefined,
    };
    try {
      if (editing) {
        await updateIncident.mutateAsync({ id: editing.id, data: payload });
        toast.success("Incident updated.");
      } else {
        await createIncident.mutateAsync({ data: payload });
        toast.success("Incident recorded.");
      }
      await invalidate();
      setOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save incident.");
    }
  };

  const markResolved = async (inc: EmployeeIncident) => {
    try {
      await updateIncident.mutateAsync({
        id: inc.id,
        data: { status: "resolved" },
      });
      await invalidate();
      toast.success("Marked as resolved.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not update status.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-primary" />
            Incidents & Policy Violations
          </h2>
          <p className="text-gray-500">
            Track disciplinary actions and link them to appraisals and compliance.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Record incident
        </Button>
      </div>

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">Incident records</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All incidents</CardTitle>
              <select
                className={`${selectClass} w-auto`}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="ongoing">Ongoing</option>
                <option value="resolved">Resolved</option>
              </select>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Policy</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : incidentRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          No incidents recorded.
                        </TableCell>
                      </TableRow>
                    ) : (
                      incidentRows.map((inc) => {
                        const emp = empMap.get(inc.employeeId);
                        return (
                          <TableRow key={inc.id}>
                            <TableCell>
                              {new Date(inc.incidentDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Link
                                href={`/employees/${inc.employeeId}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {emp?.name ?? `EMP-${inc.employeeId}`}
                              </Link>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {inc.policyViolated}
                            </TableCell>
                            <TableCell className="text-sm">
                              {actionLabels[inc.actionTaken] ?? inc.actionTaken}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={inc.status} />
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openEdit(inc)}
                              >
                                Edit
                              </Button>
                              {inc.status === "ongoing" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => markResolved(inc)}
                                >
                                  Resolve
                                </Button>
                              ) : null}
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
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <EmployeeAnalyticsPanel title="Hospital-wide incident analytics" />
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit incident record" : "Record policy violation / incident"}
            </DialogTitle>
            <DialogDescription>
              Los Baños Doctors Hospital — employee incident tracking form.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Employee *</Label>
              <select
                className={selectClass}
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                disabled={!!editing}
              >
                <option value="">Select employee…</option>
                {employeeRows.map((e) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.name} — {e.department}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Incident date *</Label>
                <Input
                  type="date"
                  value={form.incidentDate}
                  onChange={(e) => setForm({ ...form, incidentDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <select
                  className={selectClass}
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as IncidentStatus })
                  }
                >
                  <option value="ongoing">Ongoing</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Policy violated *</Label>
              <Input
                value={form.policyViolated}
                onChange={(e) => setForm({ ...form, policyViolated: e.target.value })}
                placeholder="e.g. Attendance policy, Code of conduct"
              />
            </div>
            <div className="grid gap-2">
              <Label>Violation description *</Label>
              <Textarea
                value={form.violationDescription}
                onChange={(e) =>
                  setForm({ ...form, violationDescription: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Department / unit</Label>
                <Input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Action taken *</Label>
                <select
                  className={selectClass}
                  value={form.actionTaken}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      actionTaken: e.target.value as IncidentActionTaken,
                    })
                  }
                >
                  {(Object.keys(actionLabels) as IncidentActionTaken[]).map((k) => (
                    <option key={k} value={k}>
                      {actionLabels[k]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {form.actionTaken === "other" ? (
              <div className="grid gap-2">
                <Label>Other action details</Label>
                <Textarea
                  value={form.actionDetails}
                  onChange={(e) => setForm({ ...form, actionDetails: e.target.value })}
                  rows={2}
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Approving authority</Label>
              <Input
                value={form.approvingAuthority}
                onChange={(e) =>
                  setForm({ ...form, approvingAuthority: e.target.value })
                }
                placeholder="e.g. Department Head, HR Manager"
              />
            </div>
            <div className="grid gap-2">
              <Label>Related appraisal period (if applicable)</Label>
              <Input
                value={form.relatedAppraisalPeriod}
                onChange={(e) =>
                  setForm({ ...form, relatedAppraisalPeriod: e.target.value })
                }
                placeholder="e.g. Q1 2026, 3rd month appraisal"
              />
            </div>
            <div className="grid gap-2">
              <Label>HR remarks</Label>
              <Textarea
                value={form.hrRemarks}
                onChange={(e) => setForm({ ...form, hrRemarks: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createIncident.isPending || updateIncident.isPending}
            >
              {createIncident.isPending || updateIncident.isPending
                ? "Saving…"
                : editing
                  ? "Update record"
                  : "Save incident"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
