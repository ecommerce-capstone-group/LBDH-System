import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  useUpdateOnboarding,
  customFetch,
} from "@workspace/api-client-react";
import type {
  Applicant,
  ApplicantInterview,
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

type InterviewStage =
  | "Initial Interview"
  | "Technical Assessment"
  | "Final / In-depth Interview";

const interviewStages: InterviewStage[] = [
  "Initial Interview",
  "Technical Assessment",
  "Final / In-depth Interview",
];

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
  const [medicalStatus, setMedicalStatus] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [medicalDocuments, setMedicalDocuments] = useState("");
  const [interviewStage, setInterviewStage] = useState<InterviewStage>("Initial Interview");
  const [interviewScheduledAt, setInterviewScheduledAt] = useState("");
  const [interviewInterviewer, setInterviewInterviewer] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [completingInterviewId, setCompletingInterviewId] = useState<number | null>(null);
  const [interviewResult, setInterviewResult] = useState("");
  const [interviewOutcome, setInterviewOutcome] = useState<"Passed" | "Failed" | null>(null);
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
  const updateOnboarding = useUpdateOnboarding();
  const createOnboarding = useCreateOnboarding();
  const interviewsQuery = useQuery({
    queryKey: ["/api/applicants", id, "interviews"],
    queryFn: () => customFetch<ApplicantInterview[]>(`/api/applicants/${id}/interviews`),
    enabled: Number.isInteger(id) && id > 0,
  });
  const createInterview = useMutation({
    mutationFn: (data: {
      stage: InterviewStage;
      scheduledAt: string;
      interviewer: string;
      notes: string;
    }) =>
      customFetch<ApplicantInterview>(`/api/applicants/${id}/interviews`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
  const completeInterview = useMutation({
    mutationFn: (data: { interviewId: number; result: string; outcome: "Passed" | "Failed" }) =>
      customFetch<ApplicantInterview>(
        `/api/applicants/${id}/interviews/${data.interviewId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ result: data.result, outcome: data.outcome }),
        },
      ),
  });

  useEffect(() => {
    if (applicant) {
      setSelectedStage(applicant.stage);
      setSelectedOutcome(applicant.stageOutcome ?? null);
      setRequirements(asArray<PreEmploymentRequirement>(applicant.preEmploymentRequirements));
    }
  }, [applicant]);

  useEffect(() => {
    if (onboarding) {
      setMedicalStatus(onboarding.medicalStatus ?? "");
      setMedicalNotes(onboarding.medicalNotes ?? "");
      setMedicalDocuments(onboarding.medicalDocuments ?? "");
    }
  }, [onboarding]);

  const refreshApplicantData = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetApplicantQueryKey(id) });
    await queryClient.invalidateQueries({ queryKey: getListApplicantsQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getListOnboardingsQueryKey({ applicantId: id }) });
  };

  const refreshInterviews = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/applicants", id, "interviews"] });
    await queryClient.invalidateQueries({ queryKey: getGetApplicantQueryKey(id) });
  };

  const scheduleInterview = async () => {
    if (!interviewScheduledAt || !interviewInterviewer.trim()) {
      toast.error("Set the interview date/time and interviewer or assessor.");
      return;
    }
    try {
      await createInterview.mutateAsync({
        stage: interviewStage,
        scheduledAt: new Date(interviewScheduledAt).toISOString(),
        interviewer: interviewInterviewer.trim(),
        notes: interviewNotes.trim(),
      });
      await refreshInterviews();
      setInterviewScheduledAt("");
      setInterviewInterviewer("");
      setInterviewNotes("");
      toast.success("Interview scheduled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not schedule interview.");
    }
  };

  const saveInterviewResult = async (interviewId: number) => {
    if (!interviewResult.trim() || !interviewOutcome) {
      toast.error("Enter the interview result and select Passed or Failed.");
      return;
    }
    try {
      await completeInterview.mutateAsync({
        interviewId,
        result: interviewResult.trim(),
        outcome: interviewOutcome,
      });
      await refreshInterviews();
      setCompletingInterviewId(null);
      setInterviewResult("");
      setInterviewOutcome(null);
      toast.success("Interview completed and saved to history.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete interview.");
    }
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

  const saveMedicalAssessment = async () => {
    if (!onboarding) return;
    try {
      await updateOnboarding.mutateAsync({
        id: onboarding.id,
        data: {
          medicalStatus: medicalStatus || null,
          medicalNotes: medicalNotes.trim(),
          medicalDocuments: medicalDocuments.trim(),
        },
      });
      await refreshApplicantData();
      toast.success("Medical assessment saved.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not save medical assessment.");
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
  const interviewRecords = asArray<ApplicantInterview>(interviewsQuery.data);
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
            <div className="mt-4 rounded-md border bg-gray-50 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Interview / assessment activity
              </h4>
              <ul className="mt-2 space-y-2">
                {interviewStages.map((stage) => {
                  const records = interviewRecords.filter((record) => record.stage === stage);
                  const latest = [...records].sort(
                    (left, right) =>
                      Date.parse(right.completedAt ?? right.scheduledAt) -
                      Date.parse(left.completedAt ?? left.scheduledAt),
                  )[0];
                  return (
                    <li key={stage} className="flex flex-wrap justify-between gap-x-3 text-xs">
                      <span className="text-gray-700">
                        {stage} · {records.length} record{records.length === 1 ? "" : "s"}
                      </span>
                      <span className="text-gray-500">
                        {latest
                          ? latest.outcome
                            ? `${latest.outcome} · ${new Date(latest.completedAt ?? latest.scheduledAt).toLocaleDateString()}`
                            : `Scheduled · ${new Date(latest.scheduledAt).toLocaleDateString()}`
                          : "No interview recorded"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
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

      <Section title="Interviews & Assessments" open>
        <div className="space-y-6">
          <p className="text-sm text-gray-600">
            Interview records are kept as history and do not change the applicant’s recruitment stage. HR controls
            recruitment progress separately above.
          </p>
          <div className="grid gap-4 rounded-lg border bg-gray-50 p-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="interview-stage" className="text-sm font-medium">Interview / assessment stage</label>
              <select
                id="interview-stage"
                className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                value={interviewStage}
                onChange={(event) => setInterviewStage(event.target.value as InterviewStage)}
              >
                {interviewStages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="interview-scheduled-at" className="text-sm font-medium">Scheduled date and time</label>
              <input
                id="interview-scheduled-at"
                type="datetime-local"
                className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                value={interviewScheduledAt}
                onChange={(event) => setInterviewScheduledAt(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="interview-interviewer" className="text-sm font-medium">Interviewer / assessor</label>
              <input
                id="interview-interviewer"
                className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                value={interviewInterviewer}
                onChange={(event) => setInterviewInterviewer(event.target.value)}
                placeholder="Name"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="interview-notes" className="text-sm font-medium">Notes / remarks</label>
              <textarea
                id="interview-notes"
                className="min-h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                rows={2}
                value={interviewNotes}
                onChange={(event) => setInterviewNotes(event.target.value)}
                placeholder="Optional notes for the scheduled interview"
              />
            </div>
            <div className="md:col-span-2">
              <Button
                type="button"
                disabled={createInterview.isPending}
                onClick={scheduleInterview}
              >
                {createInterview.isPending ? "Saving..." : "Schedule interview"}
              </Button>
            </div>
          </div>

          {interviewsQuery.isLoading ? (
            <p className="text-sm text-gray-500">Loading interview history...</p>
          ) : interviewsQuery.isError ? (
            <p role="alert" className="text-sm text-red-700">Could not load interview history.</p>
          ) : (
            <>
              {(["scheduled", "completed"] as const).map((status) => {
                const interviewRows = interviewRecords
                  .filter((record) => record.status === status)
                  .sort((left, right) =>
                    status === "scheduled"
                      ? Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt)
                      : Date.parse(right.completedAt ?? right.scheduledAt) -
                        Date.parse(left.completedAt ?? left.scheduledAt),
                  );
                return (
                  <div key={status} className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {status === "scheduled" ? "Upcoming / Scheduled" : "Completed interview history"}
                    </h3>
                    {interviewRows.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        {status === "scheduled" ? "No upcoming interviews." : "No completed interviews yet."}
                      </p>
                    ) : (
                      <ol className="space-y-3">
                        {interviewRows.map((record) => (
                          <li key={record.id} className="rounded-lg border p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h4 className="font-medium text-gray-900">{record.stage}</h4>
                                <p className="mt-1 text-sm text-gray-600">
                                  {status === "scheduled" ? "Scheduled" : "Interview date"}:{" "}
                                  {new Date(record.scheduledAt).toLocaleString()}
                                </p>
                                <p className="text-sm text-gray-600">Interviewer / assessor: {record.interviewer}</p>
                                {record.completedAt ? (
                                  <p className="text-sm text-gray-600">
                                    Completed: {new Date(record.completedAt).toLocaleString()}
                                  </p>
                                ) : null}
                              </div>
                              {record.outcome ? (
                                <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                                  record.outcome === "Passed" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                }`}>
                                  {record.outcome}
                                </span>
                              ) : status === "scheduled" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setCompletingInterviewId(record.id);
                                    setInterviewResult("");
                                    setInterviewOutcome(null);
                                  }}
                                >
                                  Complete interview
                                </Button>
                              ) : null}
                            </div>
                            {record.notes ? (
                              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                                <span className="font-medium">Notes: </span>{record.notes}
                              </p>
                            ) : null}
                            {record.result ? (
                              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                                <span className="font-medium">Result / remarks: </span>{record.result}
                              </p>
                            ) : null}
                            {completingInterviewId === record.id ? (
                              <div className="mt-4 space-y-3 border-t pt-4">
                                <div className="grid gap-2">
                                  <label htmlFor={`interview-result-${record.id}`} className="text-sm font-medium">
                                    Result / remarks
                                  </label>
                                  <textarea
                                    id={`interview-result-${record.id}`}
                                    className="min-h-20 rounded-md border border-input px-3 py-2 text-sm"
                                    rows={3}
                                    value={interviewResult}
                                    onChange={(event) => setInterviewResult(event.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">Assessment outcome</p>
                                  <div className="flex gap-2">
                                    {(["Passed", "Failed"] as const).map((outcome) => (
                                      <Button
                                        key={outcome}
                                        type="button"
                                        variant={interviewOutcome === outcome ? "default" : "outline"}
                                        aria-pressed={interviewOutcome === outcome}
                                        onClick={() => setInterviewOutcome(outcome)}
                                      >
                                        {outcome}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    disabled={completeInterview.isPending}
                                    onClick={() => saveInterviewResult(record.id)}
                                  >
                                    {completeInterview.isPending ? "Saving..." : "Save completed interview"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setCompletingInterviewId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                );
              })}
            </>
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

      <Section title="Medical / Physical Exam">
        {onboarding ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Assessment status does not change the applicant's recruitment status. Progress to Fit to Work requires a Fit to Work result and completed Medical and Physical checklist items.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="applicant-medical-status" className="text-sm font-medium">Assessment status</label>
                <select
                  id="applicant-medical-status"
                  className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                  value={medicalStatus}
                  onChange={(event) => setMedicalStatus(event.target.value)}
                >
                  <option value="">Not recorded</option>
                  <option value="For Physical Exam">For Physical Exam</option>
                  <option value="Fit to Work">Fit to Work</option>
                  <option value="Not Fit">Not Fit</option>
                </select>
              </div>
              {onboarding.medicalUpdatedAt ? (
                <p className="self-end text-sm text-gray-500">
                  Last updated: {new Date(onboarding.medicalUpdatedAt).toLocaleString()}
                </p>
              ) : null}
              <div className="grid gap-2 md:col-span-2">
                <label htmlFor="applicant-medical-notes" className="text-sm font-medium">Medical notes / relevant information</label>
                <textarea
                  id="applicant-medical-notes"
                  className="min-h-20 rounded-md border border-input bg-white px-3 py-2 text-sm"
                  rows={3}
                  value={medicalNotes}
                  onChange={(event) => setMedicalNotes(event.target.value)}
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <label htmlFor="applicant-medical-documents" className="text-sm font-medium">Document names or secure references</label>
                <textarea
                  id="applicant-medical-documents"
                  className="min-h-16 rounded-md border border-input bg-white px-3 py-2 text-sm"
                  rows={2}
                  value={medicalDocuments}
                  onChange={(event) => setMedicalDocuments(event.target.value)}
                  placeholder="Record document names or an existing secure reference"
                />
                <p className="text-xs text-gray-500">
                  The system records references only; it does not upload or store medical files.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" disabled={updateOnboarding.isPending} onClick={saveMedicalAssessment}>
                {updateOnboarding.isPending ? "Saving..." : "Save medical assessment"}
              </Button>
              <span className="text-sm text-gray-500">Onboarding progress: {onboarding.progressStage}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Start onboarding after the offer is accepted to record medical and physical assessment details.
          </p>
        )}
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
