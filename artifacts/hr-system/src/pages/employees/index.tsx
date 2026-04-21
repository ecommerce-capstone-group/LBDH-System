import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useListEmployees, getListEmployeesQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export default function Employees() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: employees, isLoading } = useListEmployees(
    { search },
    { query: { queryKey: getListEmployeesQueryKey({ search }) } }
  );

  if (user?.role !== "hr") {
    return <div>Unauthorized</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Employee Directory</h2>
          <p className="text-gray-500">Manage hospital staff and their profiles.</p>
        </div>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" /> Add Employee
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search by name, role, or department..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>License Status</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">Loading employees...</TableCell>
                  </TableRow>
                ) : employees?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">No employees found.</TableCell>
                  </TableRow>
                ) : (
                  employees?.map((emp) => {
                    const isExpiring = emp.licenseExpiry && new Date(emp.licenseExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    return (
                      <TableRow key={emp.id} className="cursor-pointer hover:bg-gray-50/50">
                        <TableCell>
                          <Link href={`/employees/${emp.id}`}>
                            <div className="font-medium text-gray-900 hover:underline">{emp.name}</div>
                            <div className="text-sm text-gray-500">{emp.role}</div>
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">{emp.name} • EMP-{String(emp.id).padStart(4, "0")}</TableCell>
                        <TableCell>{emp.department}</TableCell>
                        <TableCell>
                          <div className="text-sm">{emp.email}</div>
                          <div className="text-sm text-gray-500">{emp.phone || '-'}</div>
                        </TableCell>
                        <TableCell>
                          {emp.licenseName ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm truncate max-w-[120px]" title={emp.licenseName}>{emp.licenseName}</span>
                              {isExpiring && <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">Expiring</Badge>}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={emp.status} />
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
