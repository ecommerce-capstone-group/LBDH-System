import {
  useGetEmployee,
  getGetEmployeeQueryKey,
  useListAppraisals,
  getListAppraisalsQueryKey,
  type Appraisal,
} from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { AppraisalDetailView } from "@/components/appraisal-form";
import { APPRAISAL_TEMPLATES, maxPossibleTotal } from "@workspace/db/appraisal-templates";
import { Mail, Phone, Building, Briefcase, Award, Star } from "lucide-react";
import { isRecord, asArray } from "@/lib/api-guards";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EmployeeDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [detail, setDetail] = useState<Appraisal | null>(null);

  const { data: employee, isLoading } = useGetEmployee(id, {
    query: { enabled: !!id, queryKey: getGetEmployeeQueryKey(id) }
  });

  const { data: appraisals, isLoading: appraisalsLoading } = useListAppraisals(
    { employeeId: id },
    { query: { enabled: !!id, queryKey: getListAppraisalsQueryKey({ employeeId: id }) } },
  );
  const appraisalRows = asArray<Appraisal>(appraisals);

  if (isLoading) return <div className="p-6">Loading profile...</div>;
  if (!employee || !isRecord(employee) || typeof employee.name !== "string") {
    return <div className="p-6">Employee not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">{employee.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-500">{employee.role}</span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-500">{employee.department}</span>
            <StatusBadge status={employee.status} className="ml-2" />
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto border-b rounded-none h-auto p-0 bg-transparent">
          {["Profile", "Attendance", "Leaves", "Appraisals", "Grievances", "Documents"].map((tab) => (
            <TabsTrigger
              key={tab.toLowerCase()}
              value={tab.toLowerCase()}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              {tab}
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
                      <p className="text-sm">{employee.licenseExpiry ? new Date(employee.licenseExpiry).toLocaleDateString() : "N/A"}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No license information on file.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="attendance" className="mt-6">
          <Card>
            <CardContent className="pt-6 text-center text-gray-500 py-12">
              Attendance records will appear here.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appraisals" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Appraisals</CardTitle>
            </CardHeader>
            <CardContent>
              {appraisalsLoading ? (
                <p className="text-center text-gray-500 py-8">Loading appraisals…</p>
              ) : appraisalRows.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No appraisals on file for this employee.
                </p>
              ) : (
                <ul className="divide-y">
                  {appraisalRows.map((a) => {
                    const template = APPRAISAL_TEMPLATES[a.templateType];
                    const maxTotal = maxPossibleTotal(template);
                    return (
                      <li
                        key={a.id}
                        className="flex items-center justify-between py-3 gap-4"
                      >
                        <div>
                          <p className="font-medium">{a.appraisalType}</p>
                          <p className="text-sm text-gray-500">
                            {template.label} ·{" "}
                            {new Date(a.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-emerald-600 font-medium text-sm">
                            <Star className="h-4 w-4 fill-emerald-500" />
                            {a.totalScore}/{maxTotal}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setDetail(a)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Appraisal details</DialogTitle>
              <DialogDescription>
                {detail ? `${detail.appraisalType} — ${detail.appraisalPeriod}` : ""}
              </DialogDescription>
            </DialogHeader>
            {detail ? <AppraisalDetailView appraisal={detail} /> : null}
          </DialogContent>
        </Dialog>
      </Tabs>
    </div>
  );
}
