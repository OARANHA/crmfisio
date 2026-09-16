import {
  getPublicSelfAssessmentDefinition,
  type PublicSelfAssessmentOption,
  type PublicSelfAssessmentQuestion,
} from './publicSelfAssessmentCatalog';

export type ClinicianAssistedInstrumentDefinition = {
  toolKey: 'phq9' | 'gad7' | 'phq15' | 'cage' | 'pcl5';
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

const CAGE_OPTIONS: PublicSelfAssessmentOption[] = [
  { label: 'Não', value: 0 },
  { label: 'Sim', value: 1 },
];

const CAGE: ClinicianAssistedInstrumentDefinition = {
  toolKey: 'cage',
  ruleVersion: 'nexus-cage-2026-09-16',
  acronym: 'CAGE',
  instructions: 'Versão operacional Nexus/MedicsPro. Registre Sim ou Não para as quatro perguntas. O CAGE é um instrumento de rastreio e não estabelece diagnóstico de transtorno por uso de álcool.',
  questions: [
    { id: 'q1', text: '1. Você já sentiu que deveria diminuir a quantidade de bebida?', options: CAGE_OPTIONS },
    { id: 'q2', text: '2. As pessoas já o(a) irritaram criticando seu modo de beber?', options: CAGE_OPTIONS },
    { id: 'q3', text: '3. Você já se sentiu culpado(a) ou chateado(a) consigo mesmo(a) pela maneira como bebe?', options: CAGE_OPTIONS },
    { id: 'q4', text: '4. Você já teve que beber pela manhã para acalmar os nervos ou se livrar de uma ressaca?', options: CAGE_OPTIONS },
  ],
};

const PCL5_OPTIONS: PublicSelfAssessmentOption[] = [
  { label: 'De modo nenhum (0)', value: 0 },
  { label: 'Um pouco (1)', value: 1 },
  { label: 'Moderadamente (2)', value: 2 },
  { label: 'Muito (3)', value: 3 },
  { label: 'Extremamente (4)', value: 4 },
];

const PCL5: ClinicianAssistedInstrumentDefinition = {
  toolKey: 'pcl5',
  ruleVersion: 'nexus-pcl5-br-2026-09-16',
  acronym: 'PCL-5',
  instructions: 'Versão brasileira autorizada/adaptada do PCL-5, incorporada ao fluxo Nexus/MedicsPro. Use a forma sem Critério A somente quando a experiência traumática já tiver sido avaliada por outro meio. Considere o último mês. O escore é de rastreio/quantificação sintomática e não estabelece diagnóstico isoladamente.',
  questions: [
    { id: 'q1', text: '1. Lembranças indesejáveis, perturbadoras e repetitivas da experiência estressante?', options: PCL5_OPTIONS },
    { id: 'q2', text: '2. Sonhos perturbadores e repetitivos com a experiência estressante?', options: PCL5_OPTIONS },
    { id: 'q3', text: '3. De repente, sentindo ou agindo como se a experiência estressante estivesse, de fato, acontecendo de novo (como se você estivesse revivendo-a, de verdade, lá no passado)?', options: PCL5_OPTIONS },
    { id: 'q4', text: '4. Sentir-se muito chateado quando algo lembra você da experiência estressante?', options: PCL5_OPTIONS },
    { id: 'q5', text: '5. Ter reações físicas intensas quando algo lembra você da experiência estressante (por exemplo, coração apertado, dificuldades para respirar, suor excessivo)?', options: PCL5_OPTIONS },
    { id: 'q6', text: '6. Evitar lembranças, pensamentos, ou sentimentos relacionados à experiência estressante?', options: PCL5_OPTIONS },
    { id: 'q7', text: '7. Evitar lembranças externas da experiência estressante (por exemplo, pessoas, lugares, conversas, atividades, objetos ou situações)?', options: PCL5_OPTIONS },
    { id: 'q8', text: '8. Não conseguir se lembrar de partes importantes da experiência estressante?', options: PCL5_OPTIONS },
    { id: 'q9', text: '9. Ter crenças negativas intensas sobre você, outras pessoas ou o mundo (por exemplo, ter pensamentos tais como: “Eu sou ruim”, “existe algo seriamente errado comigo”, “ninguém é confiável”, “o mundo todo é perigoso”)?', options: PCL5_OPTIONS },
    { id: 'q10', text: '10. Culpar a si mesmo ou aos outros pela experiência estressante ou pelo que aconteceu depois dela?', options: PCL5_OPTIONS },
    { id: 'q11', text: '11. Ter sentimentos negativos intensos como medo, pavor, raiva, culpa ou vergonha?', options: PCL5_OPTIONS },
    { id: 'q12', text: '12. Perder o interesse em atividades que você costumava apreciar?', options: PCL5_OPTIONS },
    { id: 'q13', text: '13. Sentir-se distante ou isolado das outras pessoas?', options: PCL5_OPTIONS },
    { id: 'q14', text: '14. Dificuldades para vivenciar sentimentos positivos (por exemplo, ser incapaz de sentir felicidade ou sentimentos amorosos por pessoas próximas a você)?', options: PCL5_OPTIONS },
    { id: 'q15', text: '15. Comportamento irritado, explosões de raiva ou agir agressivamente?', options: PCL5_OPTIONS },
    { id: 'q16', text: '16. Correr muitos riscos ou fazer coisas que podem lhe causar algum mal?', options: PCL5_OPTIONS },
    { id: 'q17', text: '17. Ficar “super” alerta, vigilante ou de sobreaviso?', options: PCL5_OPTIONS },
    { id: 'q18', text: '18. Sentir-se apreensivo ou assustado facilmente?', options: PCL5_OPTIONS },
    { id: 'q19', text: '19. Ter dificuldades para se concentrar?', options: PCL5_OPTIONS },
    { id: 'q20', text: '20. Problemas para adormecer ou continuar dormindo?', options: PCL5_OPTIONS },
  ],
};

export function getClinicianAssistedInstrumentDefinition(
  toolKey: string | undefined,
): ClinicianAssistedInstrumentDefinition | null {
  if (!toolKey) return null;
  if (toolKey === 'phq15') return PHQ15;
  if (toolKey === 'cage') return CAGE;
  if (toolKey === 'pcl5') return PCL5;
  const publicDefinition = getPublicSelfAssessmentDefinition(toolKey);
  return publicDefinition as ClinicianAssistedInstrumentDefinition | null;
}
