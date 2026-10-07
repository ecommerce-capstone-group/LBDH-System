import { Router, type IRouter } from "express";
import {
  db,
  applicants,
  applicantInterviews,
  applicantRecruitmentHistory,
  jobs,
  onboardings,
  pool,
  APPLICANT_RECRUITMENT_STAGES,
  DEFAULT_PRE_EMPLOYMENT_REQUIREMENTS,
  APPLICANT_INTERVIEW_STAGES,
} from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { CreateApplicantBody, UpdateApplicantBody } from "@workspace/api-zod";
import type {
  ApplicantAiEvaluation,
  PreEmploymentRequirement,
  Requirement,
  RequirementMatch,
} from "@workspace/db";

const router: IRouter = Router();

const GEMINI_DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const validStages = new Set<string>(APPLICANT_RECRUITMENT_STAGES);
const systemManagedStages = new Set([
  "On-going Pre-Employment",
  "Onboarded",
]);
const stageOutcomes: Record<string, string[]> = {
  "For Initial Interview": ["Passed", "Not Passed"],
  "For Final Interview": ["Passed", "Not Passed"],
  "For Job Offering": ["Accepted Offer", "Declined Offer"],
};
const requirementLabels = new Set(DEFAULT_PRE_EMPLOYMENT_REQUIREMENTS.map((item) => item.label));

let monitoringSchemaReady: Promise<void> | null = null;

export function ensureApplicantMonitoringSchema(): Promise<void> {
  if (!monitoringSchemaReady) {
    monitoringSchemaReady = pool
      .query(`
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT '';
        ALTER TABLE applicants ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';
        ALTER TABLE applicants ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'For Initial Interview';
        ALTER TABLE applicants ADD COLUMN IF NOT EXISTS stage_outcome text;
        ALTER TABLE applicants ADD COLUMN IF NOT EXISTS stage_updated_at timestamptz NOT NULL DEFAULT now();
        ALTER TABLE applicants ADD COLUMN IF NOT EXISTS pre_employment_requirements jsonb NOT NULL DEFAULT '[]'::jsonb;
        ALTER TABLE onboardings ADD COLUMN IF NOT EXISTS starting_date date;
        ALTER TABLE onboardings ADD COLUMN IF NOT EXISTS progress_stage text NOT NULL DEFAULT 'Pre-Employment Requirements';
        CREATE TABLE IF NOT EXISTS applicant_interviews (
          id serial PRIMARY KEY,
          applicant_id integer NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
          stage text NOT NULL,
          scheduled_at timestamptz NOT NULL,
          interviewer text NOT NULL,
          notes text NOT NULL DEFAULT '',
          result text,
          outcome text,
          status text NOT NULL DEFAULT 'scheduled',
          completed_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS applicant_recruitment_history (
          id serial PRIMARY KEY,
          applicant_id integer NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
          previous_stage text,
          stage text NOT NULL,
          changed_at timestamptz NOT NULL DEFAULT now()
        );
        ALTER TABLE applicant_recruitment_history ADD COLUMN IF NOT EXISTS stage_outcome text;
        ALTER TABLE applicant_recruitment_history ADD COLUMN IF NOT EXISTS previous_stage_outcome text;
        UPDATE applicants a
        SET stage_outcome = CASE
          WHEN a.stage IN ('Passed Initial Interview', 'Passed Final Interview') THEN 'Passed'
          WHEN a.stage IN ('Not Passed - Initial Interview', 'Not Passed - Final Interview', 'Not Passed') THEN 'Not Passed'
          WHEN a.stage = 'Accepted Offer' THEN 'Accepted Offer'
          WHEN a.stage = 'Declined Offer' THEN 'Declined Offer'
          ELSE a.stage_outcome
        END,
        stage = CASE
          WHEN a.stage IN ('Passed Initial Interview', 'Not Passed - Initial Interview') THEN 'For Initial Interview'
          WHEN a.stage IN ('Passed Final Interview', 'Not Passed - Final Interview') THEN 'For Final Interview'
          WHEN a.stage IN ('For Job Offer', 'Accepted Offer', 'Declined Offer') THEN 'For Job Offering'
          WHEN a.stage IN ('Ongoing Pre-Employment Requirements', 'For Physical Exam', 'Fit to Work',
                           'Not Fit', 'Not Passed - Medical/Physical Exam', 'Starting Date', 'Onboarding',
                           'Employee Profile Created', 'Employee Account Created') THEN 'On-going Pre-Employment'
          WHEN a.stage = 'Not Passed' THEN CASE
            WHEN (
              SELECT h.previous_stage FROM applicant_recruitment_history h
              WHERE h.applicant_id = a.id AND h.stage = 'Not Passed'
              ORDER BY h.changed_at DESC, h.id DESC LIMIT 1
            ) = 'For Final Interview' THEN 'For Final Interview'
            ELSE 'For Initial Interview'
          END
          ELSE a.stage
        END
        WHERE a.stage NOT IN ('For Initial Interview', 'For Final Interview', 'For Job Offering',
                              'On-going Pre-Employment', 'Onboarded', 'Withdraw Application', 'No Show');
        UPDATE applicant_recruitment_history
        SET stage_outcome = CASE
          WHEN stage IN ('Passed Initial Interview', 'Passed Final Interview') THEN 'Passed'
          WHEN stage IN ('Not Passed - Initial Interview', 'Not Passed - Final Interview', 'Not Passed') THEN 'Not Passed'
          WHEN stage = 'Accepted Offer' THEN 'Accepted Offer'
          WHEN stage = 'Declined Offer' THEN 'Declined Offer'
          ELSE stage_outcome
        END,
        stage = CASE
          WHEN stage IN ('Passed Initial Interview', 'Not Passed - Initial Interview') THEN 'For Initial Interview'
          WHEN stage IN ('Passed Final Interview', 'Not Passed - Final Interview') THEN 'For Final Interview'
          WHEN stage IN ('For Job Offer', 'Accepted Offer', 'Declined Offer') THEN 'For Job Offering'
          WHEN stage IN ('Ongoing Pre-Employment Requirements', 'For Physical Exam', 'Fit to Work',
                         'Not Fit', 'Not Passed - Medical/Physical Exam', 'Starting Date', 'Onboarding',
                         'Employee Profile Created', 'Employee Account Created') THEN 'On-going Pre-Employment'
          WHEN stage = 'Not Passed' THEN CASE
            WHEN previous_stage = 'For Final Interview' THEN 'For Final Interview'
            ELSE 'For Initial Interview'
          END
          ELSE stage
        END;
        UPDATE applicants
        SET stage_updated_at = created_at
        WHERE stage = 'For Initial Interview'
          AND NOT EXISTS (
            SELECT 1 FROM applicant_recruitment_history h WHERE h.applicant_id = applicants.id
          );
        INSERT INTO applicant_recruitment_history (applicant_id, previous_stage, stage, changed_at)
        SELECT a.id, NULL, a.stage, a.stage_updated_at
        FROM applicants a
        WHERE NOT EXISTS (
          SELECT 1 FROM applicant_recruitment_history h WHERE h.applicant_id = a.id
        );
        UPDATE onboardings
        SET progress_stage = CASE
          WHEN status = 'hired' THEN 'Completed'
          WHEN status = 'approved' THEN 'Onboarding'
          WHEN starting_date IS NOT NULL THEN 'Starting Date'
          ELSE 'Pre-Employment Requirements'
        END
        WHERE progress_stage = 'Pre-Employment Requirements';
      `)
      .then(async () => {
        await pool.query(
          `UPDATE applicants
           SET pre_employment_requirements = $1::jsonb
           WHERE pre_employment_requirements = '[]'::jsonb`,
          [JSON.stringify(DEFAULT_PRE_EMPLOYMENT_REQUIREMENTS)],
        );
      })
      .catch((err) => {
        monitoringSchemaReady = null;
        throw err;
      });
  }
  return monitoringSchemaReady;
}

function parsePreEmploymentRequirements(value: unknown): PreEmploymentRequirement[] | null {
  if (!Array.isArray(value) || value.length !== requirementLabels.size) return null;
  const items: PreEmploymentRequirement[] = [];
  const seen = new Set<string>();
  for (const valueItem of value) {
    if (!valueItem || typeof valueItem !== "object") return null;
    const item = valueItem as Record<string, unknown>;
    if (
      typeof item.label !== "string" ||
      !requirementLabels.has(item.label) ||
      seen.has(item.label) ||
      typeof item.done !== "boolean"
    ) {
      return null;
    }
    seen.add(item.label);
    items.push({
      label: item.label,
      done: item.done,
      notes: typeof item.notes === "string" ? item.notes : null,
    });
  }
  return seen.size === requirementLabels.size ? items : null;
}

type GeminiModel = {
  name?: string;
  supportedGenerationMethods?: string[];
};

async function pickSupportedGeminiModel(apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url, { method: "GET" });
  if (!resp.ok) {
    const bodyText = await resp.text().catch(() => "");
    throw new Error(`Gemini listModels error (${resp.status}): ${bodyText || resp.statusText}`);
  }
  const data = (await resp.json()) as { models?: GeminiModel[] };
  const models = Array.isArray(data.models) ? data.models : [];

  const supportsGenerate = (m: GeminiModel) =>
    typeof m.name === "string" &&
    Array.isArray(m.supportedGenerationMethods) &&
    m.supportedGenerationMethods.includes("generateContent");

  const preferred =
    models.find((m) => supportsGenerate(m) && (m.name as string).includes("gemini") && (m.name as string).includes("flash")) ??
    models.find((m) => supportsGenerate(m) && (m.name as string).includes("gemini")) ??
    models.find((m) => supportsGenerate(m));

  if (!preferred?.name) throw new Error("No Gemini model supports generateContent for this API key");
  // API returns names like "models/gemini-xxx" — we need the suffix for the generateContent URL.
  return preferred.name.startsWith("models/") ? preferred.name.slice("models/".length) : preferred.name;
}

function assertAiEvaluation(value: unknown): asserts value is ApplicantAiEvaluation {
  if (!value || typeof value !== "object") throw new Error("AI evaluation is not an object");
  const v = value as any;
  if (typeof v.score !== "number" || v.score < 0 || v.score > 100) throw new Error("AI score must be 0-100");
  if (typeof v.summary !== "string" || !v.summary.trim()) throw new Error("AI summary is missing");
  if (!Array.isArray(v.matches)) throw new Error("AI matches must be an array");
  for (const m of v.matches) {
    if (!m || typeof m !== "object") throw new Error("AI match item is invalid");
    if (typeof (m as any).requirement !== "string" || !(m as any).requirement.trim()) {
      throw new Error("AI match requirement is missing");
    }
    if (typeof (m as any).met !== "boolean") throw new Error("AI match met must be boolean");
    const c = (m as any).confidence;
    if (typeof c !== "number" || c < 0 || c > 1) throw new Error("AI match confidence must be 0-1");
    if (typeof (m as any).evidence !== "string" || !(m as any).evidence.trim()) {
      throw new Error("AI match evidence is missing");
    }
  }
  if (typeof v.model !== "string" || !v.model.trim()) throw new Error("AI model is missing");
  if (typeof v.evaluatedAt !== "string" || !v.evaluatedAt.trim()) throw new Error("AI evaluatedAt is missing");
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

async function runGeminiAiEvaluation(args: {
  model: string;
  apiKey: string;
  jobTitle: string;
  jobDepartment: string;
  requirements: string[];
  applicantName: string;
  skills: string;
  experience: string;
  resume: string;
}): Promise<ApplicantAiEvaluation> {
  const { model, apiKey } = args;
  const makeUrl = (m: string) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(
      apiKey,
    )}`;

  const requirementsText = args.requirements.map((r) => `- ${r}`).join("\n");

  const systemInstruction =
    "You are an HR screening assistant. Score ONLY against the provided job requirements. " +
    "Do not use protected attributes (age, gender, religion, etc.) and do not guess missing info. " +
    "If evidence is missing, mark as not met and say what is missing.";

  const userPrompt = `Return ONLY valid JSON (no markdown, no backticks) matching this schema:
{
  "score": number, // 0-100 overall match
  "summary": string, // 1-3 short sentences
  "matches": [
    {
      "requirement": string,
      "met": boolean,
      "confidence": number, // 0 to 1
      "evidence": string // quote or paraphrase from resume/skills/experience
    }
  ]
}

Job:
Title: ${args.jobTitle}
Department: ${args.jobDepartment}
Requirements:
${requirementsText}

Applicant:
Name: ${args.applicantName}
Skills:
${args.skills}

Experience:
${args.experience}

Resume (text):
${args.resume}
`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    let activeModel = model;
    let resp = await fetch(makeUrl(activeModel), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
      signal: controller.signal,
    });

    if (resp.status === 404) {
      // Model not found / not supported for generateContent → pick a supported one automatically.
      activeModel = await pickSupportedGeminiModel(apiKey);
      resp = await fetch(makeUrl(activeModel), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
        signal: controller.signal,
      });
    }

    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => "");
      throw new Error(`Gemini error (${resp.status}): ${bodyText || resp.statusText}`);
    }

    const data = (await resp.json()) as any;
    const text: string | undefined =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ??
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text || typeof text !== "string") {
      throw new Error("Gemini returned empty response text");
    }

    const jsonText = extractJsonObject(text) ?? text.trim();
    const parsed = JSON.parse(jsonText);
    const enriched: ApplicantAiEvaluation = {
      ...parsed,
      model: activeModel,
      evaluatedAt: new Date().toISOString(),
    };
    assertAiEvaluation(enriched);
    return enriched;
  } finally {
    clearTimeout(timeout);
  }
}

router.get("/applicants", async (req, res) => {
  try {
    await ensureApplicantMonitoringSchema();
    const raw = req.query.jobId;
    const jobId =
      raw !== undefined && raw !== "" ? Number(raw) : undefined;
    if (jobId !== undefined && !Number.isFinite(jobId)) {
      return res.status(400).json({ error: "Invalid jobId" });
    }
    const rows = await db
      .select()
      .from(applicants)
      .where(jobId ? eq(applicants.jobId, jobId) : undefined)
      .orderBy(desc(applicants.totalScore));
    res.json(rows);
  } catch (err) {
    console.error("list applicants failed", err);
    res.status(500).json({
      error:
        "Could not load applicants. Run database migration (pnpm db:push or scripts/migrate-applicants-email-phone.sql).",
    });
  }
});

router.get("/applicants/:id", async (req, res) => {
  try {
    await ensureApplicantMonitoringSchema();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const [row] = await db.select().from(applicants).where(eq(applicants.id, id));
    if (!row) return res.status(404).json({ error: "Not found" });
    const history = await db
      .select()
      .from(applicantRecruitmentHistory)
      .where(eq(applicantRecruitmentHistory.applicantId, id))
      .orderBy(asc(applicantRecruitmentHistory.changedAt), asc(applicantRecruitmentHistory.id));
    res.json({ ...row, recruitmentHistory: history });
  } catch (err) {
    console.error("get applicant failed", err);
    res.status(500).json({ error: "Could not load applicant" });
  }
});

router.get("/applicants/:id/interviews", async (req, res) => {
  try {
    await ensureApplicantMonitoringSchema();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
    const [applicant] = await db.select({ id: applicants.id }).from(applicants).where(eq(applicants.id, id));
    if (!applicant) return res.status(404).json({ error: "Applicant not found" });
    const interviews = await db
      .select()
      .from(applicantInterviews)
      .where(eq(applicantInterviews.applicantId, id))
      .orderBy(asc(applicantInterviews.scheduledAt), asc(applicantInterviews.id));
    res.json(interviews);
  } catch (error) {
    console.error("list applicant interviews failed", error);
    res.status(500).json({ error: "Could not load interview history" });
  }
});

router.post("/applicants/:id/interviews", async (req, res) => {
  try {
    await ensureApplicantMonitoringSchema();
    const applicantId = Number(req.params.id);
    if (!Number.isInteger(applicantId) || applicantId < 1) {
      return res.status(400).json({ error: "Invalid applicant id" });
    }
    const { stage, scheduledAt, interviewer, notes } = req.body ?? {};
    if (
      !APPLICANT_INTERVIEW_STAGES.includes(stage) ||
      typeof scheduledAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(scheduledAt) ||
      !Number.isFinite(Date.parse(scheduledAt)) ||
      typeof interviewer !== "string" ||
      !interviewer.trim() ||
      (notes != null && typeof notes !== "string")
    ) {
      return res.status(400).json({
        error: "A valid interview stage, scheduled date/time, interviewer, and notes are required.",
      });
    }
    const [applicant] = await db.select({ id: applicants.id }).from(applicants).where(eq(applicants.id, applicantId));
    if (!applicant) return res.status(404).json({ error: "Applicant not found" });
    const [interview] = await db
      .insert(applicantInterviews)
      .values({
        applicantId,
        stage,
        scheduledAt: new Date(scheduledAt),
        interviewer: interviewer.trim(),
        notes: typeof notes === "string" ? notes.trim() : "",
        status: "scheduled",
      })
      .returning();
    res.status(201).json(interview);
  } catch (error) {
    console.error("schedule applicant interview failed", error);
    res.status(500).json({ error: "Could not schedule interview" });
  }
});

router.patch("/applicants/:id/interviews/:interviewId", async (req, res) => {
  try {
    await ensureApplicantMonitoringSchema();
    const applicantId = Number(req.params.id);
    const interviewId = Number(req.params.interviewId);
    if (
      !Number.isInteger(applicantId) || applicantId < 1 ||
      !Number.isInteger(interviewId) || interviewId < 1
    ) {
      return res.status(400).json({ error: "Invalid applicant or interview id" });
    }
    const { result, outcome } = req.body ?? {};
    if (
      typeof result !== "string" ||
      !result.trim() ||
      (outcome !== "Passed" && outcome !== "Failed")
    ) {
      return res.status(400).json({ error: "A result and Passed/Failed outcome are required." });
    }
    const [completed] = await db
      .update(applicantInterviews)
      .set({
        result: result.trim(),
        outcome,
        status: "completed",
        completedAt: new Date(),
      })
      .where(
        and(
          eq(applicantInterviews.id, interviewId),
          eq(applicantInterviews.applicantId, applicantId),
          eq(applicantInterviews.status, "scheduled"),
        ),
      )
      .returning();
    if (!completed) {
      const [existing] = await db
        .select({ id: applicantInterviews.id })
        .from(applicantInterviews)
        .where(
          and(
            eq(applicantInterviews.id, interviewId),
            eq(applicantInterviews.applicantId, applicantId),
          ),
        );
      if (!existing) return res.status(404).json({ error: "Interview record not found" });
      return res.status(409).json({ error: "Completed interview records are historical and cannot be overwritten." });
    }
    res.json(completed);
  } catch (error) {
    console.error("complete applicant interview failed", error);
    res.status(500).json({ error: "Could not complete interview" });
  }
});

router.post("/applicants", async (req, res) => {
  try {
    await ensureApplicantMonitoringSchema();
    const body = CreateApplicantBody.parse(req.body);
    const [job] = await db.select().from(jobs).where(eq(jobs.id, body.jobId));
    if (!job) return res.status(404).json({ error: "Job not found" });

    const reqs = (job.requirements as Requirement[]) ?? [];
    const answersByLabel = new Map<string, boolean | number>();
    for (const a of body.answers) answersByLabel.set(a.label, a.value);

    let total = 0;
    const matches: RequirementMatch[] = [];
    for (const r of reqs) {
      const value = answersByLabel.get(r.label);
      let score = 0;
      if (r.kind === "checkbox") {
        const checked = value === true;
        score = checked ? r.weight : 0;
      } else if (r.kind === "number") {
        const num = typeof value === "number" ? value : 0;
        const max = r.max && r.max > 0 ? r.max : 1;
        const ratio = Math.min(num / max, 1);
        score = ratio * r.weight;
      }
      total += score;
      matches.push({
        label: r.label,
        kind: r.kind,
        value: value ?? (r.kind === "checkbox" ? false : 0),
        score: Math.round(score * 100) / 100,
        weight: r.weight,
      });
    }
    const totalScore = Math.min(Math.round(total * 100) / 100, 100);

    if (job.status !== "active") {
      return res.status(400).json({ error: "This job is no longer accepting applications" });
    }

    const [row] = await db.transaction(async (tx) => {
      const [applicant] = await tx
        .insert(applicants)
        .values({
          jobId: body.jobId,
          name: body.name,
          email: body.email,
          phone: body.phone,
          address: body.address,
          skills: body.skills,
          experience: body.experience,
          resume: body.resume,
          stage: "For Initial Interview",
          stageUpdatedAt: new Date(),
          preEmploymentRequirements: DEFAULT_PRE_EMPLOYMENT_REQUIREMENTS.map((item) => ({ ...item })),
          totalScore,
          matches,
        })
        .returning();
      await tx.insert(applicantRecruitmentHistory).values({
        applicantId: applicant!.id,
        previousStage: null,
        stage: applicant!.stage,
        changedAt: applicant!.stageUpdatedAt,
      });
      return [applicant];
    });
    res.status(201).json(row);
  } catch (err) {
    console.error("create applicant failed", err);
    if (err instanceof Error && err.name === "ZodError") {
      return res.status(400).json({ error: "Invalid application data" });
    }
    res.status(500).json({
      error:
        "Could not save application. Run database migration (pnpm db:push or scripts/migrate-applicants-email-phone.sql).",
    });
  }
});

router.patch("/applicants/:id", async (req, res) => {
  try {
    await ensureApplicantMonitoringSchema();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const body = UpdateApplicantBody.parse(req.body);
    if (!("stage" in body) && !("stageOutcome" in body) && !("preEmploymentRequirements" in body)) {
      return res.status(400).json({ error: "No applicant changes provided" });
    }
    const nextStage = body.stage ?? undefined;
    if (nextStage !== undefined && !validStages.has(nextStage)) {
      return res.status(400).json({ error: "Invalid recruitment stage" });
    }
    if (nextStage !== undefined && systemManagedStages.has(nextStage)) {
      return res.status(400).json({
        error: "This recruitment stage is recorded automatically by the onboarding workflow.",
      });
    }
    if (
      body.stageOutcome != null &&
      (!nextStage || !stageOutcomes[nextStage]?.includes(body.stageOutcome))
    ) {
      return res.status(400).json({ error: "Outcome does not match the selected applicant status." });
    }
    const requirements =
      body.preEmploymentRequirements === undefined
        ? undefined
        : parsePreEmploymentRequirements(body.preEmploymentRequirements);
    if (body.preEmploymentRequirements !== undefined && !requirements) {
      return res.status(400).json({ error: "Invalid pre-employment requirements checklist" });
    }

    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(applicants).where(eq(applicants.id, id));
      if (!existing) return null;

      const changedAt = new Date();
      const updatedStage = nextStage ?? existing.stage;
      const updatedOutcome =
        nextStage !== undefined && nextStage !== existing.stage
          ? body.stageOutcome ?? null
          : body.stageOutcome === undefined
            ? existing.stageOutcome
            : body.stageOutcome;
      if (
        body.stageOutcome != null &&
        !stageOutcomes[updatedStage]?.includes(body.stageOutcome)
      ) {
        throw new Error("Outcome does not match the selected applicant status.");
      }
      const stageChanged = updatedStage !== existing.stage;
      const outcomeChanged = updatedOutcome !== existing.stageOutcome;
      if (!stageChanged && !outcomeChanged && !requirements) return existing;
      if (
        stageChanged &&
        updatedStage === "For Final Interview" &&
        (existing.stage !== "For Initial Interview" || existing.stageOutcome !== "Passed")
      ) {
        return { error: "Mark the initial interview as passed before scheduling the final interview." };
      }
      if (
        stageChanged &&
        updatedStage === "For Job Offering" &&
        (existing.stage !== "For Final Interview" || existing.stageOutcome !== "Passed")
      ) {
        return { error: "Mark the final interview as passed before preparing a job offer." };
      }
      const patch: Partial<typeof applicants.$inferInsert> = {};
      if (stageChanged || outcomeChanged) {
        patch.stage = updatedStage;
        patch.stageOutcome = updatedOutcome;
        patch.stageUpdatedAt = changedAt;
      }
      if (requirements) patch.preEmploymentRequirements = requirements;

      const [applicant] = await tx
        .update(applicants)
        .set(patch)
        .where(eq(applicants.id, id))
        .returning();
      if (!applicant) return null;

      if (stageChanged || outcomeChanged) {
        await tx.insert(applicantRecruitmentHistory).values({
          applicantId: id,
          previousStage: existing.stage,
          previousStageOutcome: existing.stageOutcome,
          stage: updatedStage,
          stageOutcome: updatedOutcome,
          changedAt,
        });
      }
      if (requirements) {
        await tx
          .update(onboardings)
          .set({ preEmploymentRequirements: requirements, updatedAt: changedAt })
          .where(eq(onboardings.applicantId, id));
      }
      return applicant;
    });
    if (updated && "error" in updated) {
      return res.status(400).json({ error: updated.error });
    }
    if (!updated) return res.status(404).json({ error: "Applicant not found" });

    const history = await db
      .select()
      .from(applicantRecruitmentHistory)
      .where(eq(applicantRecruitmentHistory.applicantId, id))
      .orderBy(asc(applicantRecruitmentHistory.changedAt), asc(applicantRecruitmentHistory.id));
    res.json({ ...updated, recruitmentHistory: history });
  } catch (err) {
    console.error("update applicant failed", err);
    if (err instanceof Error && err.name === "ZodError") {
      return res.status(400).json({ error: "Invalid applicant update" });
    }
    res.status(500).json({ error: "Could not update applicant" });
  }
});

router.post("/applicants/:id/ai-score", async (req, res) => {
  try {
    await ensureApplicantMonitoringSchema();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY on server. Add it to environment variables and restart the API server.",
      });
    }

    const [applicant] = await db.select().from(applicants).where(eq(applicants.id, id));
    if (!applicant) return res.status(404).json({ error: "Applicant not found" });

    const [job] = await db.select().from(jobs).where(eq(jobs.id, applicant.jobId));
    if (!job) return res.status(404).json({ error: "Job not found" });

    const reqsFromWeights = Array.isArray(job.requirements)
      ? (job.requirements as Requirement[]).map((r) => r.label)
      : [];
    const reqsFromDescription = String(job.description || "")
      .split(/\r?\n/g)
      .map((s) => s.trim())
      .filter(Boolean);

    const uniqueReqs = Array.from(new Set([...reqsFromWeights, ...reqsFromDescription])).slice(0, 30);

    const evaluation = await runGeminiAiEvaluation({
      model: GEMINI_DEFAULT_MODEL,
      apiKey,
      jobTitle: job.title,
      jobDepartment: job.department,
      requirements: uniqueReqs,
      applicantName: applicant.name,
      skills: applicant.skills,
      experience: applicant.experience,
      resume: applicant.resume,
    });

    const [updated] = await db
      .update(applicants)
      .set({
        aiScore: evaluation.score,
        aiEvaluation: evaluation,
        aiUpdatedAt: new Date(),
      })
      .where(eq(applicants.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("ai-score applicant failed", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not run AI scoring" });
  }
});

router.delete("/applicants/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(applicants).where(eq(applicants.id, id));
  res.status(204).end();
});

export default router;
