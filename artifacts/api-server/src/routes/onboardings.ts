import { Router, type IRouter } from "express";
import {
  db,
  onboardings,
  applicants,
  jobs,
  employees,
  DEFAULT_PRE_EMPLOYMENT_REQUIREMENTS,
  type PreEmploymentRequirement,
} from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { provisionEmployeeAccount } from "../lib/employee-accounts";

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

router.post("/onboardings", async (req, res) => {
  try {
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
    const [row] = await db
      .insert(onboardings)
      .values({
        applicantId: applicant.id,
        jobId: job.id,
        applicantName: applicant.name,
        applicantEmail: applicant.email ?? "",
        applicantPhone: applicant.phone ?? "",
        jobTitle: job.title,
        jobDepartment: job.department,
        interviewScheduledAt,
        interviewNotes: asTrimmedString(body.interviewNotes),
        interviewStatus: interviewScheduledAt ? "scheduled" : "pending",
        interviewResult: "",
        preEmploymentRequirements: DEFAULT_PRE_EMPLOYMENT_REQUIREMENTS.map((r) => ({
          ...r,
        })),
        status: "in_progress",
        hrNotes: asTrimmedString(body.hrNotes),
      })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    console.error("create onboarding failed", err);
    res.status(500).json({ error: "Could not start onboarding" });
  }
});

router.patch("/onboardings/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const body = req.body ?? {};

    const [existing] = await db.select().from(onboardings).where(eq(onboardings.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.status === "hired") {
      return res.status(400).json({ error: "Hired onboardings cannot be edited" });
    }

    const patch: Record<string, unknown> = {
      updatedAt: new Date(),
    };

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
      patch.preEmploymentRequirements = parsed;
    }
    if ("status" in body && body.status != null) {
      patch.status = asTrimmedString(body.status);
    }
    if ("hrNotes" in body) {
      patch.hrNotes = asTrimmedString(body.hrNotes);
    }

    const [row] = await db
      .update(onboardings)
      .set(patch)
      .where(eq(onboardings.id, id))
      .returning();
    res.json(row);
  } catch (err) {
    console.error("update onboarding failed", err);
    res.status(500).json({ error: "Could not update onboarding" });
  }
});

router.post("/onboardings/:id/create-employee", async (req, res) => {
  try {
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
    if (existing.status !== "approved" && existing.status !== "hired") {
      return res.status(400).json({
        error: "Mark onboarding as approved before creating the employee profile",
      });
    }

    const [applicant] = await db
      .select()
      .from(applicants)
      .where(eq(applicants.id, existing.applicantId));

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
        updatedAt: new Date(),
      })
      .where(eq(onboardings.id, id))
      .returning();

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
