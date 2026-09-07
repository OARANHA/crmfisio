import { describe, expect, it } from 'vitest';
import {
  accessFor,
  canManageCommissions,
  canManagePackageCatalog,
  canManagePatientFunnel,
  canSellSessionPackage,
  canTransitionClinicalAppointment,
  canViewCommissions,
  canViewFinancialPayables,
  canWriteFinancialTransaction,
  isClinicalRole,
  isOperationalRole,
  isRole,
} from './permissions';
import { appointmentActions } from './appointmentWorkflow';
import type { Appointment } from './types';

const appointment: Appointment = {
  id: 'a1', pacienteId: 'p1', fisioId: 'f1', roomId: 'r1', data: '2026-09-03',
  inicio: '09:00', fim: '10:00', status: 'confirmado', tipo: 'Atendimento clínico', valor: 10000,
  pacoteId: null, serieId: null, notas: '',
};

describe('canonical permissions', () => {
  it('recognizes only the five clinic roles', () => {
    expect(['owner', 'admin', 'professional', 'recep', 'financeiro'].every(isRole)).toBe(true);
    expect(isRole('platform_admin')).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });

  it('does not collapse finance into reception', () => {
    expect(accessFor('financeiro', 'agenda')).toBe('read');
    expect(accessFor('recep', 'agenda')).toBe('full');
  });

  it('keeps the dedicated clinical operational role generic', () => {
    expect(isClinicalRole('professional')).toBe(true);
    expect(isClinicalRole('owner')).toBe(false);
    expect(isClinicalRole('admin')).toBe(false);
    expect(appointmentActions('professional', appointment).map((action) => action.status)).toContain('em_atendimento');
    expect(appointmentActions('owner', appointment).map((action) => action.status)).not.toContain('em_atendimento');
    expect(appointmentActions('admin', appointment).map((action) => action.status)).not.toContain('em_atendimento');
  });

  it('binds professional-role appointment transitions to the assigned professional', () => {
    expect(canTransitionClinicalAppointment('professional', 'p1', 'p1')).toBe(true);
    expect(canTransitionClinicalAppointment('professional', 'p1', 'p2')).toBe(false);
    expect(canTransitionClinicalAppointment('owner', 'p1', 'p1')).toBe(false);
    expect(canTransitionClinicalAppointment('admin', 'p1', 'p1')).toBe(false);
    expect(canTransitionClinicalAppointment('professional', undefined, 'p1')).toBe(false);
    expect(canTransitionClinicalAppointment('professional', 'p1', null)).toBe(false);
  });

  it('keeps CRM funnel mutation with operational full-access roles only', () => {
    expect(canManagePatientFunnel('owner')).toBe(true);
    expect(canManagePatientFunnel('admin')).toBe(true);
    expect(canManagePatientFunnel('recep')).toBe(true);
    expect(canManagePatientFunnel('professional')).toBe(false);
    expect(canManagePatientFunnel('financeiro')).toBe(false);
    expect(canManagePatientFunnel(undefined)).toBe(false);
  });

  it('mirrors the server contract for payable visibility', () => {
    for (const role of ['owner', 'admin', 'professional', 'financeiro'] as const) {
      expect(canViewFinancialPayables(role)).toBe(true);
    }
    expect(canViewFinancialPayables('recep')).toBe(false);
    expect(canViewFinancialPayables(undefined)).toBe(false);
  });

  it('mirrors the server contract for financial transaction writes', () => {
    for (const role of ['owner', 'admin', 'financeiro'] as const) {
      expect(canWriteFinancialTransaction(role, 'receber')).toBe(true);
      expect(canWriteFinancialTransaction(role, 'pagar')).toBe(true);
    }
    expect(canWriteFinancialTransaction('recep', 'receber')).toBe(true);
    expect(canWriteFinancialTransaction('recep', 'pagar')).toBe(false);
    expect(canWriteFinancialTransaction('professional', 'receber')).toBe(false);
    expect(canWriteFinancialTransaction(null, 'receber')).toBe(false);
  });

  it('mirrors package sale and catalog administration boundaries', () => {
    for (const role of ['owner', 'admin', 'recep', 'financeiro'] as const) {
      expect(canSellSessionPackage(role)).toBe(true);
    }
    expect(canSellSessionPackage('professional')).toBe(false);
    expect(canManagePackageCatalog('owner')).toBe(true);
    expect(canManagePackageCatalog('admin')).toBe(true);
    expect(canManagePackageCatalog('recep')).toBe(false);
    expect(canManagePackageCatalog('financeiro')).toBe(false);
  });

  it('separates commission visibility from commission management', () => {
    for (const role of ['owner', 'admin', 'professional', 'financeiro'] as const) {
      expect(canViewCommissions(role)).toBe(true);
    }
    expect(canViewCommissions('recep')).toBe(false);
    expect(canManageCommissions('owner')).toBe(true);
    expect(canManageCommissions('admin')).toBe(true);
    expect(canManageCommissions('financeiro')).toBe(true);
    expect(canManageCommissions('recep')).toBe(false);
    expect(canManageCommissions('professional')).toBe(false);
  });

  it('fails closed without a clinic role', () => {
    expect(accessFor(null, 'dashboard')).toBe('none');
    expect(isOperationalRole(undefined)).toBe(false);
    expect(canTransitionClinicalAppointment(undefined, 'p1', 'p1')).toBe(false);
    expect(canManagePatientFunnel(undefined)).toBe(false);
    expect(canViewFinancialPayables(undefined)).toBe(false);
    expect(canSellSessionPackage(undefined)).toBe(false);
    expect(canManagePackageCatalog(undefined)).toBe(false);
    expect(canViewCommissions(undefined)).toBe(false);
    expect(canManageCommissions(undefined)).toBe(false);
  });
});
