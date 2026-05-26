import {
  getAppraisalTemplate,
  allCriteriaForTemplate,
  type AppraisalTemplateType,
} from "@workspace/db/appraisal-templates";
import type { AppraisalCriterionScore } from "@workspace/db";

export function validateAndComputeAppraisal(
  templateType: AppraisalTemplateType,
  criterionScores: AppraisalCriterionScore[],
): { criterionScores: AppraisalCriterionScore[]; totalScore: number } {
  const template = getAppraisalTemplate(templateType);
  const expected = allCriteriaForTemplate(template);
  const expectedIds = new Set(expected.map((c) => c.id));

  if (criterionScores.length !== expected.length) {
    throw new Error(
      `Expected ${expected.length} criterion scores, got ${criterionScores.length}.`,
    );
  }

  const seen = new Set<string>();
  let totalScore = 0;

  for (const entry of criterionScores) {
    if (!expectedIds.has(entry.criterionId)) {
      throw new Error(`Unknown criterion: ${entry.criterionId}`);
    }
    if (seen.has(entry.criterionId)) {
      throw new Error(`Duplicate criterion: ${entry.criterionId}`);
    }
    seen.add(entry.criterionId);

    if (
      !Number.isFinite(entry.score) ||
      entry.score < 1 ||
      entry.score > template.maxScore
    ) {
      throw new Error(
        `Score for "${entry.label}" must be between 1 and ${template.maxScore}.`,
      );
    }
    totalScore += entry.score;
  }

  for (const id of expectedIds) {
    if (!seen.has(id)) {
      throw new Error(`Missing score for criterion: ${id}`);
    }
  }

  return { criterionScores, totalScore };
}
