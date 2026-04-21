import { useState } from "react";
import { useListAttendance, getListAttendanceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export default function Attendance() {
  const { data: attendance, isLoading } = useListAttendance({}, {
    query: { queryKey: getListAttendanceQueryKey({}) }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Attendance Log</h2>
          <p className="text-gray-500">Monitor employee daily attendance and lateness.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Log Entry
        </Button>
      </div>

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
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">Loading attendance...</TableCell>
                  </TableRow>
                ) : attendance?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">No records found.</TableCell>
                  </TableRow>
                ) : (
                  attendance?.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium text-gray-900">EMP-{record.employeeId.toString().padStart(4, '0')}</TableCell>
                      <TableCell><StatusBadge status={record.status} /></TableCell>
                      <TableCell className={record.lateMinutes > 0 ? "text-red-600" : ""}>{record.lateMinutes} min</TableCell>
                      <TableCell className={record.undertimeMinutes > 0 ? "text-amber-600" : ""}>{record.undertimeMinutes} min</TableCell>
                      <TableCell className={record.overtimeMinutes > 0 ? "text-emerald-600 font-medium" : ""}>{record.overtimeMinutes} min</TableCell>
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
