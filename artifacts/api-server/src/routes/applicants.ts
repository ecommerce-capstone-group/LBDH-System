import { Router, type IRouter } from "express";
import { db, applicants, jobs } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateApplicantBody } from "@workspace/api-zod";
import type { ApplicantAiEvaluation, Requirement, RequirementMatch } from "@workspace/db";

const router: IRouter = Router();

const GEMINI_DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

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
  const id = Number(req.params.id);
  const [row] = await db.select().from(applicants).where(eq(applicants.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.post("/applicants", async (req, res) => {
  try {
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

    const [row] = await db
      .insert(applicants)
      .values({
        jobId: body.jobId,
        name: body.name,
        email: body.email,
        phone: body.phone,
        skills: body.skills,
        experience: body.experience,
        resume: body.resume,
        totalScore,
        matches,
      })
      .returning();
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

router.post("/applicants/:id/ai-score", async (req, res) => {
  try {
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
