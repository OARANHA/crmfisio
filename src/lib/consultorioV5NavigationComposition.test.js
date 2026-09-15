import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../components/ClinicalEncounterWorkspaceV4.tsx', import.meta.url), 'utf8');

describe('Consultório V5 navigation composition', () => {
  it('uses typed clinical intents and comfortable navigation targets', () => {
    expect(source).toContain("type EncounterWorkspace = 'record' | 'assessment' | 'instruments' | 'prescription' | 'exams' | 'documents' | 'nexus';");
    expect(source).toContain('workspaceItems.map(({ id, label })');
    expect(source).toContain('min-h-ui-control whitespace-nowrap rounded-xl');
    expect(source).not.toContain('setWorkspace(id as typeof workspace)');
  });

  it('fails safely back to Registro when encounter or relevance context changes', () => {
    expect(source).toContain("const activeWorkspace = workspaceItems.some((item) => item.id === workspace) ? workspace : 'record';");
    expect(source).toContain("setWorkspace('record');");
    expect(source).toContain("setDocumentWorkspace('guidance');");
    expect(source).toContain('}, [patient.id, encounter.id, user?.id]);');
    expect(source).toContain("activeWorkspace === 'prescription'");
    expect(source).toContain("activeWorkspace === 'exams'");
  });

  it('keeps medical relevance presentation-only for prescription and exams', () => {
    expect(source).toContain('const prescriptionRelevant = isPhysicianProfessionalType(identity?.professionalType);');
    expect(source).toContain('const examOrderRelevant = prescriptionRelevant;');
    expect(source).toContain("...(prescriptionRelevant ? [{ id: 'prescription' as const, label: 'Prescrição' }] : [])");
    expect(source).toContain("...(examOrderRelevant ? [{ id: 'exams' as const, label: 'Exames' }] : [])");
    expect(source).toContain("useClinicalCapability('clinical.documents', user?.id)");
  });

  it('does not merge document engines when grouping their navigation', () => {
    expect(source).toContain("type ClinicalDocumentWorkspace = 'guidance' | 'referral';");
    expect(source).toContain("documentWorkspace === 'guidance'");
    expect(source).toContain('<ClinicalTherapeuticGuidanceWorkspace');
    expect(source).toContain('<ClinicalReferralWorkspace');
    expect(source).toContain('preservando seus fluxos de emissão independentes');
  });
});
