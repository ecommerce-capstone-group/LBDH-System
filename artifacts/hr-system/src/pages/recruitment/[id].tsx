import { useParams, Link } from "wouter";
import {
  useGetJob,
  getGetJobQueryKey,
  useListApplicants,
  getListApplicantsQueryKey,
} from "@workspace/api-client-react";
import type { Applicant, Job, Requirement, RequirementMatch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { FitScoreBar } from "@/components/fit-score-bar";
import { Check, X, Mail, Phone, RefreshCw } from "lucide-react";
import { asArray, isRecord } from "@/lib/api-guards";

export default function JobDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: job, isLoading: isLoadingJob } = useGetJob(id, {
    query: { enabled: !!id, queryKey: getGetJobQueryKey(id) },
  });

  const {
    data: applicants,
    isLoading: isLoadingApplicants,
    isFetching: isFetchingApplicants,
    refetch: refetchApplicants,
    isError: applicantsError,
  } = useListApplicants(
    { jobId: id },
    {
      query: {
        enabled: !!id,
        queryKey: getListApplicantsQueryKey({ jobId: id }),
        refetchOnMount: "always",
        staleTime: 0,
      },
    },
  );

  const applicantRows = asArray<Applicant>(applicants);

  if (isLoadingJob) return <div className="p-6">Loading job details...</div>;
  if (!job || !isRecord(job) || typeof job.title !== "string") {
    return <div className="p-6">Job not found.</div>;
  }

  const jobData = job as Job;
  const requirements = Array.isArray(jobData.requirements) ? jobData.requirements : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">{jobData.title}</h2>
            <StatusBadge status={jobData.status} />
          </div>
          <p className="text-gray-500">
            {jobData.department} • Posted {new Date(jobData.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          <Link href="/careers" target="_blank" className="font-medium text-primary hover:underline">
            Public /careers
          </Link>
          <Link href={`/apply/${jobData.id}`} target="_blank" className="text-gray-600 hover:underline">
            Direct apply link
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{jobData.description}</p>

          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-3">Requirements (scoring)</h4>
            <ul className="space-y-2">
              {requirements.map((req: Requirement, i: number) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                  <span>{req.label}</span>
                  <span className="ml-auto text-xs font-mono bg-white px-2 py-0.5 rounded border border-gray-200">
                    Weight: {req.weight ?? 0}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-tight text-gray-900 flex items-center gap-2">
            Applicants
            <span className="text-sm font-normal text-gray-500">({applicantRows.length})</span>
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetchingApplicants}
            onClick={() => refetchApplicants()}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetchingApplicants ? "animate-spin" : ""}`} />
            Refresh list
          </Button>
        </div>

        {applicantsError ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-6 text-sm text-red-800">
              Could not load applicants. The database may need updating — run{" "}
              <code className="text-xs bg-white px-1 rounded">pnpm db:push</code> with your Neon URL, then
              redeploy the API on Render.
            </CardContent>
          </Card>
        ) : isLoadingApplicants ? (
          <div className="text-center py-8 text-gray-500">Loading applicants...</div>
        ) : applicantRows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No applicants yet. Share the{" "}
              <Link href="/careers" className="text-primary underline">
                careers page
              </Link>{" "}
              or direct apply link.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {applicantRows.map((applicant) => (
              <Card key={applicant.id} className="overflow-hidden">
                <div className="flex flex-col lg:flex-row">
                  <div className="p-6 lg:w-2/5 border-b lg:border-b-0 lg:border-r border-gray-100 bg-gray-50/30 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-gray-900 text-lg">{applicant.name}</h4>
                      <span className="text-xs font-mono text-gray-500 shrink-0">ID #{applicant.id}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Applied {new Date(applicant.createdAt).toLocaleString()}
                    </p>
                    <div className="flex flex-col gap-1 text-sm text-gray-600">
                      <span className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" />
                        <a href={`mailto:${applicant.email}`} className="hover:underline">
                          {applicant.email}
                        </a>
                      </span>
                      <span className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5" />
                        {applicant.phone}
                      </span>
                    </div>
                    <div className="pt-2 rounded-lg border bg-white p-3">
                      <FitScoreBar score={applicant.totalScore} size="lg" />
                    </div>
                  </div>

                  <div className="p-6 lg:w-3/5 space-y-4">
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-1">Skills</h5>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{applicant.skills}</p>
                    </div>
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-1">Experience</h5>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{applicant.experience}</p>
                    </div>
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-1">Resume</h5>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded border">
                        {applicant.resume}
                      </p>
                    </div>
                    <div>
                      <h5 className="text-sm font-semibold mb-2 text-gray-700">Requirement Matches</h5>
                      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                        {asArray<RequirementMatch>(applicant.matches).map((match, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0"
                          >
                            <span className="text-gray-600 truncate pr-2" title={match.label}>
                              {match.label}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-xs">{match.score}%</span>
                              {match.value === true ? (
                                <Check className="h-4 w-4 text-emerald-500" />
                              ) : match.value === false ? (
                                <X className="h-4 w-4 text-red-500" />
                              ) : (
                                <span className="font-medium">{String(match.value)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
