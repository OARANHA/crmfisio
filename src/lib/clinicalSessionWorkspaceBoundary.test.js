import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const types = source('./types.ts');
const clinicalContext = source('./clinicalContext.tsx');
const dashboard = source('../components/dashboards/ClinicianDashboard.tsx');
const workspace = source('../components/ClinicalWorkspace.tsx');
const patientsPage = source('../pages/Pacientes.tsx');

describe('clinical session workspace boundary', () => {
  it('preserves session identity in the shared evolution domain', () => {
    expect(types).toContain('sessionId?: string | null');
    expect(clinicalContext).toContain('sessionId: row.session_id');
  });

  it('checks missing evolution by exact appointment instead of patient/day heuristic', () => {
    expect(dashboard).toContain('evolution.sessionId === appointment.id');
    expect(dashboard).not.toContain('evolution.pacienteId === appointment.pacienteId && evolution.data === today');
  });

  it('routes clinician agenda rows into the patient session workspace', () => {
    expect(dashboard).toContain('/pacientes/${patientId}?session=${sessionId}#clinical-workspace');
    expect(patientsPage).toContain("searchParams.get('session')");
    expect(patientsPage).toContain('initialSessionId={focusedSessionId}');
  });

  it('focuses active linked sessions on evolution entry and refreshes shared clinical state', () => {
    expect(workspace).toContain("session.status === 'em_atendimento'");
    expect(workspace).toContain("setTab('evolucoes')");
    expect(workspace).toContain('setSessionId(session.id)');
    expect(workspace).toContain('refreshClinical().catch');
  });

  it('binds assessment and evolution read access only to clinical.timeline.read', () => {
    expect(workspace).toContain("useClinicalCapability('clinical.timeline.read'");
    expect(workspace).toContain('const clinicalRead = canReadTimeline;');
    expect(workspace).toContain("{ key: 'avaliacao', label: 'Avaliações', locked: !clinicalRead }");
    expect(workspace).toContain("{ key: 'evolucoes', label: `Evoluções (${evolutions.length})`, locked: !clinicalRead }");
    expect(workspace).toContain("tab === 'avaliacao' && clinicalRead");
    expect(workspace).toContain("tab === 'evolucoes' && clinicalRead");
  });
});
