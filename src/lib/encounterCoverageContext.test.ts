import { describe, expect, it } from 'vitest';
import { encounterCoveragePresentation, parseEncounterCoverageRow } from './encounterCoverageContext';

const appointmentId = 'appointment-a';
const row = (coverage_kind: string, coverage_state: string, package_name: string | null, administrative_attention: boolean) => ({
  appointment_id: appointmentId,
  coverage_kind,
  coverage_state,
  package_name,
  administrative_attention,
});

describe('Encounter Coverage Context V1', () => {
  it('parses only canonical kind/state pairs', () => {
    expect(parseEncounterCoverageRow(row('private', 'private_planned', null, false), appointmentId).coverageState).toBe('private_planned');
    expect(parseEncounterCoverageRow(row('package', 'package_reserved', 'Pacote 10', false), appointmentId).packageName).toBe('Pacote 10');
    expect(() => parseEncounterCoverageRow(row('private', 'package_reserved', null, false), appointmentId)).toThrow();
    expect(() => parseEncounterCoverageRow(row('package', 'private_paid', 'Pacote 10', false), appointmentId)).toThrow();
    expect(() => parseEncounterCoverageRow(row('private', 'private_paid', 'Pacote indevido', false), appointmentId)).toThrow();
  });

  it('rejects a projection for another appointment', () => {
    expect(() => parseEncounterCoverageRow(row('private', 'private_planned', null, false), 'appointment-b')).toThrow();
  });

  it('keeps administrative attention separate from clinical completion', () => {
    const context = parseEncounterCoverageRow(row('package', 'package_attention', 'Pacote 10', true), appointmentId);
    const presentation = encounterCoveragePresentation(context);
    expect(presentation.tone).toBe('attention');
    expect(presentation.detail).toContain('conclusão clínica permanece independente');
  });

  it('describes package success as reservation, not consumption', () => {
    const context = parseEncounterCoverageRow(row('package', 'package_reserved', 'Pacote 10', false), appointmentId);
    const presentation = encounterCoveragePresentation(context);
    expect(presentation.stateLabel).toBe('Sessão reservada');
    expect(presentation.detail).toContain('consumo é materializado somente na conclusão');
  });
});
