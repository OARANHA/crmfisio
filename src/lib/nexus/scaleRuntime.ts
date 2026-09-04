import type { NexusEvidenceSnapshot, NexusRedFlagSeverity, NexusSeverity } from '../nexusClinical';

export type NexusScaleOption = { label: string; value: number };
export type NexusScaleQuestion = {
  id: string;
  text: string;
  instruction?: string;
  subscale?: string;
  options: readonly NexusScaleOption[];
};

export type NexusScaleContextItem = {
  title: string;
  description: string;
  badge?: string;
  tone?: 'neutral' | 'warning' | 'danger';
};

export type NexusScalePearl = {
  type: 'evidence' | 'pearl' | 'pitfall';
  title: string;
  text: string;
  reference?: string;
};

export type NexusScaleRedFlag = {
  flagCode: string;
  severity: NexusRedFlagSeverity;
  title: string;
  message: string;
  requiredAction?: string | null;
};

export type NexusScaleResult = {
  totalScore: number;
  maxScore: number;
  classification: string;
  severity: NexusSeverity;
  interpretation: string;
  recommendations: string[];
  soapText: string;
  answersArray: number[];
  structuredData?: Record<string, unknown>;
  redFlags?: NexusScaleRedFlag[];
};

export type NexusScaleDefinition = {
  toolKey: string;
  moduleKey: string;
  ruleKey: string;
  ruleVersion: string;
  requiredCapability: string;
  title: string;
  acronym: string;
  targetGroup: string;
  description: string;
  instructions: string;
  referenceCitation: string;
  validationInfo: string;
  cutoffInfo: string;
  estimatedMinutes: number;
  questions: readonly NexusScaleQuestion[];
  evidence: readonly NexusEvidenceSnapshot[];
  clinicalConduct: readonly NexusScaleContextItem[];
  monitoringGoals: readonly NexusScaleContextItem[];
  clinicalPearls: readonly NexusScalePearl[];
  calculate: (answers: Record<string, number>) => NexusScaleResult;
};

export function isScaleComplete(definition: NexusScaleDefinition, answers: Record<string, number>): boolean {
  return definition.questions.every((question) => {
    const value = answers[question.id];
    return question.options.some((option) => option.value === value);
  });
}

export function calculateScale(definition: NexusScaleDefinition, answers: Record<string, number>): NexusScaleResult {
  if (!isScaleComplete(definition, answers)) {
    throw new Error(`${definition.acronym} incompleto: responda todos os itens antes do cálculo final.`);
  }
  return definition.calculate(answers);
}
