import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useListOffboardings,
  getListOffboardingsQueryKey,
  useListEmployees,
  getListEmployeesQueryKey,
  useCreateOffboarding,
  useUpdateOffboarding,
  type Offboarding,
  type Employee,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserMinus } from "lucide-react";
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

export default function Offboarding() {
  const queryClient = useQueryClient();
  const [startOpen, setStartOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [reason, setReason] = useState("");
  const [exitInterview, setExitInterview] = useState("");
  const [createReplacementJob, setCreateReplacementJob] = useState(false);

  const [editRecord, setEditRecord] = useState<Offboarding | null>(null);
  const [editHr, setEditHr] = useState(false);
  const [editIt, setEditIt] = useState(false);
  const [editFinance, setEditFinance] = useState(false);
  const [editNotes, setEditNotes] = useState("");

  const { data: offboardings, isLoading } = useListOffboardings({
    query: { queryKey: getListOffboardingsQueryKey() },
  });

  const { data: employees } = useListEmployees(undefined, {
    query: { queryKey: getListEmployeesQueryKey() },
  });

  const createOffboarding = useCreateOffboarding();
  const updateOffboarding = useUpdateOffboarding();

  const rows = asArray<Offboarding>(offboardings);
  const employeeRows = asArray<Employee>(employees);
  const activeEmployees = employeeRows.filter((e) => e.status === "active");

  const openEdit = (o: Offboarding) => {
    setEditRecord(o);
    setEditHr(o.hrCleared);
    setEditIt(o.itCleared);
    setEditFinance(o.financeCleared);
    setEditNotes(o.exitInterview ?? "");
  };

  const handleStart = async () => {
    const eid = Number(employeeId);
    if (!employeeId || Number.isNaN(eid)) {
      toast.error("Choose an employee.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason is required.");
      return;
    }
    try {
      await createOffboarding.mutateAsync({
        data: {
          employeeId: eid,
          reason: reason.trim(),
          exitInterview: exitInterview.trim() || null,
          createReplacementJob,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/offboardings"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast.success("Offboarding started.");
      setReason("");
      setExitInterview("");
      setCreateReplacementJob(false);
      setEmployeeId("");
      setStartOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not start offboarding.";
      toast.error(msg);
    }
  };

  const handleSaveChecklist = async () => {
    if (!editRecord) return;
    try {
      await updateOffboarding.mutateAsync({
        id: editRecord.id,
        data: {
          hrCleared: editHr,
          itCleared: editIt,
          financeCleared: editFinance,
          exitInterview: editNotes.trim() || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/offboardings"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast.success("Offboarding updated.");
      setEditRecord(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not update.";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Offboarding</h2>
          <p className="text-gray-500">Manage employee exits and clearance procedures.</p>
        </div>
        <Button type="button" onClick={() => setStartOpen(true)}>
          <UserMinus className="mr-2 h-4 w-4" /> Start Offboarding
        </Button>
      </div>

      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start offboarding</DialogTitle>
            <DialogDescription>
              Marks the employee as offboarding and opens a clearance checklist. Optionally creates a replacement job post from their role.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="ob-emp">Employee *</Label>
              <select
                id="ob-emp"
                className={selectClass}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">Select active employee…</option>
                {activeEmployees.map((e) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.name} — {e.role}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ob-reason">Reason *</Label>
              <Textarea id="ob-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Resignation, end of contract, …" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ob-exit">Exit interview notes</Label>
              <Textarea id="ob-exit" value={exitInterview} onChange={(e) => setExitInterview(e.target.value)} rows={2} placeholder="Optional" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="ob-replace"
                checked={createReplacementJob}
                onCheckedChange={(v) => setCreateReplacementJob(v === true)}
              />
              <Label htmlFor="ob-replace" className="text-sm font-normal cursor-pointer">
                Create replacement job posting (same role / department)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStartOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={createOffboarding.isPending} onClick={handleStart}>
              {createOffboarding.isPending ? "Starting…" : "Start offboarding"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRecord} onOpenChange={(o) => !o && setEditRecord(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update clearance</DialogTitle>
            <DialogDescription>
              EMP-{editRecord ? String(editRecord.employeeId).padStart(4, "0") : ""}
            </DialogDescription>
          </DialogHeader>
          {editRecord && (
            <>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="ob-notes-edit">Exit interview notes</Label>
                  <Textarea id="ob-notes-edit" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="ob-hr" checked={editHr} onCheckedChange={(v) => setEditHr(v === true)} />
                  <Label htmlFor="ob-hr" className="text-sm font-normal cursor-pointer">
                    HR cleared
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="ob-it" checked={editIt} onCheckedChange={(v) => setEditIt(v === true)} />
                  <Label htmlFor="ob-it" className="text-sm font-normal cursor-pointer">
                    IT cleared
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="ob-fin" checked={editFinance} onCheckedChange={(v) => setEditFinance(v === true)} />
                  <Label htmlFor="ob-fin" className="text-sm font-normal cursor-pointer">
                    Finance cleared
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditRecord(null)}>
                  Cancel
                </Button>
                <Button type="button" disabled={updateOffboarding.isPending} onClick={handleSaveChecklist}>
                  {updateOffboarding.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid gap-6">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading offboarding records...</div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">No active offboarding processes.</CardContent>
          </Card>
        ) : (
          rows.map((offboarding) => (
            <Card key={offboarding.id} className={offboarding.status === "Completed" ? "opacity-75" : ""}>
              <CardHeader className="pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">EMP-{offboarding.employeeId.toString().padStart(4, "0")}</CardTitle>
                    <StatusBadge status={offboarding.status} />
                  </div>
                  <p className="text-sm text-gray-500">Started {new Date(offboarding.createdAt).toLocaleDateString()}</p>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Exit Details</h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500">Reason</p>
                        <p className="text-sm font-medium">{offboarding.reason}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Exit Interview Notes</p>
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded border border-gray-100">{offboarding.exitInterview}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Clearance Checklist</h4>
                    <div className="space-y-3 bg-gray-50 p-4 rounded-md border border-gray-100">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={offboarding.hrCleared} disabled />
                        <span className="text-sm font-medium">HR Clearance</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox checked={offboarding.itCleared} disabled />
                        <span className="text-sm font-medium">IT Clearance</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox checked={offboarding.financeCleared} disabled />
                        <span className="text-sm font-medium">Finance Clearance</span>
                      </div>
                    </div>
                    {offboarding.status === "Pending" && (
                      <div className="mt-4 flex justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={() => openEdit(offboarding)}>
                          Update Checklist
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
