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
  useAdvanceAppraisal,
  useArchiveAppraisal,
  type Appraisal,
  type Employee,
} from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { APPRAISAL_TEMPLATES, maxPossibleTotal } from "@workspace/db/appraisal-templates";
import { AppraisalForm, AppraisalDetailView } from "@/components/appraisal-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Star, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { asArray } from "@/lib/api-guards";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Performance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Appraisal | null>(null);

  const { data: appraisals, isLoading } = useListAppraisals(
    {},
    { query: { queryKey: getListAppraisalsQueryKey({}) } },
  );

  const { data: employees } = useListEmployees(undefined, {
    query: { queryKey: getListEmployeesQueryKey() },
  });

  const createAppraisal = useCreateAppraisal();
  const advanceAppraisal = useAdvanceAppraisal();
  const archiveAppraisal = useArchiveAppraisal();
  const rows = asArray<Appraisal>(appraisals);
  const employeeRows = asArray<Employee>(employees);

  const handleCreate = async (
    data: Parameters<typeof createAppraisal.mutateAsync>[0]["data"],
  ) => {
    try {
      await createAppraisal.mutateAsync({ data });
      await queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
      toast.success("Appraisal saved.");
      setOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not create appraisal.";
      toast.error(msg);
      throw e;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Performance Appraisals
          </h2>
          <p className="text-gray-500">
            Non-supervisory: appraiser → department head → HR → employee acknowledgement →
            archive. Supervisory: self-assessment → appraiser → HR → acknowledgement → archive.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> New Appraisal
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>New appraisal</DialogTitle>
            <DialogDescription>
              Complete the official LBDH appraisal form. Template is chosen automatically
              from the employee&apos;s role.
            </DialogDescription>
          </DialogHeader>
          <AppraisalForm
            employees={employeeRows}
            defaultEvaluator={user?.name ?? "HR"}
            onSubmit={handleCreate}
            onCancel={() => setOpen(false)}
            isPending={createAppraisal.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Appraisal details</DialogTitle>
            <DialogDescription>
              {detail
                ? `${detail.employeeName} — ${detail.appraisalType}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <AppraisalDetailView
              appraisal={detail}
              actor={user?.name ?? "HR"}
              onAdvance={
                detail.status === "pending"
                  ? async (decision, note) => {
                      const updated = await advanceAppraisal.mutateAsync({
                        id: detail.id,
                        data: { decision, actor: user?.name ?? "HR", note },
                      });
                      setDetail(updated);
                      await queryClient.invalidateQueries({
                        queryKey: ["/api/appraisals"],
                      });
                      toast.success(
                        decision === "approve" ? "Step approved." : "Rejected.",
                      );
                    }
                  : undefined
              }
              onArchive={
                detail.status === "approved"
                  ? async (signedFormReference) => {
                      const updated = await archiveAppraisal.mutateAsync({
                        id: detail.id,
                        data: {
                          signedFormReference,
                          actor: user?.name ?? "HR",
                        },
                      });
                      setDetail(updated);
                      await queryClient.invalidateQueries({
                        queryKey: ["/api/appraisals"],
                      });
                      toast.success("Appraisal archived.");
                    }
                  : undefined
              }
            />
          ) : null}
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
                  <TableHead>Form</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Evaluator</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      Loading appraisals...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No performance records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((appraisal) => {
                    const template = APPRAISAL_TEMPLATES[appraisal.templateType];
                    const maxTotal = maxPossibleTotal(template);
                    return (
                      <TableRow key={appraisal.id}>
                        <TableCell>
                          {new Date(appraisal.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium">
                          {appraisal.employeeName}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {template.label.replace(" Appraisal", "")}
                        </TableCell>
                        <TableCell>{appraisal.appraisalType}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 font-medium text-emerald-600">
                            <Star className="h-4 w-4 fill-emerald-500" />
                            {appraisal.totalScore}/{maxTotal}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={appraisal.status} />
                        </TableCell>
                        <TableCell>{appraisal.evaluator}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetail(appraisal)}
                            aria-label="View appraisal"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
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
