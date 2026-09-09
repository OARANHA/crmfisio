import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const workspaceV3 = read('../components/ClinicalWorkspaceV3.tsx');
const encounterWorkspace = read('../components/ClinicalEncounterWorkspaceV4.tsx');
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
    expect(workspace).not.toContain("sessions.find((s) => s.status === 'em_atendimento')");
  });

  it('auto-binds evolution to the canonical encounter and exposes no arbitrary session selector in v4', () => {
    expect(encounterWorkspace).toContain('buildEncounterEvolutionDraft({');
    expect(encounterWorkspace).toContain('encounter: canonicalEncounter');
    expect(encounterWorkspace).not.toContain('setSessionId');
    expect(workspace).toContain('setSessionId(activeSession.id)');
    expect(workspace).toContain("activeSession?.id !== session.id");
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
    expect(assessment).toContain("setEditorContextKey(null)");
    expect(assessment).toContain('contextKeyRef.current !== contextKey');
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

  it('isolates Nexus allow state by user, patient and encounter', () => {
    expect(encounterWorkspace).toContain('userId={user?.id}');
    expect(tools).toContain('nexusClinicalToolContextKey({ userId, patientId: patient.id, encounterId: encounter.id })');
    expect(tools).toContain("state.key === key ? state : emptyToolState(key, 'loading')");
  });

  it('preserves explicit C-04 readiness and C-05 navigation', () => {
    expect(tools).toContain('listPatientNexusRecordIncorporations(patient.id)');
    expect(tools).toContain("result.lifecycleState === 'signed'");
    expect(toolRegistry).toContain("routeSuffix: '/evolution'");
  });

  it('resets the legacy encounter-scoped evolution draft context when patient or user changes', () => {
    expect(workspace).toContain("setSessionId('')");
    expect(workspace).toContain("setEvolutionText('')");
    expect(workspace).toContain('[patient.id, user?.id]');
  });
});
