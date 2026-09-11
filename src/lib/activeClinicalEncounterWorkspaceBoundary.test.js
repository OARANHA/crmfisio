import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const workspaceV3 = read('../components/ClinicalWorkspaceV3.tsx');
const encounterWorkspace = read('../components/ClinicalEncounterWorkspaceV4.tsx');
const encounterEditor = read('../components/ClinicalEncounterRecordEditor.tsx');
const encounterRecord = read('./clinicalEncounterRecord.ts');
const encounterMigration = read('../../supabase-migrations/20260910_clinical_encounter_record_foundation.sql');
const encounterUx = read('./clinicalEncounterUx.ts');
const workspace = read('../components/ClinicalWorkspace.tsx');
const assessment = read('../components/ClinicalAssessmentRunner.tsx');
const eem = read('../components/NexusEemPanel.tsx');
const tools = read('../components/ActiveEncounterClinicalTools.tsx');
const toolRegistry = read('./nexus/clinicalToolRegistry.ts');
const selfAssessment = read('../components/NexusSelfAssessmentInviteAction.tsx');

describe('Active Clinical Encounter workspace boundary', () => {
  it('derives the encounter from current patient + current professional instead of first patient session', () => {
    expect(workspaceV3).toContain('resolveClinicalEncounterWorkspace(appointments, patient.id, user?.id, initialSessionId)');
    expect(encounterUx).toContain('resolveOwnActiveEncounter(appointments, patientId, professionalId)');
    expect(workspace).toContain('resolveOwnActiveEncounter(appointments, patient.id, user?.id)');
    expect(encounterWorkspace).toContain('resolveOwnActiveEncounter(appointments, patient.id, user?.id)');
    expect(workspace).not.toContain("sessions.find((s) => s.status === 'em_atendimento')");
  });

  it('binds the Encounter Record editor and its save/finalize RPCs to the canonical encounter with no arbitrary v4 session selector', () => {
    expect(encounterWorkspace).toContain('<ClinicalEncounterRecordEditor');
    expect(encounterWorkspace).toContain('encounter={canonicalEncounter}');
    expect(encounterWorkspace).not.toContain('setSessionId');
    expect(encounterEditor).toContain('saveClinicalEncounterRecord(encounter.id, record?.revision ?? 0, content)');
    expect(encounterEditor).toContain('finalizeClinicalEncounterRecord(encounter.id, record.revision)');
    expect(encounterRecord).toContain('p_appointment_id: appointmentId');
  });

  it('materializes the final Evolution server-side onto the exact Encounter appointment', () => {
    expect(encounterMigration).toContain('v_record.appointment_id, v_text');
    expect(encounterMigration).toContain('session_id, texto');
    expect(encounterMigration).toContain('v_record.professional_id');
    expect(encounterMigration).toContain("SET status = 'finalized'");
    expect(encounterMigration).toContain("SET status = 'finalizado'");
  });

  it('uses the same canonical appointment for new assessments', () => {
    expect(assessment).toContain('resolveOwnActiveEncounter(appointments, patient.id, userId)');
    expect(assessment).toContain('const appointmentId = activeAppointmentId');
    expect(assessment).toContain('appointmentId,');
  });

  it('isolates resumed assessment drafts by patient, professional and canonical encounter', () => {
    expect(assessment).toContain('selectAssessmentDraftForContext(history');
    expect(assessment).toContain('patientId: patient.id');
    expect(assessment).toContain('professionalId: userId');
    expect(assessment).toContain('activeAppointmentId,');
    expect(assessment).toContain('setEditorContextKey(null)');
    expect(assessment).toContain('contextKeyRef.current !== contextKey');
    expect(assessment).toContain('autosave.setContext(contextKey, null)');
    expect(assessment).toContain('autosave.setContext(contextKey, ownDraft.id)');
  });

  it('renders the V5 cockpit as a single active workspace without fictitious clinical tabs', () => {
    expect(encounterWorkspace).toContain("useState<'record' | 'assessment' | 'nexus'>('record')");
    expect(encounterWorkspace).toContain("workspace === 'assessment'");
    expect(encounterWorkspace).toContain("workspace === 'nexus'");
    expect(encounterWorkspace).not.toContain('Prescrição');
    expect(encounterWorkspace).not.toContain('Exames');
    expect(encounterWorkspace).not.toContain('Instrumentos');
  });

  it('keeps the workspace first on mobile and moves patient context to the left rail on xl desktop', () => {
    expect(encounterWorkspace).toContain('xl:grid-cols-[');
    const hero = encounterWorkspace.slice(encounterWorkspace.indexOf('<EncounterHero'), encounterWorkspace.indexOf('<div className="grid items-start'));
    expect(hero).not.toContain('sticky');
    expect(encounterWorkspace).toContain('aria-label="Contexto persistente da consulta"');
    expect(encounterWorkspace).toContain('xl:sticky xl:top-3');
    expect(encounterWorkspace).toContain('xl:max-h-[calc(100vh-1.5rem)]');
    expect(encounterWorkspace).toContain('xl:overflow-y-auto');
    expect(encounterWorkspace).toContain('aria-label="Workspaces da consulta"');
    expect(encounterWorkspace).toContain('xl:sticky xl:top-3 xl:z-20');
    expect(encounterWorkspace).not.toContain('68px+0.75rem');
    expect(encounterWorkspace).toContain('className="order-1 min-w-0 space-y-4 xl:order-2"');
  });

  it('never labels a draft with an encounter that is not its provenance', () => {
    expect(assessment).toContain('visibleDraft?.appointmentId === activeAppointment.id');
    expect(assessment).toContain('visibleDraftAppointment ? ` · atendimento ${visibleDraftAppointment.inicio}` :');
    expect(assessment).not.toContain('rascunho em andamento{activeAppointment ?');
  });

  it('makes EEM accept only the canonical own encounter', () => {
    expect(eem).toContain('resolveOwnActiveEncounter(appointments, patient.id, user?.id)');
    expect(eem).toContain('canonical?.id === encounter.id ? canonical : null');
    expect(eem).toContain('appointmentId: activeAppointment.id');
    expect(eem).not.toContain("appointments.find((item) => item.pacienteId === patient.id && item.status === 'em_atendimento')");
  });

  it('makes Nexus availability capability-first and keeps specialty presentation-only', () => {
    expect(encounterWorkspace).toContain('<ActiveEncounterClinicalTools');
    expect(tools).toContain("loadCurrentClinicEntitlementState('nexus.access')");
    expect(tools).toContain("hasProfessionalCapability('nexus.access')");
    expect(tools).toContain("hasProfessionalCapability('nexus.eem')");
    expect(tools).toContain("hasProfessionalCapability('nexus.scales')");
    expect(tools).toContain('resolveNexusClinicalTools({');
    expect(tools).not.toContain('if (!psychiatry');
    expect(tools).not.toContain('isPsychiatryContext');
    expect(tools).not.toContain('NexusPatientContextHub');
    expect(tools).not.toContain('patient.queixaPrincipal');
    expect(toolRegistry).toContain("requiredCapability: 'nexus.eem'");
    expect(toolRegistry).toContain("requiredCapability: 'nexus.scales'");
    expect(toolRegistry.match(/requiredCapability: null/g)?.length).toBe(2);
    expect(toolRegistry).not.toContain('nexus.longitudinal');
    expect(toolRegistry).not.toContain('nexus.results');
  });

  it('propagates the active encounter to self-assessment invitations and resets their local state by context', () => {
    expect(tools).toContain('key={key} patient={patient} appointmentId={encounter.id}');
    expect(selfAssessment).toContain('body: { patientId: patient.id, scaleKey, appointmentId, expiresHours: 48 }');
  });

  it('isolates Nexus allow state by user, patient and canonical encounter after the guarded user check', () => {
    const userGuard = encounterWorkspace.indexOf('!isCurrentEncounter || !canonicalEncounter || !user');
    const toolsRender = encounterWorkspace.indexOf('<ActiveEncounterClinicalTools');
    expect(userGuard).toBeGreaterThan(-1);
    expect(toolsRender).toBeGreaterThan(userGuard);
    expect(encounterWorkspace).toContain('userId={user.id}');
    expect(tools).toContain('nexusClinicalToolContextKey({ userId, patientId: patient.id, encounterId: encounter.id })');
    expect(tools).toContain("state.key === key ? state : emptyToolState(key, 'loading')");
  });

  it('clears Encounter Record state whenever patient, user or canonical encounter context changes', () => {
    expect(encounterEditor).toContain('const contextKey = `${patient.id}:${userId}:${encounter.id}`');
    expect(encounterEditor).toContain('setRecord(null)');
    expect(encounterEditor).toContain('setContent(emptyContent())');
    expect(encounterEditor).toContain("setSaveState('idle')");
    expect(encounterEditor).toContain('if (contextRef.current !== requestKey) return;');
    expect(encounterEditor).toContain('}, [contextKey, encounter.id]);');
  });

  it('preserves explicit C-04 readiness and C-05 navigation', () => {
    expect(tools).toContain('listPatientNexusRecordIncorporations(patient.id)');
    expect(tools).toContain("result.lifecycleState === 'signed'");
    expect(toolRegistry).toContain("routeSuffix: '/evolution'");
  });

  it('also preserves cleanup of the legacy encounter-scoped evolution draft context', () => {
    expect(workspace).toContain("setSessionId('')");
    expect(workspace).toContain("setEvolutionText('')");
    expect(workspace).toContain('[patient.id, user?.id]');
  });
});
