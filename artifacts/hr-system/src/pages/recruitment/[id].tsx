import { useParams, Link } from "wouter";
import { useGetJob, getGetJobQueryKey, useListApplicants, getListApplicantsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { Check, X } from "lucide-react";

export default function JobDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: job, isLoading: isLoadingJob } = useGetJob(id, {
    query: { enabled: !!id, queryKey: getGetJobQueryKey(id) }
  });

  const { data: applicants, isLoading: isLoadingApplicants } = useListApplicants(
    { jobId: id },
    { query: { enabled: !!id, queryKey: getListApplicantsQueryKey({ jobId: id }) } }
  );

  if (isLoadingJob) return <div className="p-6">Loading job details...</div>;
  if (!job) return <div className="p-6">Job not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">{job.title}</h2>
            <StatusBadge status={job.status} />
          </div>
          <p className="text-gray-500">{job.department} • Posted {new Date(job.createdAt).toLocaleDateString()}</p>
        </div>
        <Link href={`/apply/${job.id}`} target="_blank" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
          Public Link
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.description}</p>
          
          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-3">Requirements</h4>
            <ul className="space-y-2">
              {job.requirements.map((req, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/50"></div>
                  <span>{req.label}</span>
                  <span className="ml-auto text-xs font-mono bg-white px-2 py-0.5 rounded border border-gray-200">Weight: {req.weight}%</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight text-gray-900 flex items-center gap-2">
          Applicants <StatusBadge status={applicants?.length.toString() || "0"} className="bg-gray-100 text-gray-800" />
        </h3>

        {isLoadingApplicants ? (
          <div className="text-center py-8 text-gray-500">Loading applicants...</div>
        ) : applicants?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No applicants yet for this position.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {applicants?.map((applicant) => (
              <Card key={applicant.id} className="overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  <div className="p-6 md:w-1/3 border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50/30">
                    <h4 className="font-bold text-gray-900 text-lg">{applicant.name}</h4>
                    <p className="text-xs text-gray-500 mb-4">Applied {new Date(applicant.createdAt).toLocaleDateString()}</p>
                    
                    <div className="space-y-1 mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">Match Score</span>
                        <span className="font-bold text-primary">{Math.round(applicant.totalScore)}%</span>
                      </div>
                      <Progress value={applicant.totalScore} className="h-2" />
                    </div>
                  </div>
                  
                  <div className="p-6 md:w-2/3">
                    <h5 className="text-sm font-semibold mb-3 text-gray-700">Requirement Matches</h5>
                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                      {applicant.matches.map((match, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                          <span className="text-gray-600 truncate pr-2" title={match.label}>{match.label}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-xs">{match.score}%</span>
                            {match.value === true ? (
                              <Check className="h-4 w-4 text-emerald-500" />
                            ) : match.value === false ? (
                              <X className="h-4 w-4 text-red-500" />
                            ) : (
                              <span className="font-medium">{match.value}</span>
                            )}
                          </div>
                        </div>
                      ))}
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
