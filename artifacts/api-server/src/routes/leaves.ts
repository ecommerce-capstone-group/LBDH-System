import { Router, type IRouter } from "express";
import { db, leaves, employees } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  CreateLeaveBody,
  AdvanceLeaveBody,
} from "@workspace/api-zod";
import type { ApprovalStep } from "@workspace/db";

const router: IRouter = Router();

const initialSteps = (): ApprovalStep[] => [
  { name: "Unit Head", status: "pending" },
  { name: "Department Head", status: "pending" },
  { name: "Auto", status: "pending" },
];

router.get("/leaves", async (req, res) => {
  const employeeId = req.query.employeeId
    ? Number(req.query.employeeId)
    : undefined;
  const rows = await db
    .select()
    .from(leaves)
    .where(employeeId ? eq(leaves.employeeId, employeeId) : undefined)
    .orderBy(desc(leaves.createdAt));
  res.json(rows);
});

router.post("/leaves", async (req, res) => {
  const body = CreateLeaveBody.parse(req.body);
  const [row] = await db
    .insert(leaves)
    .values({
      employeeId: body.employeeId,
      leaveType: body.leaveType,
      startDate: body.startDate,
      endDate: body.endDate,
      days: body.days,
      reason: body.reason,
      status: "pending",
      currentStep: "Unit Head",
      steps: initialSteps(),
    })
    .returning();
  res.status(201).json(row);
});

router.post("/leaves/:id/advance", async (req, res) => {
  const id = Number(req.params.id);
  const body = AdvanceLeaveBody.parse(req.body);
  const [existing] = await db.select().from(leaves).where(eq(leaves.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status !== "pending") {
    return res.status(400).json({ error: "Already finalized" });
  }

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
      .update(leaves)
      .set({ steps, status: "rejected", currentStep: steps[idx]!.name })
      .where(eq(leaves.id, id))
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

  if (status === "approved") {
    const field = existing.leaveType === "VL" ? "vlBalance" : "slBalance";
    await db
      .update(employees)
      .set({
        [field]: sql`${
          field === "vlBalance" ? employees.vlBalance : employees.slBalance
        } - ${existing.days}`,
      })
      .where(eq(employees.id, existing.employeeId));
  }

  const [row] = await db
    .update(leaves)
    .set({ steps, status, currentStep })
    .where(eq(leaves.id, id))
    .returning();
  res.json(row);
});

router.get("/leaves/balances/:employeeId", async (req, res) => {
  const employeeId = Number(req.params.employeeId);
  const [emp] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId));
  if (!emp) return res.status(404).json({ error: "Not found" });

  const used = await db
    .select({
      leaveType: leaves.leaveType,
      total: sql<number>`coalesce(sum(days), 0)::float`,
    })
    .from(leaves)
    .where(eq(leaves.employeeId, employeeId))
    .groupBy(leaves.leaveType);

  const vlUsed =
    used.find((u) => u.leaveType === "VL" && true)?.total ?? 0;
  const slUsed = used.find((u) => u.leaveType === "SL")?.total ?? 0;

  res.json({
    employeeId,
    vlBalance: emp.vlBalance,
    slBalance: emp.slBalance,
    vlUsed,
    slUsed,
  });
});

export default router;
