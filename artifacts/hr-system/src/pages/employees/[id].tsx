import { useGetEmployee, getGetEmployeeQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmployeeReadPanel } from "@/components/employee-read-panel";
import { EmployeeAnalyticsPanel } from "@/components/employee-analytics-panel";
import { Mail, Phone, Building, Briefcase, Award, PlusCircle } from "lucide-react";
import { isRecord } from "@/lib/api-guards";
import { Button } from "@/components/ui/button";

export default function EmployeeDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: employee, isLoading } = useGetEmployee(id, {
    query: { enabled: !!id, queryKey: getGetEmployeeQueryKey(id) },
  });

  if (isLoading) return <div className="p-6">Loading profile...</div>;
  if (!employee || !isRecord(employee) || typeof employee.name !== "string") {
    return <div className="p-6">Employee not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Employee Management — {employee.name}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-500">{employee.role}</span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-500">{employee.department}</span>
            <StatusBadge status={employee.status} className="ml-2" />
          </div>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link href={`/incidents?employeeId=${id}`}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Record incident
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="read" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto border-b rounded-none h-auto p-0 bg-transparent">
          {[
            { value: "profile", label: "Profile" },
            { value: "read", label: "Read" },
            { value: "analytics", label: "Analytics" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <span className="text-sm">{employee.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <span className="text-sm">{employee.phone || "Not provided"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Building className="h-5 w-5 text-gray-400" />
                  <span className="text-sm">{employee.department}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Briefcase className="h-5 w-5 text-gray-400" />
                  <span className="text-sm">{employee.role}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Professional License</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {employee.licenseName ? (
                  <>
                    <div className="flex items-center gap-3">
                      <Award className="h-5 w-5 text-gray-400" />
                      <span className="text-sm font-medium">{employee.licenseName}</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Expiry Date</p>
                      <p className="text-sm">
                        {employee.licenseExpiry
                          ? new Date(employee.licenseExpiry).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No license information on file.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="read" className="mt-6">
          <EmployeeReadPanel employeeId={id} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <EmployeeAnalyticsPanel
            employeeId={id}
            title={`Analytics — ${employee.name}`}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
