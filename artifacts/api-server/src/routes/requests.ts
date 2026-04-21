import { Router, type IRouter } from "express";
import { db, requests } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import {
  CreateRequestBody,
  AdvanceRequestBody,
} from "@workspace/api-zod";
import type { ApprovalStep } from "@workspace/db";

const router: IRouter = Router();

const initialSteps = (): ApprovalStep[] => [
  { name: "Unit Head", status: "pending" },
  { name: "Department Head", status: "pending" },
  { name: "Auto", status: "pending" },
];

router.get("/requests", async (req, res) => {
  const employeeId = req.query.employeeId
    ? Number(req.query.employeeId)
    : undefined;
  const type = req.query.type as string | undefined;
  const conds = [];
  if (employeeId) conds.push(eq(requests.employeeId, employeeId));
  if (type) conds.push(eq(requests.type, type));
  const rows = await db
    .select()
    .from(requests)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(requests.createdAt));
  res.json(rows);
});

router.post("/requests", async (req, res) => {
  const body = CreateRequestBody.parse(req.body);
  const [row] = await db
    .insert(requests)
    .values({
      employeeId: body.employeeId,
      type: body.type,
      title: body.title,
      details: body.details,
      status: "pending",
      currentStep: "Unit Head",
      steps: initialSteps(),
    })
    .returning();
  res.status(201).json(row);
});

router.post("/requests/:id/advance", async (req, res) => {
  const id = Number(req.params.id);
  const body = AdvanceRequestBody.parse(req.body);
  const [existing] = await db
    .select()
    .from(requests)
    .where(eq(requests.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status !== "pending")
    return res.status(400).json({ error: "Already finalized" });

  const steps = [...(existing.steps as ApprovalStep[])];
  const idx = steps.findIndex((s) => s.status === "pending");
  if (idx < 0) return res.status(400).json({ error: "No pending step" });

  const ts = new Date().toISOString();
  if (body.decision === "reject") {
    steps[idx] = {
      ...steps[idx]!,
      status: "rejected",
      actor: body.actor ?? null,
      note: body.note ?? null,
      timestamp: ts,
    };
    const [row] = await db
      .update(requests)
      .set({ steps, status: "rejected", currentStep: steps[idx]!.name })
      .where(eq(requests.id, id))
      .returning();
    return res.json(row);
  }

  steps[idx] = {
    ...steps[idx]!,
    status: "approved",
    actor: body.actor ?? null,
    note: body.note ?? null,
    timestamp: ts,
  };

  let status = existing.status;
  let currentStep = existing.currentStep;
  const next = steps.findIndex((s) => s.status === "pending");
  if (next < 0) {
    status = "approved";
    currentStep = "Approved";
  } else if (steps[next]!.name === "Auto") {
    steps[next] = {
      ...steps[next]!,
      status: "approved",
      actor: "system",
      note: "Auto-approved",
      timestamp: ts,
    };
    status = "approved";
    currentStep = "Approved";
  } else {
    currentStep = steps[next]!.name;
  }

  const [row] = await db
    .update(requests)
    .set({ steps, status, currentStep })
    .where(eq(requests.id, id))
    .returning();
  res.json(row);
});

export default router;
