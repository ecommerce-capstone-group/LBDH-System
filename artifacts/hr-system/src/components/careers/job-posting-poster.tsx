import { Link } from "wouter";
import type { Job } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { descriptionToBullets } from "@/lib/description-bullets";
import { getPublicApplyUrl, getQrCodeImageUrl, LBDH_CAREERS } from "./lbdh-brand";

type JobPostingPosterProps = {
  job: Job;
  showApplyButton?: boolean;
};

export function JobPostingPoster({ job, showApplyButton = true }: JobPostingPosterProps) {
  const bullets = descriptionToBullets(job.description);
  const applyUrl = getPublicApplyUrl(job.id);
  const qrUrl = getQrCodeImageUrl(applyUrl, 180);

  return (
    <article
      className="overflow-hidden rounded-lg shadow-xl bg-white"
      style={{ border: `3px solid ${LBDH_CAREERS.navy}` }}
    >
      {/* Header — WE ARE HIRING */}
      <div
        className="relative px-5 pt-6 pb-8 text-white overflow-hidden"
        style={{
          background: `linear-gradient(120deg, ${LBDH_CAREERS.navy} 0%, ${LBDH_CAREERS.navyLight} 50%, #3d6db5 100%)`,
        }}
      >
        <div
          className="absolute -right-8 -top-8 h-40 w-40 rounded-full opacity-25 bg-white blur-2xl"
          aria-hidden
        />
        <div
          className="absolute right-4 top-4 h-24 w-32 rounded-lg opacity-15 bg-white"
          style={{ clipPath: "polygon(0 100%, 100% 0, 100% 100%)" }}
          aria-hidden
        />
        <p className="text-2xl md:text-3xl font-black tracking-tight leading-none">
          <span className="text-white">WE ARE </span>
          <span
            className="text-transparent"
            style={{
              WebkitTextStroke: "2px white",
            }}
          >
            HIRING
          </span>
        </p>
        <p className="mt-2 text-sky-200 italic text-lg font-light">Join our team</p>
        <p className="mt-4 text-[10px] uppercase tracking-widest text-sky-200/70">
          {job.department} • Posted {new Date(job.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Job title */}
      <div
        className="px-5 py-4 text-center"
        style={{ backgroundColor: LBDH_CAREERS.navy }}
      >
        <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-wide leading-snug">
          {job.title}
        </h2>
      </div>

      {/* Body — qualifications + QR */}
      <div className="px-5 py-6 bg-white">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          <div className="flex-1 min-w-0">
            {bullets.length > 0 ? (
              <ul className="space-y-2.5 text-sm text-gray-800 leading-relaxed list-disc pl-5 marker:text-[#0c1f4a]">
                {bullets.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.description}</p>
            )}
          </div>

          <div className="flex flex-col items-center shrink-0 md:w-44">
            <a
              href={applyUrl}
              className="block rounded-lg border-2 border-gray-200 p-2 bg-white shadow-sm hover:shadow-md transition-shadow"
              title="Scan to apply"
            >
              <img
                src={qrUrl}
                alt={`QR code to apply for ${job.title}`}
                width={180}
                height={180}
                className="h-auto w-full max-w-[180px]"
              />
            </a>
            <div
              className="mt-0 w-full text-center py-2 px-3 text-xs font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: LBDH_CAREERS.navy }}
            >
              Scan to apply
            </div>
          </div>
        </div>

        {showApplyButton && (
          <div className="mt-6 flex flex-wrap gap-3 justify-center border-t border-gray-100 pt-5">
            <Button
              asChild
              size="lg"
              className="font-bold uppercase tracking-wide"
              style={{ backgroundColor: LBDH_CAREERS.navy }}
            >
              <Link href={`/apply/${job.id}`}>Apply online</Link>
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
