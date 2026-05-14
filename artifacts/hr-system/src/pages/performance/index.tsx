import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  useListAppraisals,
  getListAppraisalsQueryKey,
  useListEmployees,
  getListEmployeesQueryKey,
  useCreateAppraisal,
  type Appraisal,
  type Employee,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Star } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

const appraisalKinds = ["Annual", "Regularization", "3rd Month", "4th Month", "Promotion"] as const;

export default function Performance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [kind, setKind] = useState<string>(appraisalKinds[0]);
  const [score, setScore] = useState("4");
  const [notes, setNotes] = useState("");
  const [evaluator, setEvaluator] = useState("");

  const { data: appraisals, isLoading } = useListAppraisals(
    {},
    { query: { queryKey: getListAppraisalsQueryKey({}) } },
  );

  const { data: employees } = useListEmployees(undefined, {
    query: { queryKey: getListEmployeesQueryKey() },
  });

  const createAppraisal = useCreateAppraisal();
  const rows = asArray<Appraisal>(appraisals);
  const employeeRows = asArray<Employee>(employees);

  const openDialog = () => {
    setEvaluator(user?.name ?? "HR");
    setOpen(true);
  };

  const handleCreate = async () => {
    const eid = Number(employeeId);
    if (!employeeId || Number.isNaN(eid)) {
      toast.error("Choose an employee.");
      return;
    }
    const s = Number(score);
    if (Number.isNaN(s) || s < 1 || s > 5) {
      toast.error("Score must be between 1 and 5.");
      return;
    }
    if (!evaluator.trim()) {
      toast.error("Evaluator name is required.");
      return;
    }
    try {
      await createAppraisal.mutateAsync({
        data: {
          employeeId: eid,
          kind,
          score: s,
          notes: notes.trim() || "—",
          evaluator: evaluator.trim(),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
      toast.success("Appraisal saved.");
      setNotes("");
      setScore("4");
      setEmployeeId("");
      setOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not create appraisal.";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Performance Appraisals</h2>
          <p className="text-gray-500">Track employee evaluations and reviews.</p>
        </div>
        <Button type="button" onClick={openDialog}>
          <PlusCircle className="mr-2 h-4 w-4" /> New Appraisal
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New appraisal</DialogTitle>
            <DialogDescription>Record an evaluation for an employee.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="ap-emp">Employee *</Label>
              <select
                id="ap-emp"
                className={selectClass}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">Select…</option>
                {employeeRows.map((e) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.name} — {e.role}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ap-kind">Type *</Label>
              <select id="ap-kind" className={selectClass} value={kind} onChange={(e) => setKind(e.target.value)}>
                {appraisalKinds.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ap-score">Score (1–5) *</Label>
              <Input id="ap-score" type="number" min={1} max={5} step={1} value={score} onChange={(e) => setScore(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ap-notes">Notes *</Label>
              <Textarea id="ap-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Summary of performance…" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ap-eval">Evaluator *</Label>
              <Input id="ap-eval" value={evaluator} onChange={(e) => setEvaluator(e.target.value)} placeholder="Name of evaluator" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={createAppraisal.isPending} onClick={handleCreate}>
              {createAppraisal.isPending ? "Saving…" : "Save appraisal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Recent Evaluations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Evaluator</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      Loading appraisals...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No performance records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((appraisal) => (
                    <TableRow key={appraisal.id}>
                      <TableCell>{new Date(appraisal.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">EMP-{appraisal.employeeId.toString().padStart(4, "0")}</TableCell>
                      <TableCell>{appraisal.kind}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 font-medium text-emerald-600">
                          <Star className="h-4 w-4 fill-emerald-500" />
                          {appraisal.score}/5
                        </div>
                      </TableCell>
                      <TableCell>{appraisal.evaluator}</TableCell>
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
