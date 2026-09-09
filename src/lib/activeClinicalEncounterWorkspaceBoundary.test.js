import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const workspaceV3 = read('../components/ClinicalWorkspaceV3.tsx');
const workspace = read('../components/ClinicalWorkspace.tsx');
const assessment = read('../components/ClinicalAssessmentRunner.tsx');
const eem = read('../components/NexusEemPanel.tsx');
const tools = read('../components/ActiveEncounterClinicalTools.tsx');
const selfAssessment = read('../components/NexusSelfAssessmentInviteAction.tsx');

describe('Active Clinical Encounter workspace boundary', () => {
  it('derives the encounter from current patient + current professional instead of first patient session', () => {
    expect(workspaceV3).toContain('resolveOwnActiveEncounter(appointments, patient.id, user?.id)');
    expect(workspace).toContain('resolveOwnActiveEncounter(appointments, patient.id, user?.id)');
    expect(workspace).not.toContain("sessions.find((s) => s.status === 'em_atendimento')");
  });

  it('auto-binds evolution to the canonical encounter and removes the redundant active-session selector', () => {
    expect(workspace).toContain('setSessionId(activeSession.id)');
    expect(workspace).toContain("activeSession?.id !== session.id");
    expect(workspace).toContain('sessionId !== activeSession.id');
    expect(workspace).toContain('Nenhum atendimento próprio em andamento');
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

  it('keeps psychiatry contextual and Nexus authorization cumulative + fail closed', () => {
    expect(tools).toContain("loadCurrentClinicEntitlementState('nexus.access')");
    expect(tools).toContain("hasProfessionalCapability('nexus.access')");
    expect(tools).toContain("hasProfessionalCapability('nexus.eem')");
    expect(tools).toContain("hasProfessionalCapability('nexus.scales')");
    expect(tools).toContain("if (!psychiatry || visible.status !== 'allowed') return null");
    expect(tools).not.toContain('NexusPatientContextHub');
  });

  it('propagates the active encounter to PHQ-9/GAD-7 invitations', () => {
    expect(tools).toContain('appointmentId={encounter.id}');
    expect(selfAssessment).toContain('body: { patientId: patient.id, scaleKey, appointmentId, expiresHours: 48 }');
  });

  it('preserves explicit C-04 readiness and C-05 navigation', () => {
    expect(tools).toContain('listPatientNexusRecordIncorporations(patient.id)');
    expect(tools).toContain("result.lifecycleState === 'signed'");
    expect(tools).toContain('/nexus/evolution');
  });

  it('resets encounter-scoped evolution draft context when patient or user changes', () => {
    expect(workspace).toContain("setSessionId('')");
    expect(workspace).toContain("setEvolutionText('')");
    expect(workspace).toContain('[patient.id, user?.id]');
  });
});
