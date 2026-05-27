import { useParams, Link } from "wouter";
import {
  useGetJob,
  getGetJobQueryKey,
  useCreateApplicant,
} from "@workspace/api-client-react";
import type { Applicant, Job, Requirement, RequirementAnswer } from "@workspace/api-client-react";
import { FitScoreBar } from "@/components/fit-score-bar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Briefcase, ChevronRight, ArrowLeft } from "lucide-react";
import { LbdhCareersShell } from "@/components/careers/lbdh-careers-shell";
import { JobPostingPoster } from "@/components/careers/job-posting-poster";
import { LBDH_CAREERS } from "@/components/careers/lbdh-brand";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { isRecord } from "@/lib/api-guards";

export default function ApplyJob() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [submitted, setSubmitted] = useState<Applicant | null>(null);
  const [resumeText, setResumeText] = useState("");

  const { data: job, isLoading } = useGetJob(id, {
    query: { enabled: !!id, queryKey: getGetJobQueryKey(id) },
  });

  const createApplicant = useCreateApplicant();

  const jobData = job && isRecord(job) && typeof (job as Job).title === "string" ? (job as Job) : null;
  const requirementRows = useMemo(
    () => (jobData && Array.isArray(jobData.requirements) ? jobData.requirements : []),
    [jobData],
  );
  const [reqAnswers, setReqAnswers] = useState<Record<string, boolean | number>>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    if (!jobData) return;

    const answers: RequirementAnswer[] = requirementRows.map((req: Requirement) => {
      const value = reqAnswers[req.label];
      if (req.kind === "checkbox") {
        return { label: req.label, value: value === true };
      }
      return { label: req.label, value: typeof value === "number" ? value : 0 };
    });

    try {
      const row = await createApplicant.mutateAsync({
        data: {
          jobId: id,
          name: String(fd.get("name") ?? "").trim(),
          email: String(fd.get("email") ?? "").trim(),
          phone: String(fd.get("phone") ?? "").trim(),
          skills: String(fd.get("skills") ?? "").trim(),
          experience: String(fd.get("experience") ?? "").trim(),
          resume: (resumeText || String(fd.get("resume") ?? "")).trim(),
          answers,
        },
      });
      setSubmitted(row);
      toast.success("Application submitted successfully!", {
        description: `Your application ID is #${row.id}. HR will review your qualifications.`,
        duration: 8000,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Could not submit application. Please try again or contact HR.";
      toast.error("Submission failed", { description: msg, duration: 8000 });
    }
  };

  if (isLoading) {
    return (
      <LbdhCareersShell compactHeader>
        <p className="text-center text-gray-500 py-16">Loading position…</p>
      </LbdhCareersShell>
    );
  }

  if (!jobData) {
    return (
      <LbdhCareersShell compactHeader>
        <Card className="w-full text-center">
          <CardContent className="pt-6">
            <Briefcase className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Job Not Found</h2>
            <p className="text-gray-500 mb-4">This position may have been closed or removed.</p>
            <Button variant="outline" asChild>
              <Link href="/careers">Back to Careers</Link>
            </Button>
          </CardContent>
        </Card>
      </LbdhCareersShell>
    );
  }

  if (jobData.status !== "active") {
    return (
      <LbdhCareersShell compactHeader>
        <Card className="w-full text-center">
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Position Closed</h2>
            <p className="text-gray-500 mb-4">Applications are no longer accepted for this role.</p>
            <Button variant="outline" asChild>
              <Link href="/careers">View open positions</Link>
            </Button>
          </CardContent>
        </Card>
      </LbdhCareersShell>
    );
  }

  if (submitted) {
    return (
      <LbdhCareersShell compactHeader>
        <Card className="w-full border-emerald-200 bg-emerald-50/40 shadow-lg overflow-hidden">
          <CardContent className="pt-8 pb-8 px-6">
            <div
              role="status"
              aria-live="polite"
              className="rounded-lg border border-emerald-300 bg-emerald-100/80 px-4 py-3 mb-6 text-emerald-900 text-sm font-medium text-center"
            >
              Application submitted successfully — save your application ID below.
            </div>
            <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Application Received</h2>
            <p className="text-gray-600 mb-4 text-center">
              Thank you for applying for <strong>{jobData.title}</strong>.
            </p>
            <p className="text-sm font-mono bg-white border border-emerald-200 rounded-lg px-4 py-3 mb-6 text-center">
              Application ID: <span className="font-bold text-emerald-800">#{submitted.id}</span>
            </p>
            <div className="max-w-md mx-auto mb-6 rounded-lg border bg-white p-4">
              <FitScoreBar score={submitted.totalScore} size="lg" />
            </div>
            <p className="text-sm text-gray-500 text-center">
              This score is shared with HR to help review your fit for the role.
            </p>
            <Button className="mt-6 mx-auto block" variant="outline" asChild>
              <Link href="/careers">Back to Careers</Link>
            </Button>
          </CardContent>
        </Card>
      </LbdhCareersShell>
    );
  }

  return (
    <LbdhCareersShell compactHeader>
      <Button variant="ghost" size="sm" className="w-fit -mt-2" asChild>
        <Link href="/careers" className="text-[#0c1f4a]">
          <ArrowLeft className="h-4 w-4 mr-1" /> All open positions
        </Link>
      </Button>

      <JobPostingPoster job={jobData} showApplyButton={false} />

        <form onSubmit={handleSubmit}>
          <Card className="shadow-md overflow-hidden">
            <CardHeader className="bg-gray-50 border-b border-gray-100 pb-4">
              <CardTitle className="text-xl">Application Form</CardTitle>
              <CardDescription>No login required. Fields marked * are required.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-8">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b pb-2">
                  Contact Information
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" name="name" required placeholder="Jane Reyes" className="bg-white" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" name="email" type="email" required placeholder="jane@email.com" className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input id="phone" name="phone" type="tel" required placeholder="+63 912 345 6789" className="bg-white" />
                  </div>
                </div>
              </div>

              {requirementRows.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b pb-2">
                    Position Requirements
                  </h3>
                  <div className="space-y-5 bg-blue-50/50 p-5 rounded-lg border border-blue-100/50">
                    {requirementRows.map((req: Requirement, i: number) => (
                      <div key={req.label} className="flex flex-col gap-2">
                        {req.kind === "checkbox" ? (
                          <div className="flex items-center justify-between gap-4">
                            <Label htmlFor={`req-${i}`} className="font-medium text-gray-800 leading-snug cursor-pointer">
                              {req.label}
                            </Label>
                            <Switch
                              id={`req-${i}`}
                              checked={reqAnswers[req.label] === true}
                              onCheckedChange={(checked) =>
                                setReqAnswers((prev) => ({ ...prev, [req.label]: checked }))
                              }
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label htmlFor={`req-${i}`} className="font-medium text-gray-800">
                              {req.label}
                            </Label>
                            <div className="relative max-w-xs">
                              <Input
                                id={`req-${i}`}
                                type="number"
                                min={0}
                                max={req.max || undefined}
                                className="bg-white pr-12"
                                value={(() => {
                                  const v = reqAnswers[req.label];
                                  return typeof v === "number" ? v : "";
                                })()}
                                onChange={(e) =>
                                  setReqAnswers((prev) => ({
                                    ...prev,
                                    [req.label]: Number(e.target.value) || 0,
                                  }))
                                }
                              />
                              {req.max != null && (
                                <span className="absolute right-3 top-2.5 text-xs text-gray-400">/ {req.max}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b pb-2">
                  Professional Profile
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="skills">Skills *</Label>
                  <Textarea
                    id="skills"
                    name="skills"
                    required
                    placeholder="Certifications, specialties, technical skills…"
                    className="min-h-24 bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience">Experience *</Label>
                  <Textarea
                    id="experience"
                    name="experience"
                    required
                    placeholder="Previous hospital or clinical experience…"
                    className="min-h-24 bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resume">Resume / CV (text) *</Label>
                  <div className="flex flex-col gap-2">
                    <Input
                      id="resume-file"
                      type="file"
                      accept=".txt,text/plain"
                      className="bg-white"
                      onChange={(e) => {
                        const file = e.currentTarget.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setResumeText(String(reader.result ?? ""));
                        reader.onerror = () =>
                          toast.error("Could not read file", { description: "Please upload a plain .txt file." });
                        reader.readAsText(file);
                      }}
                    />
                    <p className="text-xs text-gray-500">
                      Tip: You can upload a plain <span className="font-mono">.txt</span> file or paste below.
                    </p>
                  </div>
                  <Textarea
                    id="resume"
                    name="resume"
                    required
                    placeholder="Paste your resume summary, education, licenses, and work history…"
                    className="min-h-32 bg-white font-mono text-sm"
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-gray-50 border-t border-gray-100 p-6">
              <Button
                type="submit"
                size="lg"
                className="w-full md:w-auto font-bold uppercase tracking-wide"
                style={{ backgroundColor: LBDH_CAREERS.navy }}
                disabled={createApplicant.isPending}
              >
                {createApplicant.isPending ? "Submitting…" : "Submit Application"}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </form>
    </LbdhCareersShell>
  );
}
