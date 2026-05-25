import { Link } from "wouter";
import {
  useListJobs,
  getListJobsQueryKey,
  type Job,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HeartPulse, Briefcase, MapPin } from "lucide-react";
import { asArray } from "@/lib/api-guards";

export default function Careers() {
  const { data: jobs, isLoading, isError } = useListJobs(
    { status: "active" },
    { query: { queryKey: getListJobsQueryKey({ status: "active" }) } },
  );

  const rows = asArray<Job>(jobs);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white shadow-md mb-4">
            <HeartPulse className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Los Baños Doctors Hospital</h1>
          <p className="text-primary font-semibold tracking-wide uppercase text-sm mt-1">Careers</p>
          <p className="text-gray-600 mt-3 max-w-lg">
            Open positions posted by our HR team. Apply online — no account required.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        {isLoading && (
          <p className="text-center text-gray-500 py-12">Loading open positions…</p>
        )}

        {isError && (
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="py-8 text-center text-red-700">
              Could not load job postings. Please try again later.
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && rows.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Briefcase className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600 font-medium">No open positions right now.</p>
              <p className="text-sm text-gray-500 mt-2">Check back soon for new opportunities.</p>
            </CardContent>
          </Card>
        )}

        {rows.map((job) => (
          <Card key={job.id} className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl text-gray-900">{job.title}</CardTitle>
                  <CardDescription className="flex items-center gap-1.5 mt-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {job.department}
                  </CardDescription>
                </div>
                <span className="text-xs font-medium uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                  Open
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-700 line-clamp-4 whitespace-pre-wrap">{job.description}</p>
              <p className="text-xs text-gray-500">
                Posted {new Date(job.createdAt).toLocaleDateString()}
              </p>
              <Button asChild>
                <Link href={`/apply/${job.id}`}>Apply for this position</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </main>

      <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-500">
        Los Baños Doctors Hospital — Human Resources
      </footer>
    </div>
  );
}
