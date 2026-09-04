export type PublicSelfAssessmentOption = {
  label: string;
  value: number;
};

export type PublicSelfAssessmentQuestion = {
  id: string;
  text: string;
  options: PublicSelfAssessmentOption[];
};

export type PublicSelfAssessmentDefinition = {
  toolKey: 'phq9' | 'gad7';
  ruleVersion: 'nexus-2026-09-03';
  acronym: 'PHQ-9' | 'GAD-7';
  instructions: string;
  questions: PublicSelfAssessmentQuestion[];
};

const FREQUENCY_OPTIONS: PublicSelfAssessmentOption[] = [
  { label: 'Nenhuma vez', value: 0 },
  { label: 'Vários dias', value: 1 },
  { label: 'Mais da metade dos dias', value: 2 },
  { label: 'Quase todos os dias', value: 3 },
];

const PHQ9: PublicSelfAssessmentDefinition = {
  toolKey: 'phq9',
  ruleVersion: 'nexus-2026-09-03',
  acronym: 'PHQ-9',
  instructions: 'Para cada item abaixo, selecione com que frequência você foi incomodado(a) por esse problema nas últimas 2 semanas.',
  questions: [
    { id: 'q1', text: '1. Pouco interesse ou pouco prazer em fazer as coisas', options: FREQUENCY_OPTIONS },
    { id: 'q2', text: '2. Sentir-se "na pior", deprimido(a) ou sem esperança', options: FREQUENCY_OPTIONS },
    { id: 'q3', text: '3. Dificuldade para adormecer ou permanecer dormindo, ou dormir demais', options: FREQUENCY_OPTIONS },
    { id: 'q4', text: '4. Sentir-se cansado(a) ou com pouca energia', options: FREQUENCY_OPTIONS },
    { id: 'q5', text: '5. Falta de apetite ou comendo demais', options: FREQUENCY_OPTIONS },
    { id: 'q6', text: '6. Sentir-se mal consigo mesmo(a) — ou achar que é um fracasso ou que decepcionou a si mesmo(a) ou sua família', options: FREQUENCY_OPTIONS },
    { id: 'q7', text: '7. Dificuldade para se concentrar nas coisas, como ler o jornal ou ver televisão', options: FREQUENCY_OPTIONS },
    { id: 'q8', text: '8. Lentidão para se mover ou falar (a ponto de outras pessoas perceberem), ou o oposto: agitação física', options: FREQUENCY_OPTIONS },
    { id: 'q9', text: '9. Pensamentos de que seria melhor estar morto(a) ou de se ferir de alguma maneira', options: FREQUENCY_OPTIONS },
  ],
};

const GAD7: PublicSelfAssessmentDefinition = {
  toolKey: 'gad7',
  ruleVersion: 'nexus-2026-09-03',
  acronym: 'GAD-7',
  instructions: 'Para cada item abaixo, selecione com que frequência você foi incomodado(a) pelo sintoma nas últimas 2 semanas.',
  questions: [
    { id: 'q1', text: '1. Sentir-se nervoso(a), ansioso(a) ou muito tenso(a)', options: FREQUENCY_OPTIONS },
    { id: 'q2', text: '2. Não ser capaz de impedir ou de controlar as preocupações', options: FREQUENCY_OPTIONS },
    { id: 'q3', text: '3. Preocupar-se demais com diversas coisas', options: FREQUENCY_OPTIONS },
    { id: 'q4', text: '4. Dificuldade para relaxar', options: FREQUENCY_OPTIONS },
    { id: 'q5', text: '5. Ficar tão agitado(a) que se torna difícil permanecer sentado(a)', options: FREQUENCY_OPTIONS },
    { id: 'q6', text: '6. Ficar facilmente irritado(a) ou chateado(a)', options: FREQUENCY_OPTIONS },
    { id: 'q7', text: '7. Sentir medo como se algo terrível fosse acontecer', options: FREQUENCY_OPTIONS },
  ],
};

const CATALOG: Record<string, PublicSelfAssessmentDefinition> = {
  phq9: PHQ9,
  gad7: GAD7,
};

export function getPublicSelfAssessmentDefinition(toolKey: string | undefined): PublicSelfAssessmentDefinition | null {
  if (!toolKey) return null;
  return CATALOG[toolKey] ?? null;
}
