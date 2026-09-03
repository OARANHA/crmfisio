import { describe, expect, it } from 'vitest';
import { accessFor, isClinicalRole, isOperationalRole, isRole } from './permissions';
import { appointmentActions } from './appointmentWorkflow';
import type { Appointment } from './types';

const appointment: Appointment = {
  id: 'a1', pacienteId: 'p1', fisioId: 'f1', roomId: 'r1', data: '2026-09-03',
  inicio: '09:00', fim: '10:00', status: 'confirmado', tipo: 'Fisioterapia', valor: 10000,
  pacoteId: null, serieId: null, notas: '',
};

describe('canonical permissions', () => {
  it('recognizes only the five clinic roles', () => {
    expect(['owner', 'admin', 'fisio', 'recep', 'financeiro'].every(isRole)).toBe(true);
    expect(isRole('platform_admin')).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });

  it('does not collapse finance into reception', () => {
    expect(accessFor('financeiro', 'agenda')).toBe('read');
    expect(accessFor('recep', 'agenda')).toBe('full');
  });

  it('keeps clinical acts exclusive to care professionals', () => {
    expect(isClinicalRole('fisio')).toBe(true);
    expect(isClinicalRole('owner')).toBe(false);
    expect(isClinicalRole('admin')).toBe(false);
    expect(appointmentActions('fisio', appointment).map((action) => action.status)).toContain('em_atendimento');
    expect(appointmentActions('owner', appointment).map((action) => action.status)).not.toContain('em_atendimento');
    expect(appointmentActions('admin', appointment).map((action) => action.status)).not.toContain('em_atendimento');
  });

  it('fails closed without a clinic role', () => {
    expect(accessFor(null, 'dashboard')).toBe('none');
    expect(isOperationalRole(undefined)).toBe(false);
  });
});
