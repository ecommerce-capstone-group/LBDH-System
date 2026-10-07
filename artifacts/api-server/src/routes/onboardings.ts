import { Router, type IRouter } from "express";
import {
  db,
  onboardings,
  applicants,
  applicantRecruitmentHistory,
  jobs,
  employees,
  DEFAULT_PRE_EMPLOYMENT_REQUIREMENTS,
  ONBOARDING_PROGRESS_STAGES,
  type PreEmploymentRequirement,
} from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { provisionEmployeeAccount } from "../lib/employee-accounts";
import { ensureApplicantMonitoringSchema } from "./applicants";

const router: IRouter = Router();

function asTrimmedString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return fallback;
  return String(value).trim();
}

function parseOptionalDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseDateOnly(value: unknown): string | null | undefined {
  if (value == null || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return undefined;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return undefined;
  }
  return value;
}

function parsePreEmploymentRequirements(value: unknown): PreEmploymentRequirement[] | null {
  if (!Array.isArray(value)) return null;
  const out: PreEmploymentRequirement[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const label = asTrimmedString((item as any).label);
    if (!label) return null;
    out.push({
      label,
      done: Boolean((item as any).done),
      notes:
        (item as any).notes == null
          ? null
          : asTrimmedString((item as any).notes) || null,
    });
  }
  return out;
}

function normalizePreEmploymentRequirements(
  requirements: PreEmploymentRequirement[],
): PreEmploymentRequirement[] {
  const legacyLabelTargets: Record<string, string[]> = {
    "Pre-employment medical / PE": ["Medical", "Physical"],
    "NBI / police clearance": ["NBI Clearance", "Police Clearance"],
    "PSA birth certificate": ["Birth Certificate"],
    "Diploma / Transcript of Records": ["Diploma", "TOR"],
    "PRC license (if applicable)": ["PRC License"],
    "SSS / PhilHealth / Pag-IBIG numbers": ["SSS", "PHIC", "PAGIBIG"],
    "2x2 ID photos": ["2x2 1x1 pictures"],
  };
  const doneByLabel = new Map<string, PreEmploymentRequirement>();
  for (const requirement of requirements) {
    const targets = legacyLabelTargets[requirement.label] ?? [requirement.label];
    for (const label of targets) {
      if (!doneByLabel.has(label) || requirement.done) {
        doneByLabel.set(label, { ...requirement, label });
      }
    }
  }
  return DEFAULT_PRE_EMPLOYMENT_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    ...(doneByLabel.get(requirement.label) ?? {}),
    label: requirement.label,
  }));
}

router.get("/onboardings", async (req, res) => {
  try {
    const jobIdRaw = req.query.jobId;
    const applicantIdRaw = req.query.applicantId;
    const statusRaw = req.query.status;

    const jobId =
      jobIdRaw !== undefined && jobIdRaw !== "" ? Number(jobIdRaw) : undefined;
    const applicantId =
      applicantIdRaw !== undefined && applicantIdRaw !== ""
        ? Number(applicantIdRaw)
        : undefined;
    const status =
      typeof statusRaw === "string" && statusRaw.trim()
        ? statusRaw.trim()
        : undefined;

    if (jobId !== undefined && !Number.isFinite(jobId)) {
      return res.status(400).json({ error: "Invalid jobId" });
    }
    if (applicantId !== undefined && !Number.isFinite(applicantId)) {
      return res.status(400).json({ error: "Invalid applicantId" });
    }

    const conds = [];
    if (jobId !== undefined) conds.push(eq(onboardings.jobId, jobId));
    if (applicantId !== undefined) conds.push(eq(onboardings.applicantId, applicantId));
    if (status) conds.push(eq(onboardings.status, status));

    const rows = await db
      .select()
      .from(onboardings)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(onboardings.createdAt));
    res.json(rows);
  } catch (err) {
    console.error("list onboardings failed", err);
    res.status(500).json({ error: "Could not load onboardings" });
  }
});

router.get("/onboardings/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const [row] = await db.select().from(onboardings).where(eq(onboardings.id, id));
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    console.error("get onboarding failed", err);
    res.status(500).json({ error: "Could not load onboarding" });
  }
});

const MEDICAL_ASSESSMENT_STATUSES = ["For Physical Exam", "Fit to Work", "Not Fit"] as const;

router.post("/onboardings", async (req, res) => {
  try {
    await ensureApplicantMonitoringSchema();
    const body = req.body ?? {};
    const applicantId = Number(body.applicantId);
    if (!Number.isFinite(applicantId)) {
      return res.status(400).json({ error: "applicantId is required" });
    }

    const [applicant] = await db
      .select()
      .from(applicants)
      .where(eq(applicants.id, applicantId));
    if (!applicant) return res.status(404).json({ error: "Applicant not found" });
    if (applicant.stage !== "For Job Offering" || applicant.stageOutcome !== "Accepted Offer") {
      return res.status(400).json({
        error: "Onboarding can start only after the applicant accepts the job offer.",
      });
    }

    const [job] = await db.select().from(jobs).where(eq(jobs.id, applicant.jobId));
    if (!job) return res.status(404).json({ error: "Job not found" });

    const existing = await db
      .select()
      .from(onboardings)
      .where(
        and(
          eq(onboardings.applicantId, applicant.id),
          eq(onboardings.status, "in_progress"),
        ),
      );
    if (existing.length > 0) {
      return res.status(400).json({
        error: "This applicant already has an in-progress onboarding record.",
      });
    }

    const interviewScheduledAt = parseOptionalDate(body.interviewScheduledAt);
    const [row] = await db.transaction(async (tx) => {
      const [createdOnboarding] = await tx
        .insert(onboardings)
        .values({
          applicantId: applicant.id,
          jobId: job.id,
          applicantName: applicant.name,
          applicantEmail: applicant.email ?? "",
          applicantPhone: applicant.phone ?? "",
          jobTitle: job.title,
          jobDepartment: job.department,
          progressStage: "Pre-Employment Requirements",
          interviewScheduledAt,
          interviewNotes: asTrimmedString(body.interviewNotes),
          interviewStatus: interviewScheduledAt ? "scheduled" : "pending",
          interviewResult: "",
          preEmploymentRequirements:
            applicant.preEmploymentRequirements.length > 0
              ? applicant.preEmploymentRequirements
              : DEFAULT_PRE_EMPLOYMENT_REQUIREMENTS.map((r) => ({ ...r })),
          status: "in_progress",
          hrNotes: asTrimmedString(body.hrNotes),
        })
        .returning();
      const changedAt = new Date();
      const [updatedApplicant] = await tx
        .update(applicants)
        .set({ stage: "On-going Pre-Employment", stageOutcome: null, stageUpdatedAt: changedAt })
        .where(
          and(
            eq(applicants.id, applicant.id),
            eq(applicants.stage, "For Job Offering"),
            eq(applicants.stageOutcome, "Accepted Offer"),
          ),
        )
        .returning({ id: applicants.id });
      if (!updatedApplicant) {
        throw new Error("Applicant stage changed while onboarding was being started.");
      }
      await tx.insert(applicantRecruitmentHistory).values({
        applicantId: applicant.id,
        previousStage: "For Job Offering",
        previousStageOutcome: "Accepted Offer",
        stage: "On-going Pre-Employment",
        stageOutcome: null,
        changedAt,
      });
      return [createdOnboarding];
    });

    res.status(201).json(row);
  } catch (err) {
    console.error("create onboarding failed", err);
    res.status(500).json({ error: "Could not start onboarding" });
  }
});

router.patch("/onboardings/:id", async (req, res) => {
  try {
    await ensureApplicantMonitoringSchema();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const body = req.body ?? {};

    const [existing] = await db.select().from(onboardings).where(eq(onboardings.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.status === "hired") {
      return res.status(400).json({ error: "Hired onboardings cannot be edited" });
    }
    const progressStage = body.progressStage == null
      ? existing.progressStage
      : asTrimmedString(body.progressStage);
    if (!ONBOARDING_PROGRESS_STAGES.includes(progressStage as (typeof ONBOARDING_PROGRESS_STAGES)[number])) {
      return res.status(400).json({ error: "Invalid onboarding progress stage." });
    }
    if (["Employee Profile", "Employee Account", "Completed"].includes(progressStage)) {
      return res.status(400).json({
        error: "Employee profile and account stages are completed by employee creation.",
      });
    }
    const startingDate = "startingDate" in body
      ? parseDateOnly(body.startingDate)
      : existing.startingDate;
    if (startingDate === undefined) {
      return res.status(400).json({ error: "Starting date must be a valid date." });
    }

    const patch: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    let updatedRequirements: PreEmploymentRequirement[] | null = null;
    if ("progressStage" in body && body.progressStage != null) {
      patch.progressStage = progressStage;
    }
    if ("startingDate" in body) {
      patch.startingDate = startingDate;
    }

    if ("interviewScheduledAt" in body) {
      patch.interviewScheduledAt = parseOptionalDate(body.interviewScheduledAt);
    }
    if ("interviewNotes" in body) {
      patch.interviewNotes = asTrimmedString(body.interviewNotes);
    }
    if ("interviewStatus" in body && body.interviewStatus != null) {
      patch.interviewStatus = asTrimmedString(body.interviewStatus);
    }
    if ("interviewResult" in body) {
      patch.interviewResult = asTrimmedString(body.interviewResult);
    }
    if ("preEmploymentRequirements" in body) {
      const parsed = parsePreEmploymentRequirements(body.preEmploymentRequirements);
      if (!parsed) {
        return res.status(400).json({ error: "Invalid preEmploymentRequirements" });
      }
      updatedRequirements = normalizePreEmploymentRequirements(parsed);
      patch.preEmploymentRequirements = updatedRequirements;
    }
    const medicalStatus = "medicalStatus" in body
      ? body.medicalStatus == null || body.medicalStatus === ""
        ? null
        : asTrimmedString(body.medicalStatus)
      : existing.medicalStatus;
    if (
      medicalStatus !== null &&
      !MEDICAL_ASSESSMENT_STATUSES.includes(medicalStatus as (typeof MEDICAL_ASSESSMENT_STATUSES)[number])
    ) {
      return res.status(400).json({ error: "Invalid medical assessment status." });
    }
    const medicalFieldsUpdated =
      "medicalStatus" in body || "medicalNotes" in body || "medicalDocuments" in body;
    if ("medicalStatus" in body) {
      patch.medicalStatus = medicalStatus;
    }
    if ("medicalNotes" in body) {
      patch.medicalNotes = asTrimmedString(body.medicalNotes);
    }
    if ("medicalDocuments" in body) {
      patch.medicalDocuments = asTrimmedString(body.medicalDocuments);
    }
    if (medicalFieldsUpdated) {
      patch.medicalUpdatedAt = new Date();
    }
    if ("status" in body && body.status != null) {
      patch.status = asTrimmedString(body.status);
    }
    if ("hrNotes" in body) {
      patch.hrNotes = asTrimmedString(body.hrNotes);
    }

    const result = await db.transaction(async (tx) => {
      const [applicant] = await tx
        .select({ id: applicants.id, stage: applicants.stage, stageOutcome: applicants.stageOutcome })
        .from(applicants)
        .where(eq(applicants.id, existing.applicantId));
      if (!applicant) return { error: "Applicant not found" as const };
      const [updated] = await tx
        .update(onboardings)
        .set(patch)
        .where(eq(onboardings.id, id))
        .returning();
      if (updated && updatedRequirements) {
        await tx
          .update(applicants)
          .set({ preEmploymentRequirements: updatedRequirements })
          .where(eq(applicants.id, existing.applicantId));
      }
      if (progressStage !== existing.progressStage) {
        const changedAt = new Date();
        await tx.insert(applicantRecruitmentHistory).values({
          applicantId: applicant.id,
          previousStage: applicant.stage,
          previousStageOutcome: applicant.stageOutcome,
          stage: progressStage,
          stageOutcome: null,
          changedAt,
        });
      }
      return { row: updated };
    });
    if ("error" in result) return res.status(400).json({ error: result.error });
    res.json(result.row);
  } catch (err) {
    console.error("update onboarding failed", err);
    res.status(500).json({ error: "Could not update onboarding" });
  }
});

router.post("/onboardings/:id/create-employee", async (req, res) => {
  try {
    await ensureApplicantMonitoringSchema();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const body = req.body ?? {};

    const [existing] = await db.select().from(onboardings).where(eq(onboardings.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.employeeId) {
      return res.status(400).json({ error: "Employee profile already created for this onboarding" });
    }
    if (existing.status === "cancelled") {
      return res.status(400).json({ error: "Cannot hire a cancelled onboarding" });
    }
    if (existing.progressStage !== "Onboarding") {
      return res.status(400).json({
        error: "Select the Onboarding step before creating an employee profile.",
      });
    }
    const [applicant] = await db
      .select()
      .from(applicants)
      .where(eq(applicants.id, existing.applicantId));
    if (!applicant) return res.status(404).json({ error: "Applicant not found" });
    const applicantRequirements = normalizePreEmploymentRequirements(
      applicant.preEmploymentRequirements,
    );
    if (!applicantRequirements.every((requirement) => requirement.done)) {
      return res.status(400).json({
        error: "Complete every pre-employment requirement in Applicant Monitoring before onboarding the employee.",
      });
    }
    if (!existing.startingDate) {
      return res.status(400).json({ error: "Set the employee's starting date before onboarding." });
    }
    if (existing.medicalStatus !== "Fit to Work") {
      return res.status(400).json({
        error: "Record Fit to Work before creating an employee profile.",
      });
    }
    if (applicant.stage !== "On-going Pre-Employment") {
      return res.status(400).json({
        error: "Applicant must be in ongoing pre-employment before employee creation.",
      });
    }

    const name = asTrimmedString(body.name, existing.applicantName);
    const role = asTrimmedString(body.role, existing.jobTitle);
    const department = asTrimmedString(body.department, existing.jobDepartment);
    const email = asTrimmedString(body.email, existing.applicantEmail);
    const phone = asTrimmedString(body.phone, existing.applicantPhone) || null;

    if (!name || !role || !department || !email) {
      return res.status(400).json({
        error: "Name, role, department, and email are required to create an employee",
      });
    }

    const docsParts = [
      asTrimmedString(body.documents) || null,
      applicant?.resume ? `Resume (from application):\n${applicant.resume}` : null,
      applicant?.skills ? `Skills:\n${applicant.skills}` : null,
      applicant?.experience ? `Experience:\n${applicant.experience}` : null,
      `Linked applicant #${existing.applicantId} / job #${existing.jobId} / onboarding #${existing.id}`,
    ].filter(Boolean);

    const [employee] = await db
      .insert(employees)
      .values({
        name,
        role,
        department,
        email,
        phone,
        licenseName: asTrimmedString(body.licenseName) || null,
        licenseExpiry: asTrimmedString(body.licenseExpiry) || null,
        documents: docsParts.join("\n\n") || null,
        vlBalance: 15,
        slBalance: 15,
        status: "active",
      })
      .returning();

    const account = await provisionEmployeeAccount({
      employeeId: employee!.id,
      name: employee!.name,
      email: employee!.email,
    });

    const [onboarding] = await db
      .update(onboardings)
      .set({
        employeeId: employee!.id,
        status: "hired",
        progressStage: "Completed",
        updatedAt: new Date(),
      })
      .where(eq(onboardings.id, id))
      .returning();

    await db.transaction(async (tx) => {
      const [currentApplicant] = await tx
        .select({ id: applicants.id, stage: applicants.stage })
        .from(applicants)
        .where(eq(applicants.id, existing.applicantId));
      if (!currentApplicant || currentApplicant.stage === "Onboarded") return;
      const changedAt = new Date();
      const [updatedApplicant] = await tx
        .update(applicants)
        .set({ stage: "Onboarded", stageOutcome: null, stageUpdatedAt: changedAt })
        .where(
          and(
            eq(applicants.id, currentApplicant.id),
            eq(applicants.stage, "On-going Pre-Employment"),
          ),
        )
        .returning({ id: applicants.id, stage: applicants.stage, stageUpdatedAt: applicants.stageUpdatedAt });
      if (updatedApplicant) {
        const stages = [
          "Employee Profile Created",
          "Employee Account Created",
          "Onboarded",
        ];
        let previousStage = currentApplicant.stage;
        for (const stage of stages) {
          await tx.insert(applicantRecruitmentHistory).values({
            applicantId: updatedApplicant.id,
            previousStage,
            previousStageOutcome: null,
            stage,
            stageOutcome: null,
            changedAt: updatedApplicant.stageUpdatedAt,
          });
          previousStage = stage;
        }
      }
    });

    // Auto-mark job as filled when hired count reaches staff needed (keeps applicants).
    const [job] = await db.select().from(jobs).where(eq(jobs.id, existing.jobId));
    if (job && job.status === "active") {
      const [hiredRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(onboardings)
        .where(and(eq(onboardings.jobId, existing.jobId), eq(onboardings.status, "hired")));
      const hiredCount = Number(hiredRow?.count) || 0;
      const staffNeeded = job.staffNeeded ?? 1;
      if (hiredCount >= staffNeeded) {
        await db
          .update(jobs)
          .set({ status: "filled" })
          .where(eq(jobs.id, existing.jobId));
      }
    }

    res.status(201).json({
      onboarding,
      employee,
      account: account
        ? {
            username: account.username,
            temporaryPassword: account.temporaryPassword,
          }
        : null,
    });
  } catch (err) {
    console.error("create employee from onboarding failed", err);
    res.status(500).json({ error: "Could not create employee from onboarding" });
  }
});

export default router;
