import { Router, type IRouter } from "express";
import { db, employees } from "@workspace/db";
import { eq, and, or, ilike, isNotNull, gte, lte } from "drizzle-orm";
import {
  CreateEmployeeBody,
  UpdateEmployeeBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/employees", async (req, res) => {
  const search = (req.query.search as string | undefined)?.trim();
  const department = (req.query.department as string | undefined)?.trim();

  const conds = [] as ReturnType<typeof eq>[];
  if (search) {
    conds.push(
      or(
        ilike(employees.name, `%${search}%`),
        ilike(employees.role, `%${search}%`),
        ilike(employees.email, `%${search}%`),
      )!,
    );
  }
  if (department) conds.push(eq(employees.department, department));

  const rows = await db
    .select()
    .from(employees)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(employees.name);
  res.json(rows);
});

router.get("/employees/expiring-licenses", async (req, res) => {
  const days = req.query.days ? Number(req.query.days) : 30;
  const today = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days);
  const todayStr = today.toISOString().slice(0, 10);
  const futureStr = future.toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(employees)
    .where(
      and(
        isNotNull(employees.licenseExpiry),
        gte(employees.licenseExpiry, todayStr),
        lte(employees.licenseExpiry, futureStr),
      ),
    )
    .orderBy(employees.licenseExpiry);
  res.json(rows);
});

router.get("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(employees).where(eq(employees.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.post("/employees", async (req, res) => {
  const body = CreateEmployeeBody.parse(req.body);
  const [row] = await db
    .insert(employees)
    .values({
      name: body.name,
      role: body.role,
      department: body.department,
      email: body.email,
      phone: body.phone ?? null,
      licenseName: body.licenseName ?? null,
      licenseExpiry: body.licenseExpiry ?? null,
      documents: body.documents ?? null,
      vlBalance: body.vlBalance ?? 15,
      slBalance: body.slBalance ?? 15,
      status: body.status ?? "active",
    })
    .returning();
  res.status(201).json(row);
});

router.patch("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = UpdateEmployeeBody.parse(req.body);
  const [row] = await db
    .update(employees)
    .set({
      name: body.name,
      role: body.role,
      department: body.department,
      email: body.email,
      phone: body.phone ?? null,
      licenseName: body.licenseName ?? null,
      licenseExpiry: body.licenseExpiry ?? null,
      documents: body.documents ?? null,
      ...(body.vlBalance != null ? { vlBalance: body.vlBalance } : {}),
      ...(body.slBalance != null ? { slBalance: body.slBalance } : {}),
      ...(body.status ? { status: body.status } : {}),
    })
    .where(eq(employees.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.delete("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(employees).where(eq(employees.id, id));
  res.status(204).end();
});

export default router;
