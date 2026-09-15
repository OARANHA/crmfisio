import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const hook = read('../hooks/useClinicalEncounterHandoff.ts');
const reception = read('../pages/RecepcaoHoje.tsx');
const agenda = read('../pages/AgendaReal.tsx');
const cockpit = read('../components/PatientCareCockpit.tsx');
const dashboard = read('../components/dashboards/ClinicianDashboard.tsx');

describe('Encounter Auto-Entry to Consultório V1', () => {
  it('requests clinical presentation only through the existing scoped provider', () => {
    expect(hook).toContain("availableContexts.includes('clinical')");
    expect(hook).toContain("setContext('clinical')");
    expect(hook).toContain('clinicianEncounterPath(encounter)');
    expect(hook).not.toMatch(/owner|admin|professionalType|specialty/);
  });

  it('hands off explicit reception start/continue actions after own-clinician checks', () => {
    expect(reception).toContain('const isAssignedClinician = Boolean(canAttend');
    expect(reception).toContain("if (accepted) openEncounter({ id: item.appointment_id, pacienteId: item.patient_id })");
    expect(reception).toContain("item.status === 'em_atendimento' && <Btn onClick={() => openEncounter(");
  });

  it('hands off Agenda only for an explicit own Encounter start or continue', () => {
    expect(agenda).toContain("status === 'em_atendimento' && professionalIdOf(appointment) === user?.id");
    expect(agenda).toContain('onContinue={() => openEncounter(activeEncounter)}');
    expect(agenda).toContain("selected.status === 'em_atendimento' && professionalIdOf(selected) === user?.id");
  });

  it('hands off only the active-session actions in patient cockpit and clinician home', () => {
    expect(cockpit).toContain('const isOwnActiveSession = Boolean(activeSession && canAttend');
    expect(cockpit).toContain('onClick={() => openEncounter(activeSession!)}');
    expect(cockpit).toContain("onClick={() => nav(`/pacientes/${patient.id}#clinical-workspace`)}");

    expect(dashboard).toContain('to={clinicianEncounterPath(activeEncounter)} onClick={enterClinicalPresentation}');
    expect(dashboard).toContain('to={clinicianEncounterPath(next)} className=');
    expect(dashboard).not.toContain('to={clinicianEncounterPath(next)} onClick={enterClinicalPresentation}');
  });

  it('does not infer Consultório from route presence or active appointment existence', () => {
    expect(hook).not.toContain('location');
    expect(hook).not.toContain('searchParams');
    expect(hook).not.toContain('em_atendimento');
    expect(hook).not.toContain('localStorage');
  });
});
