import {
  getPublicSelfAssessmentDefinition,
  type PublicSelfAssessmentOption,
  type PublicSelfAssessmentQuestion,
} from './publicSelfAssessmentCatalog';

export type ClinicianAssistedInstrumentDefinition = {
  toolKey: 'phq9' | 'gad7' | 'phq15';
  ruleVersion: string;
  acronym: string;
  instructions: string;
  questions: PublicSelfAssessmentQuestion[];
};

const PHQ15_OPTIONS: PublicSelfAssessmentOption[] = [
  { label: 'Nem um pouco', value: 0 },
  { label: 'Incomodou um pouco', value: 1 },
  { label: 'Incomodou muito', value: 2 },
];

const PHQ15: ClinicianAssistedInstrumentDefinition = {
  toolKey: 'phq15',
  ruleVersion: 'nexus-phq15-2026-09-13',
  acronym: 'PHQ-15',
  instructions: 'Para cada sintoma abaixo, registre o quanto ele incomodou o paciente nas últimas 4 semanas. No item menstrual, quando não se aplicar, registre 0.',
  questions: [
    { id: 'q1', text: '1. Dores de estômago ou abdominais', options: PHQ15_OPTIONS },
    { id: 'q2', text: '2. Dor nas costas ou coluna', options: PHQ15_OPTIONS },
    { id: 'q3', text: '3. Dor nos braços, pernas ou articulações', options: PHQ15_OPTIONS },
    { id: 'q4', text: '4. Dores ou cólicas menstruais (ou outros problemas no período), quando aplicável', options: PHQ15_OPTIONS },
    { id: 'q5', text: '5. Dores de cabeça', options: PHQ15_OPTIONS },
    { id: 'q6', text: '6. Dor no peito ou aperto precordial', options: PHQ15_OPTIONS },
    { id: 'q7', text: '7. Tonturas ou instabilidade', options: PHQ15_OPTIONS },
    { id: 'q8', text: '8. Desmaios ou sensação de apagar', options: PHQ15_OPTIONS },
    { id: 'q9', text: '9. Coração batendo rápido ou acelerado (palpitações)', options: PHQ15_OPTIONS },
    { id: 'q10', text: '10. Falta de ar ou respiração curta', options: PHQ15_OPTIONS },
    { id: 'q11', text: '11. Dor ou desconforto durante a relação sexual', options: PHQ15_OPTIONS },
    { id: 'q12', text: '12. Prisão de ventre ou intestino solto (diarreia)', options: PHQ15_OPTIONS },
    { id: 'q13', text: '13. Náuseas, indigestão ou empachamento', options: PHQ15_OPTIONS },
    { id: 'q14', text: '14. Sentir-se cansado(a) ou com pouca energia', options: PHQ15_OPTIONS },
    { id: 'q15', text: '15. Problemas para dormir', options: PHQ15_OPTIONS },
  ],
};

export function getClinicianAssistedInstrumentDefinition(
  toolKey: string | undefined,
): ClinicianAssistedInstrumentDefinition | null {
  if (!toolKey) return null;
  if (toolKey === 'phq15') return PHQ15;
  const publicDefinition = getPublicSelfAssessmentDefinition(toolKey);
  return publicDefinition as ClinicianAssistedInstrumentDefinition | null;
}
