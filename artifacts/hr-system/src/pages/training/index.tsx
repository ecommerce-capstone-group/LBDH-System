import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  useListTrainingPlans,
  getListTrainingPlansQueryKey,
  useListTrainingRecords,
  getListTrainingRecordsQueryKey,
  useListEmployees,
  getListEmployeesQueryKey,
  useCreateTrainingPlan,
  useCreateTrainingRecord,
  useAdvanceTrainingPlan,
  type TrainingPlan,
  type TrainingRecord,
  type Employee,
  type TrainingCategory,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApprovalStepper } from "@/components/approval-stepper";
import { ApprovalActions } from "@/components/approval-actions";
import { asArray } from "@/lib/api-guards";
import { PlusCircle, GraduationCap } from "lucide-react";
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

const categoryLabels: Record<TrainingCategory, string> = {
  doh_initiated: "DOH / Compliance (HR only)",
  hospital_required: "Hospital-required",
  departmental_request: "Department-requested",
};

const currentYear = new Date().getFullYear();

export default function Training() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(String(currentYear));
  const [planOpen, setPlanOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [planCategory, setPlanCategory] = useState<TrainingCategory>("doh_initiated");
  const [planTitle, setPlanTitle] = useState("");
  const [planDesc, setPlanDesc] = useState("");
  const [planHours, setPlanHours] = useState("8");
  const [planDate, setPlanDate] = useState("");
  const [planDept, setPlanDept] = useState("");
  const [recEmployeeId, setRecEmployeeId] = useState("");
  const [recPlanId, setRecPlanId] = useState("");
  const [recDate, setRecDate] = useState("");
  const [recHours, setRecHours] = useState("8");
  const [recRemarks, setRecRemarks] = useState("");
  const [recContract, setRecContract] = useState("");
  const [recFile, setRecFile] = useState("");

  const yearNum = Number(year) || currentYear;

  const { data: plans, isLoading: plansLoading } = useListTrainingPlans(
    { year: yearNum },
    { query: { queryKey: getListTrainingPlansQueryKey({ year: yearNum }) } },
  );
  const { data: records, isLoading: recordsLoading } = useListTrainingRecords(
    {},
    { query: { queryKey: getListTrainingRecordsQueryKey({}) } },
  );
  const { data: employees } = useListEmployees(undefined, {
    query: { queryKey: getListEmployeesQueryKey() },
  });

  const createPlan = useCreateTrainingPlan();
  const createRecord = useCreateTrainingRecord();
  const advancePlan = useAdvanceTrainingPlan();

  const planRows = asArray<TrainingPlan>(plans);
  const recordRows = asArray<TrainingRecord>(records);
  const employeeRows = asArray<Employee>(employees);
  const selectedRecordPlan =
    recPlanId === "" ? null : planRows.find((p) => p.id === Number(recPlanId)) ?? null;

  const grouped = {
    doh_initiated: planRows.filter((p) => p.category === "doh_initiated"),
    hospital_required: planRows.filter((p) => p.category === "hospital_required"),
    departmental_request: planRows.filter((p) => p.category === "departmental_request"),
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/training-plans"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/training-records"] });
  };

  const handleCreatePlan = async () => {
    if (!planTitle.trim()) {
      toast.error("Title is required.");
      return;
    }
    try {
      await createPlan.mutateAsync({
        data: {
          year: yearNum,
          category: planCategory,
          title: planTitle.trim(),
          description: planDesc.trim(),
          trainingHours: Number(planHours) || 0,
          plannedDate: planDate || null,
          department: planDept.trim() || null,
        },
      });
      await invalidate();
      toast.success("Training plan added.");
      setPlanOpen(false);
      setPlanTitle("");
      setPlanDesc("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not create plan.");
    }
  };

  const handleCreateRecord = async () => {
    const eid = Number(recEmployeeId);
    if (!recEmployeeId || Number.isNaN(eid)) {
      toast.error("Select an employee.");
      return;
    }
    if (!selectedRecordPlan || !recDate) {
      toast.error("Training plan and date are required.");
      return;
    }
    try {
      await createRecord.mutateAsync({
        data: {
          employeeId: eid,
          planId: selectedRecordPlan.id,
          trainingName: selectedRecordPlan.title,
          trainingDate: recDate,
          trainingHours: Number(recHours) || 0,
          trainingType: selectedRecordPlan.category,
          remarks: recRemarks.trim(),
          contractAgreement: recContract.trim(),
          fileReference: recFile.trim(),
          completionStatus: "completed",
        },
      });
      await invalidate();
      toast.success("Training record logged.");
      setRecordOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save record.");
    }
  };

  const PlanCard = ({ plan }: { plan: TrainingPlan }) => (
    <Card key={plan.id}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-base">{plan.title}</CardTitle>
          <StatusBadge status={plan.status} />
        </div>
        <p className="text-xs text-gray-500">
          {plan.trainingHours}h
          {plan.plannedDate ? ` · ${new Date(plan.plannedDate).toLocaleDateString()}` : ""}
          {plan.department ? ` · ${plan.department}` : ""}
        </p>
      </CardHeader>
      <CardContent>
        {plan.description ? (
          <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{plan.description}</p>
        ) : null}
        {plan.category === "departmental_request" && plan.steps?.length > 0 ? (
          <>
            <ApprovalStepper steps={plan.steps} currentStep={plan.currentStep} />
            {plan.status === "pending" ? (
              <ApprovalActions
                actor={user?.name ?? "HR"}
                onAdvance={async (decision, note) => {
                  await advancePlan.mutateAsync({
                    id: plan.id,
                    data: { decision, actor: user?.name ?? "HR", note },
                  });
                  await invalidate();
                  toast.success(decision === "approve" ? "Step approved." : "Request rejected.");
                }}
              />
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-primary" />
            Training Management
          </h2>
          <p className="text-gray-500">
            Annual plans, compliance tracking, and employee training records.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setRecordOpen(true)}>
            Log completion
          </Button>
          <Button type="button" onClick={() => setPlanOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add to annual plan
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Label htmlFor="plan-year">Plan year</Label>
        <Input
          id="plan-year"
          type="number"
          className="w-28"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Annual plan</TabsTrigger>
          <TabsTrigger value="records">Training records</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-8 mt-6">
          {plansLoading ? (
            <p className="text-gray-500">Loading plans…</p>
          ) : (
            (Object.keys(grouped) as TrainingCategory[]).map((cat) => (
              <section key={cat}>
                <h3 className="text-lg font-semibold mb-3">{categoryLabels[cat]}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {grouped[cat].length === 0 ? (
                    <p className="text-sm text-gray-500 col-span-2">No items for {yearNum}.</p>
                  ) : (
                    grouped[cat].map((p) => <PlanCard key={p.id} plan={p} />)
                  )}
                </div>
              </section>
            ))
          )}
        </TabsContent>

        <TabsContent value="records" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Training</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordsLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : recordRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          No training records yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      recordRows.map((r) => {
                        const emp = employeeRows.find((e) => e.id === r.employeeId);
                        return (
                          <TableRow key={r.id}>
                            <TableCell>
                              {new Date(r.trainingDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>{emp?.name ?? `EMP-${r.employeeId}`}</TableCell>
                            <TableCell className="font-medium">{r.trainingName}</TableCell>
                            <TableCell className="text-sm capitalize">
                              {r.trainingType.replace(/_/g, " ")}
                            </TableCell>
                            <TableCell>{r.trainingHours}</TableCell>
                            <TableCell>
                              <StatusBadge status={r.completionStatus} />
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
      </Tabs>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to annual training plan</DialogTitle>
            <DialogDescription>
              DOH plans are HR-only. Hospital plans can be opened for employee enrollment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Category</Label>
              <select
                className={selectClass}
                value={planCategory}
                onChange={(e) => setPlanCategory(e.target.value as TrainingCategory)}
              >
                <option value="doh_initiated">DOH / compliance</option>
                <option value="hospital_required">Hospital-required</option>
                <option value="departmental_request">Department-requested</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Title *</Label>
              <Input value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea value={planDesc} onChange={(e) => setPlanDesc(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Hours</Label>
                <Input type="number" value={planHours} onChange={(e) => setPlanHours(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Planned date</Label>
                <Input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Department (optional)</Label>
              <Input value={planDept} onChange={(e) => setPlanDept(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createPlan.isPending} onClick={handleCreatePlan}>
              {createPlan.isPending ? "Saving…" : "Save plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log training completion</DialogTitle>
            <DialogDescription>
              Replaces Excel tracking — store hours, contract, and file reference.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label>Employee *</Label>
              <select
                className={selectClass}
                value={recEmployeeId}
                onChange={(e) => setRecEmployeeId(e.target.value)}
              >
                <option value="">Select…</option>
                {employeeRows.map((e) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Training name *</Label>
              <select
                className={selectClass}
                value={recPlanId}
                onChange={(e) => setRecPlanId(e.target.value)}
              >
                <option value="">Select annual plan…</option>
                {planRows.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.title} /{p.trainingHours} hours
                  </option>
                ))}
              </select>
              {selectedRecordPlan ? (
                <p className="text-xs text-gray-500">
                  Total plan hours: /{selectedRecordPlan.trainingHours} hours
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Date *</Label>
                <Input type="date" value={recDate} onChange={(e) => setRecDate(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Hours completed today *</Label>
                <Input type="number" value={recHours} onChange={(e) => setRecHours(e.target.value)} />
              </div>
            </div>
            {selectedRecordPlan ? (
              <div className="grid gap-2">
                <Label>Type</Label>
                <p className="text-sm text-gray-600 capitalize">
                  {selectedRecordPlan.category.replace(/_/g, " ")}
                </p>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Remarks</Label>
              <Textarea value={recRemarks} onChange={(e) => setRecRemarks(e.target.value)} rows={2} />
            </div>
            <div className="grid gap-2">
              <Label>Contract agreement</Label>
              <Textarea value={recContract} onChange={(e) => setRecContract(e.target.value)} rows={2} />
            </div>
            <div className="grid gap-2">
              <Label>File reference / document link</Label>
              <Input
                value={recFile}
                onChange={(e) => setRecFile(e.target.value)}
                placeholder="e.g. SharePoint path or file name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createRecord.isPending} onClick={handleCreateRecord}>
              {createRecord.isPending ? "Saving…" : "Save record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
