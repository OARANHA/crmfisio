import type { AssessmentBodyPoint, AssessmentTemplateSchema } from './assessmentEngine';

export const assessmentAnswerPresent = (value: unknown) => Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== '';

export function requiredAssessmentComponentKeys(schema: AssessmentTemplateSchema, answers: Record<string, unknown>, bodyPoints: AssessmentBodyPoint[]) {
  return schema.sections.flatMap((section) => section.components.filter((component) => component.required && component.type !== 'heading' && component.type !== 'info' && (component.type === 'body_map'
    ? !bodyPoints.some((point) => point.componentKey === component.key)
    : !assessmentAnswerPresent(answers[component.key]))).map((component) => component.key));
}

export function assessmentProgress(schema: AssessmentTemplateSchema, answers: Record<string, unknown>, bodyPoints: AssessmentBodyPoint[]) {
  const sections = schema.sections.map((section) => {
    const fields = section.components.filter((component) => !['heading', 'info'].includes(component.type));
    const complete = fields.filter((component) => component.type === 'body_map'
      ? bodyPoints.some((point) => point.componentKey === component.key)
      : assessmentAnswerPresent(answers[component.key])).length;
    const requiredMissing = requiredAssessmentComponentKeys({ sections: [section] }, answers, bodyPoints);
    return { key: section.key, total: fields.length, complete, requiredMissing };
  });
  return {
    total: sections.reduce((sum, section) => sum + section.total, 0),
    complete: sections.reduce((sum, section) => sum + section.complete, 0),
    sections,
    firstRequiredSection: sections.findIndex((section) => section.requiredMissing.length > 0),
  };
}
