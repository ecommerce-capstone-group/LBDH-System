import { Link } from "wouter";
import {
  useListJobs,
  getListJobsQueryKey,
  type Job,
} from "@workspace/api-client-react";
import { Briefcase } from "lucide-react";
import { asArray } from "@/lib/api-guards";
import { LbdhCareersShell } from "@/components/careers/lbdh-careers-shell";
import { JobPostingPoster } from "@/components/careers/job-posting-poster";
import { LBDH_CAREERS } from "@/components/careers/lbdh-brand";

export default function Careers() {
  const { data: jobs, isLoading, isError } = useListJobs(
    { status: "active" },
    { query: { queryKey: getListJobsQueryKey({ status: "active" }) } },
  );

  const rows = asArray<Job>(jobs);

  return (
    <LbdhCareersShell>
      <div
        className="text-center rounded-lg px-4 py-5 text-white shadow-md"
        style={{
          background: `linear-gradient(135deg, ${LBDH_CAREERS.navy} 0%, ${LBDH_CAREERS.navyLight} 100%)`,
        }}
      >
        <p className="text-3xl md:text-4xl font-black tracking-tight">
          <span>WE ARE </span>
          <span className="text-transparent" style={{ WebkitTextStroke: "2px white" }}>
            HIRING
          </span>
        </p>
        <p className="mt-2 italic text-sky-200 text-lg">Join our team</p>
        <p className="mt-3 text-sm text-sky-100/90 max-w-md mx-auto">
          Current openings from {LBDH_CAREERS.hospitalName} Human Resources — same posts you see on
          LBDH Careers.
        </p>
      </div>

      {isLoading && (
        <p className="text-center text-gray-500 py-12">Loading open positions…</p>
      )}

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center text-red-700">
          Could not load job postings. Please try again later.
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="rounded-lg border bg-white px-4 py-12 text-center shadow-sm">
          <Briefcase className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600 font-medium">No open positions right now.</p>
          <p className="text-sm text-gray-500 mt-2">Check back soon or follow LBDH Careers on Facebook.</p>
        </div>
      )}

      {rows.map((job) => (
        <JobPostingPoster key={job.id} job={job} />
      ))}

      <p className="text-center text-xs text-gray-500 pb-4">
        HR staff: post jobs in{" "}
        <Link href="/recruitment" className="text-[#0c1f4a] underline font-medium">
          Recruitment
        </Link>
        . Use one qualification per line in the description for poster-style bullets.
      </p>
    </LbdhCareersShell>
  );
}
