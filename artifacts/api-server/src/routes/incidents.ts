import { Router, type IRouter } from "express";
import {
  db,
  employeeIncidents,
  employees,
  appraisals,
  trainingEnrollments,
  trainingPlans,
  trainingRecords,
} from "@workspace/db";
import { eq, desc, and, inArray } from "drizzle-orm";
import {
  CreateIncidentBody,
  UpdateIncidentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/incidents/analytics", async (req, res) => {
  const employeeId = req.query.employeeId
    ? Number(req.query.employeeId)
    : undefined;

  const incidentConds = [];
  if (employeeId && !Number.isNaN(employeeId)) {
    incidentConds.push(eq(employeeIncidents.employeeId, employeeId));
  }

  const incidents = await db
    .select({
      id: employeeIncidents.id,
      employeeId: employeeIncidents.employeeId,
      incidentDate: employeeIncidents.incidentDate,
      policyViolated: employeeIncidents.policyViolated,
      status: employeeIncidents.status,
      relatedAppraisalPeriod: employeeIncidents.relatedAppraisalPeriod,
      employeeName: employees.name,
    })
    .from(employeeIncidents)
    .innerJoin(employees, eq(employeeIncidents.employeeId, employees.id))
    .where(incidentConds.length ? and(...incidentConds) : undefined)
    .orderBy(desc(employeeIncidents.incidentDate));

  const activeIncidents = incidents.filter((i) => i.status === "ongoing").length;
  const resolvedIncidents = incidents.filter((i) => i.status === "resolved").length;

  const policyMap = new Map<string, number>();
  for (const inc of incidents) {
    const key = inc.policyViolated.trim() || "Unspecified";
    policyMap.set(key, (policyMap.get(key) ?? 0) + 1);
  }
  const policyTrends = [...policyMap.entries()]
    .map(([policy, count]) => ({ policy, count }))
    .sort((a, b) => b.count - a.count);

  const violatorMap = new Map<number, { employeeName: string; count: number }>();
  for (const inc of incidents) {
    const cur = violatorMap.get(inc.employeeId) ?? {
      employeeName: inc.employeeName,
      count: 0,
    };
    cur.count += 1;
    violatorMap.set(inc.employeeId, cur);
  }
  const repeatedViolators = [...violatorMap.entries()]
    .filter(([, v]) => v.count >= 2)
    .map(([id, v]) => ({
      employeeId: id,
      employeeName: v.employeeName,
      violationCount: v.count,
    }))
    .sort((a, b) => b.violationCount - a.violationCount);

  const employeeIdsForAppraisal = employeeId
    ? [employeeId]
    : [...new Set(incidents.map((i) => i.employeeId))];

  const appraisalRows =
    employeeIdsForAppraisal.length > 0
      ? await db
          .select()
          .from(appraisals)
          .where(
            employeeId
              ? eq(appraisals.employeeId, employeeId)
              : inArray(appraisals.employeeId, employeeIdsForAppraisal),
          )
      : [];

  const violationVsAppraisal = employeeIdsForAppraisal.map((eid) => {
    const empIncidents = incidents.filter((i) => i.employeeId === eid);
    const empAppraisals = appraisalRows.filter((a) => a.employeeId === eid);
    const avg =
      empAppraisals.length > 0
        ? empAppraisals.reduce((s, a) => s + a.totalScore, 0) / empAppraisals.length
        : null;
    const latest = empAppraisals.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
    return {
      employeeId: eid,
      employeeName:
        empIncidents[0]?.employeeName ??
        empAppraisals[0]?.employeeName ??
        `Employee #${eid}`,
      violationCount: empIncidents.length,
      appraisalCount: empAppraisals.length,
      avgAppraisalScore: avg != null ? Math.round(avg * 10) / 10 : null,
      latestAppraisalPeriod: latest?.appraisalPeriod ?? null,
    };
  }).filter((row) => row.violationCount > 0 || row.appraisalCount > 0);

  const year = new Date().getFullYear();
  const enrollmentConds = [eq(trainingPlans.year, year)];
  if (employeeId && !Number.isNaN(employeeId)) {
    enrollmentConds.push(eq(trainingEnrollments.employeeId, employeeId));
  }

  const enrollmentRows = await db
    .select({
      planId: trainingPlans.id,
      title: trainingPlans.title,
      plannedDate: trainingPlans.plannedDate,
      requiredHours: trainingPlans.trainingHours,
      employeeId: trainingEnrollments.employeeId,
    })
    .from(trainingEnrollments)
    .innerJoin(trainingPlans, eq(trainingEnrollments.planId, trainingPlans.id))
    .where(and(...enrollmentConds));

  const recordConds = [];
  if (employeeId && !Number.isNaN(employeeId)) {
    recordConds.push(eq(trainingRecords.employeeId, employeeId));
  }
  const recordRows = await db
    .select()
    .from(trainingRecords)
    .where(recordConds.length ? and(...recordConds) : undefined);

  const trainingCompliance: {
    planId: number;
    title: string;
    plannedDate: string | null;
    requiredHours: number;
    completedHours: number;
    compliancePercent: number;
    isCompliant: boolean;
  }[] = [];

  for (const row of enrollmentRows) {
    const completed = recordRows
      .filter(
        (r) =>
          r.employeeId === row.employeeId &&
          (r.planId === row.planId ||
            r.trainingName.trim().toLowerCase() ===
              row.title.trim().toLowerCase()),
      )
      .reduce((s, r) => s + (r.trainingHours || 0), 0);
    const required = row.requiredHours || 0;
    trainingCompliance.push({
      planId: row.planId,
      title: row.title,
      plannedDate: row.plannedDate,
      requiredHours: required,
      completedHours: completed,
      compliancePercent:
        required > 0
          ? Math.min(100, Math.round((completed / required) * 100))
          : 0,
      isCompliant: required > 0 ? completed >= required : completed > 0,
    });
  }

  res.json({
    activeIncidents,
    resolvedIncidents,
    repeatedViolators,
    policyTrends,
    violationVsAppraisal,
    trainingCompliance,
  });
});

router.get("/incidents", async (req, res) => {
  const employeeId = req.query.employeeId
    ? Number(req.query.employeeId)
    : undefined;
  const status = req.query.status as string | undefined;
  const conds = [];
  if (employeeId && !Number.isNaN(employeeId)) {
    conds.push(eq(employeeIncidents.employeeId, employeeId));
  }
  if (status) conds.push(eq(employeeIncidents.status, status));

  const rows = await db
    .select()
    .from(employeeIncidents)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(employeeIncidents.incidentDate));
  res.json(rows);
});

router.post("/incidents", async (req, res) => {
  const body = CreateIncidentBody.parse(req.body);
  const [emp] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, body.employeeId));
  if (!emp) return res.status(400).json({ error: "Employee not found" });

  const [row] = await db
    .insert(employeeIncidents)
    .values({
      employeeId: body.employeeId,
      incidentDate: body.incidentDate,
      policyViolated: body.policyViolated,
      violationDescription: body.violationDescription,
      department: body.department ?? emp.department ?? "",
      actionTaken: body.actionTaken,
      actionDetails: body.actionDetails ?? "",
      status: body.status ?? "ongoing",
      hrRemarks: body.hrRemarks ?? "",
      approvingAuthority: body.approvingAuthority ?? "",
      relatedAppraisalPeriod: body.relatedAppraisalPeriod ?? null,
    })
    .returning();
  res.status(201).json(row);
});

router.patch("/incidents/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = UpdateIncidentBody.parse(req.body);
  const [existing] = await db
    .select()
    .from(employeeIncidents)
    .where(eq(employeeIncidents.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  const [row] = await db
    .update(employeeIncidents)
    .set({
      incidentDate: body.incidentDate ?? existing.incidentDate,
      policyViolated: body.policyViolated ?? existing.policyViolated,
      violationDescription:
        body.violationDescription ?? existing.violationDescription,
      department: body.department ?? existing.department,
      actionTaken: body.actionTaken ?? existing.actionTaken,
      actionDetails: body.actionDetails ?? existing.actionDetails,
      status: body.status ?? existing.status,
      hrRemarks: body.hrRemarks ?? existing.hrRemarks,
      approvingAuthority: body.approvingAuthority ?? existing.approvingAuthority,
      relatedAppraisalPeriod:
        body.relatedAppraisalPeriod !== undefined
          ? body.relatedAppraisalPeriod
          : existing.relatedAppraisalPeriod,
    })
    .where(eq(employeeIncidents.id, id))
    .returning();
  res.json(row);
});

export default router;
