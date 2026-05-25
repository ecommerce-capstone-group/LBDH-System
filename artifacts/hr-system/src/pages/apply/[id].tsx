import { useParams, Link } from "wouter";
import {
  useGetJob,
  getGetJobQueryKey,
  useCreateApplicant,
} from "@workspace/api-client-react";
import type { Job, Requirement, RequirementAnswer } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { HeartPulse, Briefcase, ChevronRight, ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { isRecord } from "@/lib/api-guards";

export default function ApplyJob() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [applicationId, setApplicationId] = useState<number | null>(null);

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
          resume: String(fd.get("resume") ?? "").trim(),
          answers,
        },
      });
      setApplicationId(row.id);
      toast.success("Application submitted.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not submit application.";
      toast.error(msg);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <HeartPulse className="h-12 w-12 text-primary mb-4" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!job || !isRecord(job) || typeof job.title !== "string") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <Briefcase className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Job Not Found</h2>
            <p className="text-gray-500 mb-4">This position may have been closed or removed.</p>
            <Button variant="outline" asChild>
              <Link href="/careers">Back to Careers</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!jobData) return null;

  if (jobData.status !== "active") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Position Closed</h2>
            <p className="text-gray-500 mb-4">Applications are no longer accepted for this role.</p>
            <Button variant="outline" asChild>
              <Link href="/careers">View open positions</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (applicationId !== null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center border-emerald-100 bg-emerald-50/30 shadow-lg">
          <CardContent className="pt-8 pb-8">
            <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Received</h2>
            <p className="text-gray-600 mb-4">
              Thank you for applying for <strong>{jobData.title}</strong>.
            </p>
            <p className="text-sm font-mono bg-white border border-emerald-200 rounded-lg px-4 py-3 mb-6">
              Application ID: <span className="font-bold text-emerald-800">#{applicationId}</span>
            </p>
            <p className="text-sm text-gray-500">Our HR team will review your application and contact you.</p>
            <Button className="mt-6" variant="outline" asChild>
              <Link href="/careers">Back to Careers</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex flex-col items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-md mb-4">
            <HeartPulse className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Los Baños Doctors Hospital</h1>
          <Button variant="link" className="mt-2 text-sm" asChild>
            <Link href="/careers">
              <ArrowLeft className="h-4 w-4 mr-1" /> All open positions
            </Link>
          </Button>
        </div>

        <Card className="border-t-4 border-t-primary shadow-md">
          <CardHeader className="bg-white pb-6 border-b border-gray-100">
            <span className="text-sm font-semibold text-primary tracking-wider uppercase">{jobData.department}</span>
            <CardTitle className="text-3xl font-extrabold text-gray-900 mt-2">{jobData.title}</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{jobData.description}</p>
          </CardContent>
        </Card>

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
                                value={typeof reqAnswers[req.label] === "number" ? reqAnswers[req.label] : ""}
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
                  <Textarea
                    id="resume"
                    name="resume"
                    required
                    placeholder="Paste your resume summary, education, licenses, and work history…"
                    className="min-h-32 bg-white font-mono text-sm"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-gray-50 border-t border-gray-100 p-6">
              <Button type="submit" size="lg" className="w-full md:w-auto font-semibold" disabled={createApplicant.isPending}>
                {createApplicant.isPending ? "Submitting…" : "Submit Application"}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  );
}
