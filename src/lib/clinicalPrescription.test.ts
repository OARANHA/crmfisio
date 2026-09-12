import { describe, expect, it } from 'vitest';
import {
  emptyMedicationPrescriptionPayload,
  medicationPrescriptionReadyToIssue,
  normalizeMedicationPrescriptionPayload,
  prescriptionItemSummary,
  serializeMedicationPrescriptionPayload,
} from './clinicalPrescription';

describe('Clinical Prescription V1 payload contract', () => {
  it('keeps an incomplete medication row valid as a draft shape', () => {
    const payload = emptyMedicationPrescriptionPayload();
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].medicationName).toBe('');
    expect(medicationPrescriptionReadyToIssue(payload)).toBe(false);
  });

  it('requires a non-empty medication name for every item before issue', () => {
    const payload = emptyMedicationPrescriptionPayload();
    payload.items = [
      { ...payload.items[0], medicationName: 'Sertralina 50 mg', frequency: '1x/dia' },
      { ...payload.items[0], medicationName: '   ' },
    ];
    expect(medicationPrescriptionReadyToIssue(payload)).toBe(false);
    payload.items[1].medicationName = 'Clonazepam 0,5 mg';
    expect(medicationPrescriptionReadyToIssue(payload)).toBe(true);
  });

  it('serializes the D2-A canonical medication_name while preserving structured optional fields', () => {
    const payload = emptyMedicationPrescriptionPayload();
    payload.items[0] = {
      medicationName: '  Sertralina 50 mg ',
      dose: ' 1 comprimido ',
      route: ' oral ',
      frequency: ' pela manhã ',
      duration: ' 30 dias ',
      instructions: ' após o café ',
    };
    payload.observations = '  Retorno em 30 dias. ';

    expect(serializeMedicationPrescriptionPayload(payload)).toEqual({
      items: [{
        medication_name: 'Sertralina 50 mg',
        dose: '1 comprimido',
        route: 'oral',
        frequency: 'pela manhã',
        duration: '30 dias',
        instructions: 'após o café',
      }],
      observations: 'Retorno em 30 dias.',
    });
  });

  it('normalizes persisted snake_case payloads without inventing clinical content', () => {
    expect(normalizeMedicationPrescriptionPayload({
      items: [{ medication_name: ' Losartana ', dose: '50 mg' }],
      observations: '  Monitorar pressão. ',
    })).toEqual({
      items: [{
        medicationName: 'Losartana',
        dose: '50 mg',
        route: '',
        frequency: '',
        duration: '',
        instructions: '',
      }],
      observations: 'Monitorar pressão.',
    });
  });

  it('builds a concise preview summary only from fields actually entered', () => {
    const payload = emptyMedicationPrescriptionPayload();
    payload.items[0] = {
      ...payload.items[0],
      medicationName: 'Dipirona',
      dose: '500 mg',
      frequency: '8/8h se dor',
    };
    expect(prescriptionItemSummary(payload.items[0])).toBe('500 mg · 8/8h se dor');
  });
});
