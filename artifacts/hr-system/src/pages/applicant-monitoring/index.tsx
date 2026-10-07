import { useListApplicants, useListJobs } from "@workspace/api-client-react";
import type { Applicant, Job } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { asArray } from "@/lib/api-guards";
import { ReportDateTools } from "@/components/report-date-tools";

export default function ApplicantMonitoring() {
  const {
    data: applicants,
    isLoading: applicantsLoading,
    isError: applicantsError,
  } = useListApplicants();
  const { data: jobs, isLoading: jobsLoading, isError: jobsError } = useListJobs();

  const applicantsRows = asArray<Applicant>(applicants);
  const jobById = new Map(asArray<Job>(jobs).map((job) => [job.id, job]));
  const isLoading = applicantsLoading || jobsLoading;
  const hasError = applicantsError || jobsError;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Applicant Monitoring</h2>
        <p className="text-gray-500">Track applicant details, recruitment stages, and pre-employment requirements.</p>
      </div>

      <ReportDateTools
        title="Applicant Recruitment Report"
        records={applicantsRows}
        dateOf={(applicant) => applicant.createdAt}
        columns={[
          { header: "Applicant", value: (applicant) => applicant.name },
          { header: "Position", value: (applicant) => jobById.get(applicant.jobId)?.title },
          { header: "Unit", value: (applicant) => jobById.get(applicant.jobId)?.unit },
          { header: "Department", value: (applicant) => jobById.get(applicant.jobId)?.department },
          { header: "Contact number", value: (applicant) => applicant.phone },
          { header: "Address", value: (applicant) => applicant.address },
          { header: "Applicant status", value: (applicant) => `${applicant.stage}${applicant.stageOutcome ? ` - ${applicant.stageOutcome}` : ""}` },
          { header: "Applied on", value: (applicant) => applicant.createdAt },
        ]}
      >
        {(reportRows) => (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Applicants <span className="font-normal text-gray-500">({reportRows.length})</span></CardTitle>
            </CardHeader>
            <CardContent>
              {hasError ? (
                <p role="alert" className="py-8 text-center text-sm text-red-700">
                  Could not load applicant monitoring data. Refresh the page or contact your system administrator.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Applicant Name</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Contact Number</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Applicant Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-gray-500">Loading applicants...</TableCell>
                        </TableRow>
                      ) : reportRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-gray-500">No applicants for this period.</TableCell>
                        </TableRow>
                      ) : (
                        reportRows.map((applicant) => {
                          const job = jobById.get(applicant.jobId);
                          return (
                            <TableRow key={applicant.id}>
                              <TableCell className="max-w-48 font-medium">
                                <Link className="text-primary hover:underline" href={`/applicant-monitoring/${applicant.id}`}>
                                  {applicant.name}
                                </Link>
                              </TableCell>
                              <TableCell>{job?.title || "Position unavailable"}</TableCell>
                              <TableCell>{job?.unit || "—"}</TableCell>
                              <TableCell>{job?.department || "—"}</TableCell>
                              <TableCell className="whitespace-nowrap">{applicant.phone || "—"}</TableCell>
                              <TableCell className="max-w-56 truncate" title={applicant.address}>
                                {applicant.address || "—"}
                              </TableCell>
                              <TableCell>
                                <span className="inline-flex max-w-56 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
                                  <span>
                                    {applicant.stage}
                                    {applicant.stageOutcome ? (
                                      <span className="mt-0.5 block font-normal">{applicant.stageOutcome}</span>
                                    ) : null}
                                  </span>
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </ReportDateTools>
    </div>
  );
}
