export const NEXUS_PSYCHOPHARMACOLOGY_EQUIVALENCE_RULE_VERSION = 'nexus-psychopharmacology-equivalence-2026-09-04';

export const ANTIDEPRESSANT_EQUIVALENCE_BASE: Record<string, number> = {
  Fluoxetina: 20,
  Sertralina: 50,
  Escitalopram: 10,
  Citalopram: 20,
  Paroxetina: 20,
  Venlafaxina: 75,
  Duloxetina: 60,
  Amitriptilina: 50,
};

export const ANTIPSYCHOTIC_CPZE_BASE: Record<string, number> = {
  Clorpromazina: 100,
  Haloperidol: 2,
  Risperidona: 2,
  Quetiapina: 100,
  Olanzapina: 5,
  Aripiprazol: 5,
  Levomepromazina: 100,
};

export function calculateAntidepressantEquivalence(drug: string, doseMg: number) {
  if (!Number.isFinite(doseMg) || doseMg <= 0) throw new Error('Dose inválida.');
  const stdDose = ANTIDEPRESSANT_EQUIVALENCE_BASE[drug] || 20;
  const ratio = doseMg / stdDose;
  const fluoxetinaEq = Math.round(ratio * 20);
  const sertralinaEq = Math.round(ratio * 50);
  const escitalopramEq = Math.round(ratio * 10);
  const interpretation = `A dose de ${drug} ${doseMg} mg equivale aproximadamente a Fluoxetina ${fluoxetinaEq} mg/dia, Sertralina ${sertralinaEq} mg/dia ou Escitalopram ${escitalopramEq} mg/dia.`;
  const soapText = `Estimada dose equivalente do antidepressivo: ${drug} ${doseMg} mg/dia (~ Fluoxetina ${fluoxetinaEq} mg/dia / Sertralina ${sertralinaEq} mg/dia).`;
  return { id:'antidepressant-eq', title:'Equivalência de Antidepressivos', drug, doseMg, fluoxetinaEq, sertralinaEq, escitalopramEq, interpretation, soapText };
}

export function calculateAntipsychoticEquivalence(drug: string, doseMg: number) {
  if (!Number.isFinite(doseMg) || doseMg <= 0) throw new Error('Dose inválida.');
  const stdDose = ANTIPSYCHOTIC_CPZE_BASE[drug] || 100;
  const ratio = doseMg / stdDose;
  const chlorpromazineEq = Math.round(ratio * 100);
  const haloperidolEq = (ratio * 2).toFixed(1);
  const risperidoneEq = (ratio * 2).toFixed(1);
  const interpretation = `A dose de ${drug} ${doseMg} mg/dia corresponde a aproximadamente ${chlorpromazineEq} mg/dia de Clorpromazina equivalente (ou ~${haloperidolEq} mg de Haloperidol / ~${risperidoneEq} mg de Risperidona).`;
  const soapText = `Calculada equivalência de antipsicótico: ${drug} ${doseMg} mg/dia (~ Clorpromazina ${chlorpromazineEq} mg/dia equivalente).`;
  return { id:'antipsychotic-eq', title:'Equivalência de Antipsicóticos', drug, doseMg, chlorpromazineEq, haloperidolEq, risperidoneEq, interpretation, soapText };
}
