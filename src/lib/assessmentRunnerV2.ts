import type { AssessmentBodyPoint, AssessmentTemplateSchema } from './assessmentEngine';

const answered = (value: unknown) => Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== '';

export function assessmentProgress(schema: AssessmentTemplateSchema, answers: Record<string, unknown>, bodyPoints: AssessmentBodyPoint[]) {
  const sections = schema.sections.map((section) => {
    const fields = section.components.filter((component) => !['heading', 'info'].includes(component.type));
    const complete = fields.filter((component) => component.type === 'body_map'
      ? bodyPoints.some((point) => point.componentKey === component.key)
      : answered(answers[component.key])).length;
    const requiredMissing = fields.filter((component) => component.required && (component.type === 'body_map'
      ? !bodyPoints.some((point) => point.componentKey === component.key)
      : !answered(answers[component.key]))).map((component) => component.key);
    return { key: section.key, total: fields.length, complete, requiredMissing };
  });
  return {
    total: sections.reduce((sum, section) => sum + section.total, 0),
    complete: sections.reduce((sum, section) => sum + section.complete, 0),
    sections,
    firstRequiredSection: sections.findIndex((section) => section.requiredMissing.length > 0),
  };
}
