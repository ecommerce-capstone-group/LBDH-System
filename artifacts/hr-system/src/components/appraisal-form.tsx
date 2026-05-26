import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  APPRAISAL_TEMPLATES,
  APPRAISAL_TYPES,
  allCriteriaForTemplate,
  maxPossibleTotal,
  type AppraisalTemplateType,
} from "@workspace/db/appraisal-templates";
import type { AppraisalInput, Employee } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const SUPERVISORY_ROLE_PATTERN =
  /\b(manager|supervisor|head|chief|director|superintendent|administrator)\b/i;

function inferTemplateType(role: string): AppraisalTemplateType {
  return SUPERVISORY_ROLE_PATTERN.test(role) ? "supervisory" : "non_supervisory";
}

type AppraisalFormProps = {
  employees: Employee[];
  defaultEvaluator?: string;
  initialEmployeeId?: number;
  onSubmit: (data: AppraisalInput) => Promise<void>;
  onCancel: () => void;
  isPending?: boolean;
};

export function AppraisalForm({
  employees,
  defaultEvaluator = "",
  initialEmployeeId,
  onSubmit,
  onCancel,
  isPending,
}: AppraisalFormProps) {
  const [employeeId, setEmployeeId] = useState(
    initialEmployeeId ? String(initialEmployeeId) : "",
  );
  const [templateType, setTemplateType] = useState<AppraisalTemplateType>("non_supervisory");
  const [appraisalType, setAppraisalType] = useState<string>(APPRAISAL_TYPES[0]);
  const [employeeName, setEmployeeName] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [appraisalPeriod, setAppraisalPeriod] = useState("");
  const [evaluator, setEvaluator] = useState(defaultEvaluator);
  const [evaluatorPosition, setEvaluatorPosition] = useState("");
  const [appraisalDate, setAppraisalDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [strengths, setStrengths] = useState("");
  const [areasForImprovement, setAreasForImprovement] = useState("");
  const [suggestedActionPlan, setSuggestedActionPlan] = useState("");
  const [shortTermGoals, setShortTermGoals] = useState("");
  const [longTermGoals, setLongTermGoals] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [recommendation, setRecommendation] = useState("");
  const [employeeAcknowledgement, setEmployeeAcknowledgement] = useState("");
  const [signatoryNames, setSignatoryNames] = useState<Record<string, string>>({});

  const template = APPRAISAL_TEMPLATES[templateType];
  const criteria = useMemo(() => allCriteriaForTemplate(template), [template]);
  const maxTotal = useMemo(() => maxPossibleTotal(template), [template]);

  const liveTotal = useMemo(() => {
    return criteria.reduce((sum, c) => {
      const v = Number(scores[c.id]);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
  }, [criteria, scores]);

  useEffect(() => {
    if (!employeeId) return;
    const emp = employees.find((e) => String(e.id) === employeeId);
    if (!emp) return;
    setEmployeeName(emp.name);
    setDepartment(emp.department);
    setPosition(emp.role);
    setTemplateType(inferTemplateType(emp.role));
    if (!hireDate && emp.createdAt) {
      setHireDate(new Date(emp.createdAt).toISOString().slice(0, 10));
    }
  }, [employeeId, employees, hireDate]);

  useEffect(() => {
    setSignatoryNames((prev) => {
      const next = { ...prev };
      for (const role of template.signatoryRoles) {
        if (next[role] === undefined) next[role] = "";
      }
      if (template.signatoryRoles.includes("Appraiser") && evaluator && !prev["Appraiser"]) {
        next["Appraiser"] = evaluator;
      }
      if (template.signatoryRoles.includes("Employee") && employeeName && !prev["Employee"]) {
        next["Employee"] = employeeName;
      }
      return next;
    });
  }, [template.signatoryRoles, evaluator, employeeName]);

  const handleScoreChange = (criterionId: string, value: string) => {
    setScores((prev) => ({ ...prev, [criterionId]: value }));
  };

  const handleSubmit = async () => {
    const eid = Number(employeeId);
    if (!employeeId || Number.isNaN(eid)) {
      throw new Error("Choose an employee.");
    }
    if (!employeeName.trim() || !department.trim() || !position.trim()) {
      throw new Error("Employee information is required.");
    }
    if (!appraisalPeriod.trim()) {
      throw new Error("Appraisal period is required.");
    }
    if (!evaluator.trim() || !evaluatorPosition.trim()) {
      throw new Error("Evaluator name and position are required.");
    }

    const criterionScores = criteria.map((c) => {
      const group = template.criterionGroups.find((g) =>
        g.criteria.some((cr) => cr.id === c.id),
      )!;
      const score = Number(scores[c.id]);
      if (!Number.isFinite(score) || score < 1 || score > template.maxScore) {
        throw new Error(
          `"${c.label}" must be scored between 1 and ${template.maxScore}.`,
        );
      }
      return {
        criterionId: c.id,
        groupId: group.id,
        label: c.label,
        score,
      };
    });

    const signatories = template.signatoryRoles.map((role) => ({
      role,
      name: (signatoryNames[role] ?? "").trim(),
    }));

    await onSubmit({
      employeeId: eid,
      templateType,
      appraisalType,
      employeeName: employeeName.trim(),
      department: department.trim(),
      position: position.trim(),
      hireDate: hireDate || null,
      appraisalPeriod: appraisalPeriod.trim(),
      evaluator: evaluator.trim(),
      evaluatorPosition: evaluatorPosition.trim(),
      appraisalDate: appraisalDate || null,
      strengths: strengths.trim(),
      areasForImprovement: areasForImprovement.trim(),
      suggestedActionPlan: suggestedActionPlan.trim(),
      shortTermGoals: shortTermGoals.trim(),
      longTermGoals: longTermGoals.trim(),
      criterionScores,
      recommendation: recommendation.trim(),
      employeeAcknowledgement: employeeAcknowledgement.trim(),
      signatories,
    });
  };

  return (
    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="ap-emp">Employee *</Label>
          <select
            id="ap-emp"
            className={selectClass}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">Select employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={String(e.id)}>
                {e.name} — {e.role}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ap-template">Form template</Label>
          <select
            id="ap-template"
            className={selectClass}
            value={templateType}
            onChange={(e) =>
              setTemplateType(e.target.value as AppraisalTemplateType)
            }
          >
            <option value="non_supervisory">Non-Supervisory (1–15)</option>
            <option value="supervisory">Supervisory / Managerial (1–10)</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Auto-selected from role; change if needed.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ap-type">Appraisal type *</Label>
          <select
            id="ap-type"
            className={selectClass}
            value={appraisalType}
            onChange={(e) => setAppraisalType(e.target.value)}
          >
            {APPRAISAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Employee Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Name *</Label>
            <Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Department *</Label>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Position *</Label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Hire date</Label>
            <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Appraisal period *</Label>
            <Input
              value={appraisalPeriod}
              onChange={(e) => setAppraisalPeriod(e.target.value)}
              placeholder="e.g. Jan 2026 – Mar 2026"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Appraiser Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Evaluator *</Label>
            <Input value={evaluator} onChange={(e) => setEvaluator(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Evaluator position *</Label>
            <Input
              value={evaluatorPosition}
              onChange={(e) => setEvaluatorPosition(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Appraisal date</Label>
            <Input
              type="date"
              value={appraisalDate}
              onChange={(e) => setAppraisalDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            A. Strengths &amp; Areas for Improvement
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>Strengths</Label>
            <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3} />
          </div>
          <div className="grid gap-2">
            <Label>Areas requiring improvement</Label>
            <Textarea
              value={areasForImprovement}
              onChange={(e) => setAreasForImprovement(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label>Suggested action plan</Label>
            <Textarea
              value={suggestedActionPlan}
              onChange={(e) => setSuggestedActionPlan(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">B. Employee Development Goals</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>Short-term goals (6–12 months)</Label>
            <Textarea
              value={shortTermGoals}
              onChange={(e) => setShortTermGoals(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label>Long-term goals (1–3 years)</Label>
            <Textarea
              value={longTermGoals}
              onChange={(e) => setLongTermGoals(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {templateType === "non_supervisory" ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              C. Performance Criteria (1–{template.maxScore})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {template.criterionGroups.map((group) => (
              <div key={group.id}>
                <h4 className="font-medium text-sm text-gray-700 mb-3">{group.title}</h4>
                <div className="space-y-3">
                  {group.criteria.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between"
                    >
                      <Label className="sm:flex-1 font-normal">{c.label}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={template.maxScore}
                        step={1}
                        className="w-full sm:w-24"
                        value={scores[c.id] ?? ""}
                        onChange={(e) => handleScoreChange(c.id, e.target.value)}
                        placeholder={`1–${template.maxScore}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        template.criterionGroups.map((group, index) => {
          const sectionLetter = String.fromCharCode(67 + index);
          return (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {sectionLetter}. {group.title} (1–{template.maxScore})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {group.criteria.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between"
                  >
                    <Label className="sm:flex-1 font-normal">{c.label}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={template.maxScore}
                      step={1}
                      className="w-full sm:w-24"
                      value={scores[c.id] ?? ""}
                      onChange={(e) => handleScoreChange(c.id, e.target.value)}
                      placeholder={`1–${template.maxScore}`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="flex justify-between items-center font-semibold text-emerald-700">
            <span>Total score</span>
            <span>
              {liveTotal} / {maxTotal}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {templateType === "supervisory" ? "H. " : "D. "}
            Recommendation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            rows={3}
            placeholder="Recommendation for continued employment, regularization, etc."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {templateType === "supervisory" ? "I. " : "E. "}
            Employee Acknowledgement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={employeeAcknowledgement}
            onChange={(e) => setEmployeeAcknowledgement(e.target.value)}
            rows={2}
            placeholder="Employee comments or acknowledgement statement"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Signatories</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {template.signatoryRoles.map((role) => (
            <div key={role} className="grid gap-2">
              <Label>{role}</Label>
              <Input
                value={signatoryNames[role] ?? ""}
                onChange={(e) =>
                  setSignatoryNames((prev) => ({ ...prev, [role]: e.target.value }))
                }
                placeholder={`Name — ${role}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 sticky bottom-0 bg-background py-3 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={isPending}
          onClick={() => {
            handleSubmit().catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : "Could not save appraisal.");
            });
          }}
        >
          {isPending ? "Saving…" : "Save appraisal"}
        </Button>
      </div>
    </div>
  );
}

export function AppraisalDetailView({ appraisal }: { appraisal: import("@workspace/api-client-react").Appraisal }) {
  const template = APPRAISAL_TEMPLATES[appraisal.templateType];
  const maxTotal = maxPossibleTotal(template);

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 text-sm">
      <div className="grid sm:grid-cols-2 gap-2">
        <p>
          <span className="text-gray-500">Form:</span> {template.label}
        </p>
        <p>
          <span className="text-gray-500">Type:</span> {appraisal.appraisalType}
        </p>
        <p>
          <span className="text-gray-500">Employee:</span> {appraisal.employeeName}
        </p>
        <p>
          <span className="text-gray-500">Department:</span> {appraisal.department}
        </p>
        <p>
          <span className="text-gray-500">Position:</span> {appraisal.position}
        </p>
        <p>
          <span className="text-gray-500">Period:</span> {appraisal.appraisalPeriod}
        </p>
        <p>
          <span className="text-gray-500">Evaluator:</span> {appraisal.evaluator} (
          {appraisal.evaluatorPosition})
        </p>
        <p className="font-semibold text-emerald-700">
          Total: {appraisal.totalScore} / {maxTotal}
        </p>
      </div>

      {appraisal.strengths ? (
        <div>
          <p className="font-medium">Strengths</p>
          <p className="text-gray-600 whitespace-pre-wrap">{appraisal.strengths}</p>
        </div>
      ) : null}

      {appraisal.areasForImprovement ? (
        <div>
          <p className="font-medium">Areas for improvement</p>
          <p className="text-gray-600 whitespace-pre-wrap">
            {appraisal.areasForImprovement}
          </p>
        </div>
      ) : null}

      <div>
        <p className="font-medium mb-2">Criterion scores</p>
        <div className="rounded border divide-y">
          {appraisal.criterionScores.map((c) => (
            <div key={c.criterionId} className="flex justify-between px-3 py-2">
              <span>{c.label}</span>
              <span className="font-medium">
                {c.score}/{template.maxScore}
              </span>
            </div>
          ))}
        </div>
      </div>

      {appraisal.recommendation ? (
        <div>
          <p className="font-medium">Recommendation</p>
          <p className="text-gray-600 whitespace-pre-wrap">{appraisal.recommendation}</p>
        </div>
      ) : null}

      <div>
        <p className="font-medium mb-2">Signatories</p>
        <ul className="space-y-1">
          {appraisal.signatories.map((s) => (
            <li key={s.role}>
              <span className="text-gray-500">{s.role}:</span> {s.name || "—"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
