import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  useListEmployees,
  getListEmployeesQueryKey,
  useCreateEmployee,
  type Employee,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { asArray } from "@/lib/api-guards";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Employees() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseName, setLicenseName] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [documents, setDocuments] = useState("");

  const { data: employees, isLoading, isError } = useListEmployees(
    { search },
    { query: { queryKey: getListEmployeesQueryKey({ search }) } },
  );

  const createEmployee = useCreateEmployee();

  const rows = asArray<Employee>(employees);

  const resetForm = () => {
    setName("");
    setRole("");
    setDepartment("");
    setEmail("");
    setPhone("");
    setLicenseName("");
    setLicenseExpiry("");
    setDocuments("");
  };

  const handleAddEmployee = async () => {
    if (!name.trim() || !role.trim() || !department.trim() || !email.trim()) {
      toast.error("Name, role, department, and email are required.");
      return;
    }
    try {
      await createEmployee.mutateAsync({
        data: {
          name: name.trim(),
          role: role.trim(),
          department: department.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          licenseName: licenseName.trim() || null,
          licenseExpiry: licenseExpiry.trim() || null,
          documents: documents.trim() || null,
          vlBalance: 15,
          slBalance: 15,
          status: "active",
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast.success("Employee added.");
      resetForm();
      setAddOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not create employee.";
      toast.error(msg);
    }
  };

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
        <Button type="button" onClick={() => setAddOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Add Employee
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add employee</DialogTitle>
            <DialogDescription>Create a new staff record. Required fields are marked.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="emp-name">Full name *</Label>
              <Input id="emp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria Santos" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-role">Role / title *</Label>
              <Input id="emp-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Registered Nurse" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-dept">Department *</Label>
              <Input id="emp-dept" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="ICU" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-email">Email *</Label>
              <Input id="emp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@lbdh.org" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-phone">Phone</Label>
              <Input id="emp-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+63 917 555 0100" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-license">License name</Label>
              <Input id="emp-license" value={licenseName} onChange={(e) => setLicenseName(e.target.value)} placeholder="PRC Nursing License" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-license-exp">License expiry</Label>
              <Input id="emp-license-exp" type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-docs">Documents / notes</Label>
              <Textarea id="emp-docs" value={documents} onChange={(e) => setDocuments(e.target.value)} rows={2} placeholder="PRC ID, BLS, …" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={createEmployee.isPending} onClick={handleAddEmployee}>
              {createEmployee.isPending ? "Saving…" : "Save employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading employees...
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-destructive">
                      Could not load employees. Check your network, or set{" "}
                      <code className="text-xs">API_PROXY_TARGET</code> in <code className="text-xs">.env</code>{" "}
                      (default uses the published Replit API).
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No employees found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((emp) => {
                    const isExpiring =
                      emp.licenseExpiry &&
                      new Date(emp.licenseExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    return (
                      <TableRow key={emp.id} className="cursor-pointer hover:bg-gray-50/50">
                        <TableCell>
                          <Link href={`/employees/${emp.id}`}>
                            <div className="font-medium text-gray-900 hover:underline">{emp.name}</div>
                            <div className="text-sm text-gray-500">{emp.role}</div>
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">
                          {emp.name} • EMP-{String(emp.id).padStart(4, "0")}
                        </TableCell>
                        <TableCell>{emp.department}</TableCell>
                        <TableCell>
                          <div className="text-sm">{emp.email}</div>
                          <div className="text-sm text-gray-500">{emp.phone || "-"}</div>
                        </TableCell>
                        <TableCell>
                          {emp.licenseName ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm truncate max-w-[120px]" title={emp.licenseName}>
                                {emp.licenseName}
                              </span>
                              {isExpiring && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                                  Expiring
                                </Badge>
                              )}
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
