export type AppraisalTemplateType = "non_supervisory" | "supervisory";

export type AppraisalCriterion = {
  id: string;
  label: string;
};

export type AppraisalCriterionGroup = {
  id: string;
  title: string;
  criteria: AppraisalCriterion[];
};

export type AppraisalTemplate = {
  type: AppraisalTemplateType;
  label: string;
  maxScore: number;
  appraisalTypes: readonly string[];
  criterionGroups: AppraisalCriterionGroup[];
  signatoryRoles: readonly string[];
};

export const APPRAISAL_TYPES = [
  "2nd month",
  "3rd month",
  "5th month",
  "Other",
] as const;

export const NON_SUPERVISORY_TEMPLATE: AppraisalTemplate = {
  type: "non_supervisory",
  label: "Non-Supervisory Appraisal",
  maxScore: 15,
  appraisalTypes: APPRAISAL_TYPES,
  criterionGroups: [
    {
      id: "performance_metrics",
      title: "Performance Metrics",
      criteria: [
        { id: "quality_of_work", label: "Quality of Work" },
        { id: "quantity_of_work", label: "Quantity of Work" },
        { id: "development_potential", label: "Development Potential" },
      ],
    },
    {
      id: "behavioral_standards",
      title: "Behavioral Standards",
      criteria: [
        { id: "teamwork_cooperation", label: "Teamwork & Cooperation" },
        { id: "personal_appearance", label: "Personal Appearance" },
        { id: "openness", label: "Openness" },
        { id: "dependability", label: "Dependability" },
      ],
    },
    {
      id: "compliance",
      title: "Compliance",
      criteria: [
        { id: "regularity_punctuality", label: "Regularity & Punctuality" },
        {
          id: "compliance_hospital_regulations",
          label: "Compliance to Hospital Regulations",
        },
      ],
    },
  ],
  signatoryRoles: ["Department Head", "HR", "Employee"],
};

export const SUPERVISORY_TEMPLATE: AppraisalTemplate = {
  type: "supervisory",
  label: "Supervisory / Managerial Appraisal",
  maxScore: 10,
  appraisalTypes: APPRAISAL_TYPES,
  criterionGroups: [
    {
      id: "core_competencies",
      title: "Core Competencies",
      criteria: [
        {
          id: "leadership_emotional_intelligence",
          label: "Leadership & Emotional Intelligence",
        },
        {
          id: "communication_interpersonal",
          label: "Communication & Interpersonal Skills",
        },
        {
          id: "problem_solving_decision_making",
          label: "Problem Solving & Decision Making",
        },
        { id: "ethics_compliance", label: "Ethics & Compliance" },
      ],
    },
    {
      id: "performance_metrics",
      title: "Performance Metrics",
      criteria: [
        { id: "quantity_of_work", label: "Quantity of Work" },
        { id: "timeliness", label: "Timeliness" },
      ],
    },
    {
      id: "behavioral_standards",
      title: "Behavioral Standards",
      criteria: [
        { id: "team_collaboration", label: "Team Collaboration" },
        { id: "accountability", label: "Accountability" },
        { id: "dependability", label: "Dependability" },
      ],
    },
    {
      id: "supervisory_skills",
      title: "Supervisory Skills",
      criteria: [
        { id: "team_development", label: "Team Development" },
        { id: "resource_management", label: "Resource Management" },
        { id: "innovation_initiative", label: "Innovation & Initiative" },
      ],
    },
    {
      id: "compliance",
      title: "Compliance",
      criteria: [
        { id: "punctuality_attendance", label: "Punctuality & Attendance" },
        { id: "policy_enforcement", label: "Policy Enforcement" },
      ],
    },
  ],
  signatoryRoles: ["HR", "Supervisor/Manager"],
};

export const APPRAISAL_TEMPLATES: Record<
  AppraisalTemplateType,
  AppraisalTemplate
> = {
  non_supervisory: NON_SUPERVISORY_TEMPLATE,
  supervisory: SUPERVISORY_TEMPLATE,
};

export function getAppraisalTemplate(
  type: AppraisalTemplateType,
): AppraisalTemplate {
  return APPRAISAL_TEMPLATES[type];
}

export function allCriteriaForTemplate(
  template: AppraisalTemplate,
): AppraisalCriterion[] {
  return template.criterionGroups.flatMap((g) => g.criteria);
}

export function maxPossibleTotal(template: AppraisalTemplate): number {
  const count = allCriteriaForTemplate(template).length;
  return count * template.maxScore;
}

export type AppraisalWorkflowStepInfo = {
  name: string;
  description: string;
};

/** LBDH form routing order (signatures / review steps). */
export const APPRAISAL_WORKFLOW: Record<
  AppraisalTemplateType,
  readonly AppraisalWorkflowStepInfo[]
> = {
  non_supervisory: [
    {
      name: "Appraiser Evaluation",
      description:
        "Final scores, strengths, areas for improvement, action plans, goals, recommendations",
    },
    {
      name: "Department Head Review & Signature",
      description: "Department Head reviews and signs",
    },
    {
      name: "HR Department Review & Signature",
      description: "Final HR signatory",
    },
    {
      name: "Employee Acknowledgement & Signature",
      description:
        "Employee acknowledges the evaluation was discussed with them",
    },
  ],
  supervisory: [
    {
      name: "Employee Self-Assessment",
      description: "Supervisor/Manager self-assessment",
    },
    {
      name: "Appraiser Evaluation",
      description: "Appraiser completes the evaluation",
    },
    {
      name: "HR Department Review & Signature",
      description: "Final HR signatory (no Department Head on this form)",
    },
    {
      name: "Supervisor/Manager Acknowledgement & Signature",
      description: "Supervisor/Manager acknowledgement signature",
    },
  ],
};

export function appraisalWorkflowSteps(
  type: AppraisalTemplateType,
): { name: string; status: "pending" }[] {
  return APPRAISAL_WORKFLOW[type].map((s) => ({
    name: s.name,
    status: "pending" as const,
  }));
}
