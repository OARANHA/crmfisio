export type NexusSelfAssessmentScaleKey = 'phq9' | 'gad7';

export const NEXUS_SELF_ASSESSMENT_SCALE_OPTIONS: Array<{
  value: NexusSelfAssessmentScaleKey;
  label: string;
  description: string;
}> = [
  { value: 'phq9', label: 'PHQ-9', description: 'Sintomas depressivos' },
  { value: 'gad7', label: 'GAD-7', description: 'Sintomas de ansiedade' },
];

export function normalizeNexusFunctionError(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim();
    if (message) return message;
  }
  return fallback;
}

export function nexusSelfAssessmentScaleLabel(key: string): string {
  return NEXUS_SELF_ASSESSMENT_SCALE_OPTIONS.find((item) => item.value === key)?.label ?? key.toUpperCase();
}
