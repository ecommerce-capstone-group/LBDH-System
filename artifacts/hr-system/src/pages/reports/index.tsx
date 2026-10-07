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
import { ReportDateTools } from "@/components/report-date-tools";

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

      <ReportDateTools
        title="Attendance Summary Report"
        records={attendanceRows}
        dateOf={(record) => record.date}
        columns={[
          { header: "Date", value: (record) => record.date },
          { header: "Employee", value: (record) => empMap.get(record.employeeId)?.name ?? "—" },
          {
            header: "Employee ID",
            value: (record) =>
              empMap.get(record.employeeId)?.code ??
              `EMP-${String(record.employeeId).padStart(4, "0")}`,
          },
          { header: "Status", value: (record) => record.status },
          { header: "Late (Mins)", value: (record) => record.lateMinutes ?? 0 },
          { header: "OT (Mins)", value: (record) => record.overtimeMinutes ?? 0 },
          { header: "Undertime (Mins)", value: (record) => record.undertimeMinutes ?? 0 },
          { header: "Notes", value: (record) => record.notes ?? "" },
        ]}
      >
        {(reportRows) => (
          <Card>
            <CardHeader>
              <CardTitle>Attendance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
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
                    {reportRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-gray-500">
                          No attendance records found for this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      reportRows.map((record) => {
                        const info = empMap.get(record.employeeId);
                        return (
                          <TableRow key={record.id}>
                            <TableCell>{record.date}</TableCell>
                            <TableCell className="font-medium">{info?.name ?? "—"}</TableCell>
                            <TableCell>
                              {info?.code ?? `EMP-${String(record.employeeId).padStart(4, "0")}`}
                            </TableCell>
                            <TableCell>{record.status}</TableCell>
                            <TableCell>{record.lateMinutes ?? 0}</TableCell>
                            <TableCell>{record.overtimeMinutes ?? 0}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </ReportDateTools>
    </div>
  );
}
