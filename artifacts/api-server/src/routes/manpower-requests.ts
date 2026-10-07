import { Router, type IRouter } from "express";
import {
  db,
  MANPOWER_REQUEST_APPROVALS,
  manpowerRequests,
  pool,
  type ApprovalStep,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

const initialApprovals = (): ApprovalStep[] =>
  MANPOWER_REQUEST_APPROVALS.map((name) => ({ name, status: "pending" }));

let schemaReady: Promise<void> | null = null;

export function ensureManpowerRequestSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS manpower_requests (
          id serial PRIMARY KEY,
          position text NOT NULL,
          unit text NOT NULL,
          department text NOT NULL,
          staff_needed integer NOT NULL CHECK (staff_needed > 0),
          vacancy_type text NOT NULL,
          vacancy_details text NOT NULL DEFAULT '',
          job_description text NOT NULL,
          qualifications text NOT NULL,
          approvals jsonb NOT NULL DEFAULT '[]'::jsonb,
          status text NOT NULL DEFAULT 'pending',
          created_at timestamptz NOT NULL DEFAULT now()
        );
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS manpower_request_id integer;
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'jobs_manpower_request_id_fkey'
          ) THEN
            ALTER TABLE jobs
              ADD CONSTRAINT jobs_manpower_request_id_fkey
              FOREIGN KEY (manpower_request_id)
              REFERENCES manpower_requests(id)
              ON DELETE RESTRICT;
          END IF;
        END $$;
        CREATE UNIQUE INDEX IF NOT EXISTS jobs_manpower_request_id_unique
          ON jobs(manpower_request_id)
          WHERE manpower_request_id IS NOT NULL;
      `)
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

router.get("/manpower-requests", async (_req, res) => {
  try {
    await ensureManpowerRequestSchema();
    const rows = await db
      .select()
      .from(manpowerRequests)
      .orderBy(desc(manpowerRequests.createdAt));
    res.json(rows);
  } catch (error) {
    console.error("list manpower requests failed", error);
    res.status(500).json({ error: "Could not list manpower requests" });
  }
});

router.post("/manpower-requests", async (req, res) => {
  try {
    await ensureManpowerRequestSchema();
    const body = req.body ?? {};
    const position = typeof body.position === "string" ? body.position.trim() : "";
    const unit = typeof body.unit === "string" ? body.unit.trim() : "";
    const department = typeof body.department === "string" ? body.department.trim() : "";
    const staffNeeded = Number(body.staffNeeded);
    const vacancyType = body.vacancyType;
    const vacancyDetails =
      typeof body.vacancyDetails === "string" ? body.vacancyDetails.trim() : "";
    const jobDescription =
      typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
    const qualifications =
      typeof body.qualifications === "string" ? body.qualifications.trim() : "";

    if (
      !position ||
      !unit ||
      !department ||
      !Number.isInteger(staffNeeded) ||
      staffNeeded < 1 ||
      (vacancyType !== "New Position" && vacancyType !== "Replacement") ||
      !vacancyDetails ||
      !jobDescription ||
      !qualifications
    ) {
      return res.status(400).json({
        error:
          "Position, unit, department, positive staff count, vacancy details, job description, and qualifications are required.",
      });
    }

    const [row] = await db
      .insert(manpowerRequests)
      .values({
        position,
        unit,
        department,
        staffNeeded,
        vacancyType,
        vacancyDetails,
        jobDescription,
        qualifications,
        approvals: initialApprovals(),
        status: "pending",
      })
      .returning();
    res.status(201).json(row);
  } catch (error) {
    console.error("create manpower request failed", error);
    res.status(500).json({ error: "Could not create manpower request" });
  }
});

router.patch("/manpower-requests/:id/approvals", async (req, res) => {
  try {
    await ensureManpowerRequestSchema();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid manpower request id" });
    }
    const { name, approved, actor } = req.body ?? {};
    if (
      !MANPOWER_REQUEST_APPROVALS.includes(name) ||
      typeof approved !== "boolean"
    ) {
      return res.status(400).json({ error: "Invalid approval update" });
    }

    const updated = await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(manpowerRequests)
        .where(eq(manpowerRequests.id, id))
        .for("update");
      if (!request) return null;
      const timestamp = new Date().toISOString();
      const approvals = (request.approvals as ApprovalStep[]).map((step) =>
        step.name === name
          ? {
              ...step,
              status: approved ? "approved" as const : "pending" as const,
              actor: approved && typeof actor === "string" ? actor : null,
              timestamp: approved ? timestamp : null,
            }
          : step,
      );
      const status = approvals.every((step) => step.status === "approved")
        ? "approved"
        : "pending";
      const [row] = await tx
        .update(manpowerRequests)
        .set({ approvals, status })
        .where(eq(manpowerRequests.id, id))
        .returning();
      return row;
    });
    if (!updated) return res.status(404).json({ error: "Manpower request not found" });
    res.json(updated);
  } catch (error) {
    console.error("update manpower request approval failed", error);
    res.status(500).json({ error: "Could not update approval" });
  }
});

export default router;
