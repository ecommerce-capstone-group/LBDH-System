import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import {
  getGetJobQueryKey,
  getGetApplicantQueryKey,
  getListApplicantsQueryKey,
  getListOnboardingsQueryKey,
  useCreateOnboarding,
  useGetApplicant,
  useGetJob,
  useListOnboardings,
  useUpdateApplicant,
} from "@workspace/api-client-react";
import type {
  Applicant,
  ApplicantRecruitmentHistory,
  Job,
  Onboarding,
  PreEmploymentRequirement,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { asArray, isRecord } from "@/lib/api-guards";

const recruitmentStages = [
  "Onboarded",
  "On-going Pre-Employment",
  "For Initial Interview",
  "For Final Interview",
  "For Job Offering",
  "Withdraw Application",
  "No Show",
] as const;
const systemManagedStages = new Set([
  "On-going Pre-Employment",
  "Onboarded",
]);
const outcomesByStage: Record<string, string[]> = {
  "For Initial Interview": ["Passed", "Not Passed"],
  "For Final Interview": ["Passed", "Not Passed"],
  "For Job Offering": ["Accepted Offer", "Declined Offer"],
};

function Section({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="rounded-lg border bg-white">
      <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-gray-900 marker:hidden">
        {title}
      </summary>
      <div className="border-t px-5 py-4">{children}</div>
    </details>
  );
}

export default function ApplicantDetail() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<PreEmploymentRequirement[]>([]);
  const applicantQuery = useGetApplicant(id, {
    query: { enabled: Number.isFinite(id) && id > 0, queryKey: getGetApplicantQueryKey(id) },
  });
  const applicant = applicantQuery.data as Applicant | undefined;
  const jobQuery = useGetJob(applicant?.jobId ?? 0, {
    query: {
      enabled: !!applicant?.jobId,
      queryKey: getGetJobQueryKey(applicant?.jobId ?? 0),
    },
  });
  const job = jobQuery.data as Job | undefined;
  const onboardingQuery = useListOnboardings(
    { applicantId: id },
    { query: { enabled: Number.isFinite(id) && id > 0, queryKey: getListOnboardingsQueryKey({ applicantId: id }) } },
  );
  const onboarding = asArray<Onboarding>(onboardingQuery.data)[0];
  const updateApplicant = useUpdateApplicant();
  const createOnboarding = useCreateOnboarding();

  useEffect(() => {
    if (applicant) {
      setSelectedStage(applicant.stage);
      setSelectedOutcome(applicant.stageOutcome ?? null);
      setRequirements(asArray<PreEmploymentRequirement>(applicant.preEmploymentRequirements));
    }
  }, [applicant]);

  const refreshApplicantData = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetApplicantQueryKey(id) });
    await queryClient.invalidateQueries({ queryKey: getListApplicantsQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getListOnboardingsQueryKey({ applicantId: id }) });
  };

  const saveStage = async () => {
    try {
      await updateApplicant.mutateAsync({
        id,
        data: { stage: selectedStage, stageOutcome: selectedOutcome },
      });
      await refreshApplicantData();
      toast.success("Recruitment stage updated.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not update recruitment stage.");
    }
  };

  const saveRequirement = async (label: string, done: boolean) => {
    const nextRequirements = requirements.map((item) => (item.label === label ? { ...item, done } : item));
    setRequirements(nextRequirements);
    try {
      await updateApplicant.mutateAsync({ id, data: { preEmploymentRequirements: nextRequirements } });
      await refreshApplicantData();
    } catch (error: unknown) {
      setRequirements(asArray<PreEmploymentRequirement>(applicant?.preEmploymentRequirements));
      toast.error(error instanceof Error ? error.message : "Could not update the document checklist.");
    }
  };

  const startOnboarding = async () => {
    try {
      await createOnboarding.mutateAsync({ data: { applicantId: id } });
      await refreshApplicantData();
      toast.success("Applicant linked to onboarding.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not start onboarding.");
    }
  };

  if (applicantQuery.isLoading) return <p className="p-6 text-gray-500">Loading applicant details...</p>;
  if (applicantQuery.isError || !applicant || !isRecord(applicant)) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8">
          <p role="alert" className="text-red-700">Applicant details could not be loaded.</p>
          <Button variant="outline" asChild><Link href="/applicant-monitoring">Back to Applicant Monitoring</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const history = asArray<ApplicantRecruitmentHistory>(applicant.recruitmentHistory);
  const completedStages = new Set(history.map((entry) => entry.stage));
  const matches = asArray(applicant.matches);
  const evaluations = isRecord(applicant.aiEvaluation) ? applicant.aiEvaluation : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-3" asChild>
            <Link href="/applicant-monitoring">← Applicant Monitoring</Link>
          </Button>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">{applicant.name}</h2>
          <p className="text-sm text-gray-500">
            {job?.title || "Position unavailable"} · {job?.unit || "Unit not specified"} · {job?.department || "Department not specified"}
          </p>
        </div>
        <div className="rounded-lg border bg-blue-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Current recruitment stage</p>
          <p className="mt-1 font-semibold text-blue-950">
            {applicant.stage}{applicant.stageOutcome ? ` — ${applicant.stageOutcome}` : ""}
          </p>
        </div>
      </div>

      <Section title="Recruitment Progress" open>
        <div className="grid gap-5 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Last updated {new Date(applicant.stageUpdatedAt).toLocaleString()}
            </p>
            <Select
              value={selectedStage}
              onValueChange={(stage) => {
                setSelectedStage(stage);
                if (stage !== selectedStage) setSelectedOutcome(null);
              }}
            >
              <SelectTrigger aria-label="Select current recruitment stage">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {recruitmentStages
                  .filter((stage) => !systemManagedStages.has(stage))
                  .map((stage) => (
                    <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {outcomesByStage[selectedStage] ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  {selectedStage === "For Job Offering" ? "Offer decision" : "Interview result"}
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label={`${selectedStage} outcome`}>
                  {outcomesByStage[selectedStage]!.map((outcome) => (
                    <Button
                      key={outcome}
                      type="button"
                      variant={selectedOutcome === outcome ? "default" : "outline"}
                      aria-pressed={selectedOutcome === outcome}
                      onClick={() => setSelectedOutcome(outcome)}
                    >
                      {outcome}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            <Button
              type="button"
              disabled={
                updateApplicant.isPending ||
                (selectedStage === applicant.stage &&
                  selectedOutcome === (applicant.stageOutcome ?? null))
              }
              onClick={saveStage}
            >
              {updateApplicant.isPending ? "Saving..." : "Update stage"}
            </Button>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Stage tracker</h3>
            <ol className="grid gap-2 sm:grid-cols-2">
              {recruitmentStages.map((stage) => {
                const current = stage === applicant.stage;
                const completed = completedStages.has(stage) && !current;
                return (
                  <li
                    key={stage}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      current ? "border-blue-300 bg-blue-50 font-semibold text-blue-900" :
                      completed ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "text-gray-500"
                    }`}
                  >
                    <span aria-hidden="true" className="mr-2">{current ? "●" : completed ? "✓" : "○"}</span>
                    {stage}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
        <div className="mt-6 border-t pt-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Recruitment history</h3>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">No recruitment history recorded.</p>
          ) : (
            <ol className="space-y-3">
              {[...history].reverse().map((entry) => (
                <li key={entry.id} className="border-l-2 border-blue-200 pl-4">
                  <p className="text-sm font-medium text-gray-900">
                    {entry.stage}{entry.stageOutcome ? ` — ${entry.stageOutcome}` : ""}
                  </p>
                  <p className="text-xs text-gray-500">
                    {entry.previousStage ? `From ${entry.previousStage} · ` : "Application received · "}
                    {new Date(entry.changedAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Section>

      <Section title="Applicant Information" open>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500">Position</dt><dd className="font-medium">{job?.title || "—"}</dd></div>
          <div><dt className="text-gray-500">Unit</dt><dd className="font-medium">{job?.unit || "—"}</dd></div>
          <div><dt className="text-gray-500">Department</dt><dd className="font-medium">{job?.department || "—"}</dd></div>
          <div><dt className="text-gray-500">Contact number</dt><dd className="font-medium">{applicant.phone || "—"}</dd></div>
          <div><dt className="text-gray-500">Email</dt><dd className="font-medium break-all">{applicant.email || "—"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-gray-500">Address</dt><dd className="font-medium">{applicant.address || "—"}</dd></div>
          <div><dt className="text-gray-500">Applied</dt><dd className="font-medium">{new Date(applicant.createdAt).toLocaleString()}</dd></div>
        </dl>
      </Section>

      <Section title="Pre-Employment Requirements Checklist">
        <p className="mb-4 text-sm text-gray-500">
          Checklist updates are shared with the applicant’s onboarding record.
        </p>
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {requirements.map((item) => (
            <label key={item.label} className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={item.done}
                disabled={updateApplicant.isPending}
                onCheckedChange={(checked) => saveRequirement(item.label, checked === true)}
              />
              <span className={item.done ? "text-gray-500 line-through" : "text-gray-800"}>{item.label}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Professional Profile">
        <div className="grid gap-4 md:grid-cols-2">
          <div><h3 className="mb-1 text-sm font-semibold">Skills</h3><p className="whitespace-pre-wrap text-sm text-gray-700">{applicant.skills || "—"}</p></div>
          <div><h3 className="mb-1 text-sm font-semibold">Experience</h3><p className="whitespace-pre-wrap text-sm text-gray-700">{applicant.experience || "—"}</p></div>
          <div className="md:col-span-2"><h3 className="mb-1 text-sm font-semibold">Resume / CV</h3><p className="whitespace-pre-wrap text-sm text-gray-700">{applicant.resume || "—"}</p></div>
        </div>
      </Section>

      <Section title="Application Evaluation">
        <div className="space-y-4 text-sm">
          <p>Application qualification score: <strong>{applicant.totalScore}%</strong></p>
          {matches.map((match, index) => {
            const item = isRecord(match) ? match : {};
            return <p key={`${String(item.label)}-${index}`} className="border-b pb-2">{String(item.label ?? "Requirement")}: {String(item.value ?? "—")}</p>;
          })}
          {evaluations && typeof evaluations.summary === "string" ? (
            <p className="whitespace-pre-wrap text-gray-700">{evaluations.summary}</p>
          ) : null}
        </div>
      </Section>

      <Card>
        <CardHeader><CardTitle className="text-base">Onboarding</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          {onboarding ? (
            <>
              <p className="text-sm text-gray-600">
                Linked onboarding: <strong>{onboarding.progressStage}</strong> · Status: <strong>{onboarding.status}</strong>
              </p>
              <Button variant="outline" asChild><Link href="/onboarding">Open onboarding</Link></Button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                {applicant.stage === "For Job Offering" && applicant.stageOutcome === "Accepted Offer"
                  ? "The applicant accepted the offer. Start pre-employment requirements to continue."
                  : "Start onboarding after the applicant has accepted the job offer."}
              </p>
              {applicant.stage === "For Job Offering" && applicant.stageOutcome === "Accepted Offer" ? (
                <Button type="button" disabled={createOnboarding.isPending} onClick={startOnboarding}>
                  {createOnboarding.isPending ? "Starting..." : "Start pre-employment requirements"}
                </Button>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
