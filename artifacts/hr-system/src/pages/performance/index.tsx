import { useListAppraisals, getListAppraisalsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Star } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Performance() {
  const { data: appraisals, isLoading } = useListAppraisals({}, {
    query: { queryKey: getListAppraisalsQueryKey({}) }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Performance Appraisals</h2>
          <p className="text-gray-500">Track employee evaluations and reviews.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> New Appraisal
        </Button>
      </div>

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
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">Loading appraisals...</TableCell>
                  </TableRow>
                ) : appraisals?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">No performance records found.</TableCell>
                  </TableRow>
                ) : (
                  appraisals?.map((appraisal) => (
                    <TableRow key={appraisal.id}>
                      <TableCell>{new Date(appraisal.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">EMP-{appraisal.employeeId.toString().padStart(4, '0')}</TableCell>
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
