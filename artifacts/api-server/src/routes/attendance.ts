import { Router, type IRouter } from "express";
import { db, attendance } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { CreateAttendanceBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/attendance", async (req, res) => {
  const employeeId = req.query.employeeId
    ? Number(req.query.employeeId)
    : undefined;
  const rows = await db
    .select()
    .from(attendance)
    .where(employeeId ? eq(attendance.employeeId, employeeId) : undefined)
    .orderBy(desc(attendance.date));
  res.json(rows);
});

router.get("/attendance/summary", async (req, res) => {
  const employeeId = req.query.employeeId
    ? Number(req.query.employeeId)
    : undefined;
  const where = employeeId ? eq(attendance.employeeId, employeeId) : undefined;
  const [row] = await db
    .select({
      presentDays: sql<number>`coalesce(sum(case when status = 'Present' then 1 else 0 end), 0)::int`,
      absentDays: sql<number>`coalesce(sum(case when status = 'Absent' then 1 else 0 end), 0)::int`,
      lateCount: sql<number>`coalesce(sum(case when late_minutes > 0 then 1 else 0 end), 0)::int`,
      totalLateMinutes: sql<number>`coalesce(sum(late_minutes), 0)::int`,
      totalUndertimeMinutes: sql<number>`coalesce(sum(undertime_minutes), 0)::int`,
      totalOvertimeMinutes: sql<number>`coalesce(sum(overtime_minutes), 0)::int`,
    })
    .from(attendance)
    .where(where);
  res.json(
    row ?? {
      presentDays: 0,
      absentDays: 0,
      lateCount: 0,
      totalLateMinutes: 0,
      totalUndertimeMinutes: 0,
      totalOvertimeMinutes: 0,
    },
  );
});

router.post("/attendance", async (req, res) => {
  const body = CreateAttendanceBody.parse(req.body);
  const [row] = await db
    .insert(attendance)
    .values({
      employeeId: body.employeeId,
      date: body.date,
      status: body.status,
      lateMinutes: body.lateMinutes ?? 0,
      undertimeMinutes: body.undertimeMinutes ?? 0,
      overtimeMinutes: body.overtimeMinutes ?? 0,
      notes: body.notes ?? null,
    })
    .returning();
  res.status(201).json(row);
});

export default router;
