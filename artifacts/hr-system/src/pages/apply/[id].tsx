import { useParams } from "wouter";
import { useGetJob, getGetJobQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { HeartPulse, Briefcase, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Job } from "@workspace/api-client-react";
import { isRecord } from "@/lib/api-guards";

export default function ApplyJob() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [submitted, setSubmitted] = useState(false);

  const { data: job, isLoading } = useGetJob(id, {
    query: { enabled: !!id, queryKey: getGetJobQueryKey(id) }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Would normally call useCreateApplicant here
    setSubmitted(true);
    toast.success("Application submitted successfully!");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <HeartPulse className="h-12 w-12 text-primary mb-4" />
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
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
            <p className="text-gray-500">The position you're looking for may have been closed or removed.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const jobData = job as Job;
  const requirementRows = Array.isArray(jobData.requirements) ? jobData.requirements : [];

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center border-emerald-100 bg-emerald-50/30 shadow-lg shadow-emerald-100/50">
          <CardContent className="pt-8 pb-8">
            <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Received</h2>
            <p className="text-gray-600 mb-6">Thank you for applying for the <strong>{jobData.title}</strong> position. Our HR team will review your qualifications and get in touch soon.</p>
            <p className="text-sm text-gray-500 font-medium">Los Banos Doctors Hospital HR</p>
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
          <h1 className="text-xl font-bold text-gray-900">Los Banos Doctors Hospital</h1>
        </div>

        <Card className="border-t-4 border-t-primary shadow-md">
          <CardHeader className="bg-white pb-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-primary tracking-wider uppercase">{jobData.department}</span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full font-medium">Full Time</span>
            </div>
            <CardTitle className="text-3xl font-extrabold text-gray-900">{jobData.title}</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="prose prose-sm max-w-none text-gray-700">
              <p className="whitespace-pre-wrap">{jobData.description}</p>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit}>
          <Card className="shadow-md overflow-hidden">
            <CardHeader className="bg-gray-50 border-b border-gray-100 pb-4">
              <CardTitle className="text-xl">Application Form</CardTitle>
              <CardDescription>Please complete all fields carefully.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-8">
              
              {/* Personal Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b pb-2">Personal Information</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" required placeholder="Dr. Jane Doe" className="bg-white" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" type="email" required placeholder="jane.doe@example.com" className="bg-white" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" type="tel" required placeholder="+63 912 345 6789" className="bg-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Requirements */}
              {requirementRows.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b pb-2">Position Requirements</h3>
                  <div className="space-y-5 bg-blue-50/50 p-5 rounded-lg border border-blue-100/50">
                    {requirementRows.map((req: any, i: number) => (
                      <div key={i} className="flex flex-col gap-2">
                        {req.kind === "checkbox" ? (
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`req-${i}`} className="font-medium text-gray-800 leading-snug pr-4 cursor-pointer">{req.label}</Label>
                            <Switch id={`req-${i}`} required />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label htmlFor={`req-${i}`} className="font-medium text-gray-800">{req.label}</Label>
                            <div className="relative max-w-xs">
                              <Input id={`req-${i}`} type="number" required max={req.max || undefined} className="bg-white pr-12" />
                              {req.max && <span className="absolute right-3 top-2.5 text-xs text-gray-400">/ {req.max}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resume & Profile */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b pb-2">Professional Profile</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="skills">Key Skills & Certifications</Label>
                    <Textarea id="skills" required placeholder="List your medical certifications, specialties, and relevant technical skills..." className="min-h-24 bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="experience">Work Experience Summary</Label>
                    <Textarea id="experience" required placeholder="Briefly describe your previous clinical or hospital experience..." className="min-h-24 bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="resume">Resume / CV Link</Label>
                    <Input id="resume" type="url" required placeholder="https://linkedin.com/in/... or Google Drive link" className="bg-white" />
                    <p className="text-xs text-gray-500">Provide a link to your hosted resume.</p>
                  </div>
                </div>
              </div>

            </CardContent>
            <CardFooter className="bg-gray-50 border-t border-gray-100 p-6">
              <Button type="submit" size="lg" className="w-full md:w-auto font-semibold">
                Submit Application <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </form>

      </div>
    </div>
  );
}
