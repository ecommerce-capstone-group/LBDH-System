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
  status: text("status").notNull().default("pending"),
  currentStep: text("current_step").notNull().default("Employee Self-Assessment"),
  steps: jsonb("steps").$type<ApprovalStep[]>().notNull(),
  employeeSelfAssessment: text("employee_self_assessment").notNull().default(""),
  appraiserComments: text("appraiser_comments").notNull().default(""),
  departmentHeadComments: text("department_head_comments").notNull().default(""),
  hrComments: text("hr_comments").notNull().default(""),
  signedFormReference: text("signed_form_reference").notNull().default(""),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const trainingPlans = pgTable("training_plans", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  trainingHours: real("training_hours").notNull().default(0),
  plannedDate: date("planned_date"),
  department: text("department"),
  employeeId: integer("employee_id").references(() => employees.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull().default("published"),
  currentStep: text("current_step").notNull().default(""),
  steps: jsonb("steps").$type<ApprovalStep[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const trainingEnrollments = pgTable("training_enrollments", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id")
    .notNull()
    .references(() => trainingPlans.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("enrolled"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const trainingRecords = pgTable("training_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  planId: integer("plan_id").references(() => trainingPlans.id, {
    onDelete: "set null",
  }),
  enrollmentId: integer("enrollment_id").references(
    () => trainingEnrollments.id,
    { onDelete: "set null" },
  ),
  trainingName: text("training_name").notNull(),
  trainingDate: date("training_date").notNull(),
  trainingHours: real("training_hours").notNull(),
  trainingType: text("training_type").notNull(),
  completionStatus: text("completion_status").notNull().default("completed"),
  remarks: text("remarks").notNull().default(""),
  contractAgreement: text("contract_agreement").notNull().default(""),
  fileReference: text("file_reference").notNull().default(""),
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
