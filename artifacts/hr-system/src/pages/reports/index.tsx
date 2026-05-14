import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useListAttendance,
  getListAttendanceQueryKey,
  useListEmployees,
  getListEmployeesQueryKey,
  type Attendance,
  type Employee,
} from "@workspace/api-client-react";
import { useMemo } from "react";
import { asArray } from "@/lib/api-guards";

export default function Reports() {
  const { data: summary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });

  const { data: attendance } = useListAttendance({}, {
    query: { queryKey: getListAttendanceQueryKey({}) },
  });

  const { data: employees } = useListEmployees(undefined, {
    query: { queryKey: getListEmployeesQueryKey() },
  });

  const attendanceRows = asArray<Attendance>(attendance);
  const employeeRows = asArray<Employee>(employees);

  const empMap = useMemo(() => {
    const map = new Map<number, { name: string; code: string }>();
    employeeRows.forEach((e: any) => {
      map.set(e.id, {
        name: `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || `EMP-${e.id}`,
        code: e.employeeCode ?? `EMP-${String(e.id).padStart(4, "0")}`,
      });
    });
    return map;
  }, [employeeRows]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Reports & Analytics</h2>
        <p className="text-gray-500">Hospital-wide statistics and summaries.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Headcount</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.totalEmployees ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Jobs</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.activeJobs ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Applicants</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.totalApplicants ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pending Requests</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.pendingRequests ?? 0}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Attendance Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Late (Mins)</TableHead>
                <TableHead>OT (Mins)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceRows.slice(0, 20).map((record: any) => {
                const info = empMap.get(record.employeeId);
                return (
                  <TableRow key={record.id}>
                    <TableCell>{record.date}</TableCell>
                    <TableCell className="font-medium">{info?.name ?? "—"}</TableCell>
                    <TableCell>{info?.code ?? `EMP-${String(record.employeeId).padStart(4, "0")}`}</TableCell>
                    <TableCell>{record.status}</TableCell>
                    <TableCell>{record.lateMinutes ?? 0}</TableCell>
                    <TableCell>{record.overtimeMinutes ?? 0}</TableCell>
                  </TableRow>
                );
              })}
              {attendanceRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-6">
                    No attendance records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
