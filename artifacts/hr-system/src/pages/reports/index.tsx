import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useGetDashboardSummary, getGetDashboardSummaryQueryKey, useListAttendance, getListAttendanceQueryKey } from "@workspace/api-client-react";

export default function Reports() {
  const { user } = useAuth();
  
  if (user?.role !== "hr") {
    return <div>Unauthorized</div>;
  }

  const { data: summary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });

  const { data: attendance } = useListAttendance({}, {
    query: { queryKey: getListAttendanceQueryKey({}) }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Reports & Analytics</h2>
        <p className="text-gray-500">Hospital-wide statistics and summaries.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Headcount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalEmployees || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.activeJobs || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Applicants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalApplicants || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.pendingRequests || 0}</div>
          </CardContent>
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
                <TableHead>Employee ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Late (Mins)</TableHead>
                <TableHead>OT (Mins)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance?.slice(0, 10).map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{record.date}</TableCell>
                  <TableCell>EMP-{record.employeeId.toString().padStart(4, '0')}</TableCell>
                  <TableCell>{record.status}</TableCell>
                  <TableCell>{record.lateMinutes}</TableCell>
                  <TableCell>{record.overtimeMinutes}</TableCell>
                </TableRow>
              ))}
              {(!attendance || attendance.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-6">
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
