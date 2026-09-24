import { Router, type IRouter } from "express";
import { db, leaves, employees } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  CreateLeaveBody,
  AdvanceLeaveBody,
} from "@workspace/api-zod";
import type { ApprovalStep } from "@workspace/db";

const router: IRouter = Router();

function balanceFieldForType(leaveType: string): "vlBalance" | "slBalance" | null {
  if (leaveType === "VL") return "vlBalance";
  if (leaveType === "SL") return "slBalance";
  return null;
}

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

  if (body.days <= 0) {
    return res.status(400).json({ error: "Leave days must be greater than zero" });
  }

  const [emp] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, body.employeeId));
  if (!emp) {
    return res.status(404).json({ error: "Employee not found" });
  }

  // Enforce remaining balance for VL / SL at request time.
  // Balance is not deducted until the request is fully approved.
  const field = balanceFieldForType(body.leaveType);
  if (field) {
    const remaining = field === "vlBalance" ? emp.vlBalance : emp.slBalance;
    if (body.days > remaining) {
      return res.status(400).json({
        error: `Insufficient ${body.leaveType} balance. Remaining: ${remaining} day(s), requested: ${body.days} day(s).`,
        leaveType: body.leaveType,
        remaining,
        requested: body.days,
      });
    }
  }

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
    // Rejected requests never deduct leave balance.
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

  // Deduct VL/SL only when the request reaches final approval.
  // Pending and rejected requests never change balances.
  if (status === "approved") {
    const field = balanceFieldForType(existing.leaveType);
    if (field) {
      const [emp] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, existing.employeeId));
      if (!emp) {
        return res.status(404).json({ error: "Employee not found" });
      }
      const remaining = field === "vlBalance" ? emp.vlBalance : emp.slBalance;
      if (existing.days > remaining) {
        return res.status(400).json({
          error: `Cannot approve: insufficient ${existing.leaveType} balance. Remaining: ${remaining} day(s), requested: ${existing.days} day(s).`,
          leaveType: existing.leaveType,
          remaining,
          requested: existing.days,
        });
      }

      await db
        .update(employees)
        .set({
          [field]: sql`${
            field === "vlBalance" ? employees.vlBalance : employees.slBalance
          } - ${existing.days}`,
        })
        .where(eq(employees.id, existing.employeeId));
    }
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

  // Used totals count approved leave only — pending/rejected do not reduce balance.
  const used = await db
    .select({
      leaveType: leaves.leaveType,
      total: sql<number>`coalesce(sum(days), 0)::float`,
    })
    .from(leaves)
    .where(
      and(eq(leaves.employeeId, employeeId), eq(leaves.status, "approved")),
    )
    .groupBy(leaves.leaveType);

  const vlUsed = used.find((u) => u.leaveType === "VL")?.total ?? 0;
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
