import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useListAttendance,
  getListAttendanceQueryKey,
  useListEmployees,
  getListEmployeesQueryKey,
  useCreateAttendance,
  type Attendance,
  type Employee,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle } from "lucide-react";
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

export default function Attendance() {
  const queryClient = useQueryClient();
  const [logOpen, setLogOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("Present");
  const [lateMinutes, setLateMinutes] = useState("0");
  const [undertimeMinutes, setUndertimeMinutes] = useState("0");
  const [overtimeMinutes, setOvertimeMinutes] = useState("0");
  const [notes, setNotes] = useState("");

  const { data: attendance, isLoading } = useListAttendance(
    {},
    { query: { queryKey: getListAttendanceQueryKey({}) } },
  );

  const { data: employees } = useListEmployees(undefined, {
    query: { queryKey: getListEmployeesQueryKey() },
  });

  const createAttendance = useCreateAttendance();
  const rows = asArray<Attendance>(attendance);
  const employeeRows = asArray<Employee>(employees);

  const handleLogEntry = async () => {
    const eid = Number(employeeId);
    if (!employeeId || Number.isNaN(eid)) {
      toast.error("Choose an employee.");
      return;
    }
    try {
      await createAttendance.mutateAsync({
        data: {
          employeeId: eid,
          date,
          status,
          lateMinutes: Number(lateMinutes) || 0,
          undertimeMinutes: Number(undertimeMinutes) || 0,
          overtimeMinutes: Number(overtimeMinutes) || 0,
          notes: notes.trim() || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast.success("Attendance logged.");
      setNotes("");
      setLateMinutes("0");
      setUndertimeMinutes("0");
      setOvertimeMinutes("0");
      setLogOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not log attendance.";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Attendance Log</h2>
          <p className="text-gray-500">Monitor employee daily attendance and lateness.</p>
        </div>
        <Button type="button" onClick={() => setLogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Log Entry
        </Button>
      </div>

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log attendance</DialogTitle>
            <DialogDescription>Add a daily attendance record for one employee.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="att-emp">Employee *</Label>
              <select
                id="att-emp"
                className={selectClass}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">Select…</option>
                {employeeRows.map((e) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.name} — {e.department}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="att-date">Date *</Label>
              <Input id="att-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="att-status">Status *</Label>
              <select id="att-status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="att-late">Late (min)</Label>
                <Input id="att-late" type="number" min={0} value={lateMinutes} onChange={(e) => setLateMinutes(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="att-ut">Undertime (min)</Label>
                <Input id="att-ut" type="number" min={0} value={undertimeMinutes} onChange={(e) => setUndertimeMinutes(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="att-ot">Overtime (min)</Label>
                <Input id="att-ot" type="number" min={0} value={overtimeMinutes} onChange={(e) => setOvertimeMinutes(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="att-notes">Notes</Label>
              <Textarea id="att-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={createAttendance.isPending} onClick={handleLogEntry}>
              {createAttendance.isPending ? "Saving…" : "Save entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Recent Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Undertime</TableHead>
                  <TableHead>Overtime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      Loading attendance...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium text-gray-900">
                        EMP-{record.employeeId.toString().padStart(4, "0")}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={record.status} />
                      </TableCell>
                      <TableCell className={record.lateMinutes > 0 ? "text-red-600" : ""}>{record.lateMinutes} min</TableCell>
                      <TableCell className={record.undertimeMinutes > 0 ? "text-amber-600" : ""}>{record.undertimeMinutes} min</TableCell>
                      <TableCell className={record.overtimeMinutes > 0 ? "text-emerald-600 font-medium" : ""}>
                        {record.overtimeMinutes} min
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
