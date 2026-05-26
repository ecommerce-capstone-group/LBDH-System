import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  date,
} from "drizzle-orm/pg-core";

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  department: text("department").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  licenseName: text("license_name"),
  licenseExpiry: date("license_expiry"),
  documents: text("documents"),
  vlBalance: real("vl_balance").notNull().default(15),
  slBalance: real("sl_balance").notNull().default(15),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Requirement = {
  label: string;
  kind: "checkbox" | "number";
  weight: number;
  max?: number | null;
};

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  description: text("description").notNull(),
  requirements: jsonb("requirements").$type<Requirement[]>().notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type RequirementMatch = {
  label: string;
  kind: string;
  value: boolean | number;
  score: number;
  weight: number;
};

export const applicants = pgTable("applicants", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  skills: text("skills").notNull(),
  experience: text("experience").notNull(),
  resume: text("resume").notNull(),
  totalScore: real("total_score").notNull(),
  matches: jsonb("matches").$type<RequirementMatch[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  status: text("status").notNull(),
  lateMinutes: integer("late_minutes").notNull().default(0),
  undertimeMinutes: integer("undertime_minutes").notNull().default(0),
  overtimeMinutes: integer("overtime_minutes").notNull().default(0),
  notes: text("notes"),
});

export type ApprovalStep = {
  name: string;
  status: "pending" | "approved" | "rejected";
  actor?: string | null;
  note?: string | null;
  timestamp?: string | null;
};

export const leaves = pgTable("leaves", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  leaveType: text("leave_type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  days: real("days").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  currentStep: text("current_step").notNull().default("Unit Head"),
  steps: jsonb("steps").$type<ApprovalStep[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  details: text("details").notNull(),
  status: text("status").notNull().default("pending"),
  currentStep: text("current_step").notNull().default("Unit Head"),
  steps: jsonb("steps").$type<ApprovalStep[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AppraisalCriterionScore = {
  criterionId: string;
  groupId: string;
  label: string;
  score: number;
};

export type AppraisalSignatory = {
  role: string;
  name: string;
};

export const appraisals = pgTable("appraisals", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  templateType: text("template_type").notNull(),
  appraisalType: text("appraisal_type").notNull(),
  employeeName: text("employee_name").notNull(),
  department: text("department").notNull(),
  position: text("position").notNull(),
  hireDate: date("hire_date"),
  appraisalPeriod: text("appraisal_period").notNull(),
  evaluator: text("evaluator").notNull(),
  evaluatorPosition: text("evaluator_position").notNull(),
  appraisalDate: date("appraisal_date"),
  strengths: text("strengths").notNull().default(""),
  areasForImprovement: text("areas_for_improvement").notNull().default(""),
  suggestedActionPlan: text("suggested_action_plan").notNull().default(""),
  shortTermGoals: text("short_term_goals").notNull().default(""),
  longTermGoals: text("long_term_goals").notNull().default(""),
  criterionScores: jsonb("criterion_scores")
    .$type<AppraisalCriterionScore[]>()
    .notNull(),
  totalScore: real("total_score").notNull(),
  recommendation: text("recommendation").notNull().default(""),
  employeeAcknowledgement: text("employee_acknowledgement")
    .notNull()
    .default(""),
  signatories: jsonb("signatories").$type<AppraisalSignatory[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const grievances = pgTable("grievances", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const offboardings = pgTable("offboardings", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  exitInterview: text("exit_interview").notNull().default(""),
  hrCleared: boolean("hr_cleared").notNull().default(false),
  itCleared: boolean("it_cleared").notNull().default(false),
  financeCleared: boolean("finance_cleared").notNull().default(false),
  status: text("status").notNull().default("Pending"),
  replacementJobId: integer("replacement_job_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
