import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const page = readFileSync(fileURLToPath(new URL('../pages/Crm.tsx', import.meta.url)), 'utf8');
const board = readFileSync(fileURLToPath(new URL('../components/CommercialCrmBoard.tsx', import.meta.url)), 'utf8');
const adapter = readFileSync(fileURLToPath(new URL('./commercialCrm.ts', import.meta.url)), 'utf8');

describe('commercial CRM board frontend boundary', () => {
  it('removes Patient funnel state and setFunilStage from the commercial board surface', () => {
    expect(page).toContain('<CommercialCrmBoard />');
    expect(page).not.toContain('setFunilStage');
    expect(page).not.toContain('funilStage');
    expect(page).not.toContain('canManagePatientFunnel');
    expect(board).not.toContain('setFunilStage');
    expect(board).not.toContain('usePatients');
  });

  it('uses only canonical released Commercial CRM RPCs and no raw CRM table DML', () => {
    expect(adapter).toContain("supabase.rpc('list_current_clinic_crm_pipelines'");
    expect(adapter).toContain("supabase.rpc('list_current_clinic_crm_stages'");
    expect(adapter).toContain("supabase.rpc('list_current_clinic_crm_leads'");
    expect(adapter).toContain("supabase.rpc('create_current_clinic_crm_contact'");
    expect(adapter).toContain("supabase.rpc('create_current_clinic_crm_lead'");
    expect(adapter).toContain("supabase.rpc('transition_current_clinic_crm_lead_stage'");
    expect(adapter).toContain("supabase.rpc('list_current_clinic_crm_contact_identity_candidates'");
    expect(adapter).toContain("supabase.rpc('resolve_current_clinic_crm_prospect_identity'");
    expect(adapter).not.toContain("supabase.rpc('create_current_clinic_crm_prospect'");
    expect(adapter).not.toMatch(/supabase\s*\.from\s*\(\s*['"](?:contacts|crm_)/);
  });

  it('keeps role checks as UI affordance while the RPC adapter owns the mutation call', () => {
    expect(board).toContain('isOperationalRole(user?.role)');
    expect(board).toContain('executeCommercialCrmStageTransition');
    expect(board).toContain('listCurrentClinicCrmContactIdentityCandidates');
    expect(board).toContain('executeCommercialCrmProspectResolution');
    expect(board).not.toContain('executeCommercialCrmProspectCreation');
    expect(board).not.toContain('createCurrentClinicCrmContact');
    expect(board).not.toContain('createCurrentClinicCrmLead');
    expect(adapter).toContain("supabase.rpc('list_current_clinic_crm_contact_identity_candidates'");
    expect(adapter).toContain("supabase.rpc('resolve_current_clinic_crm_prospect_identity'");
    expect(adapter).toContain("supabase.rpc('transition_current_clinic_crm_lead_stage'");
  });

  it('keeps Prospect Intake inside Contact/Lead authority without Patient creation', () => {
    expect(board).toContain('Novo prospect');
    expect(board).toContain('Nenhuma correspondência é escolhida automaticamente');
    expect(board).toContain("'create_if_clear'");
    expect(board).toContain("'explicit_reuse'");
    expect(board).toContain("'explicit_distinct'");
    expect(board).not.toContain('addPatient');
    expect(board).not.toContain('create_patient');
    expect(adapter).not.toContain('p_patient_id');
    expect(adapter).not.toContain('create_patient');
  });

  it('keeps identity preview on its dedicated released projection and never uses Lead projection as matching authority', () => {
    const candidateFunctionStart = adapter.indexOf('export async function listCurrentClinicCrmContactIdentityCandidates');
    const resolverFunctionStart = adapter.indexOf('export async function resolveCurrentClinicCrmProspectIdentity');
    const candidateFunction = adapter.slice(candidateFunctionStart, resolverFunctionStart);

    expect(candidateFunctionStart).toBeGreaterThanOrEqual(0);
    expect(candidateFunction).toContain("supabase.rpc('list_current_clinic_crm_contact_identity_candidates'");
    expect(candidateFunction).not.toContain('listCurrentClinicCrmLeads');
    expect(candidateFunction).not.toContain('contactPatientId');
    expect(candidateFunction).not.toContain('p_patient_id');
  });

  it('has no Prospect Intake fallback to the old Contact or Lead browser writers', () => {
    expect(board).toContain('executeCommercialCrmProspectResolution');
    expect(board).not.toContain('executeCommercialCrmProspectCreation');
    expect(board).not.toContain('createCurrentClinicCrmContact');
    expect(board).not.toContain('createCurrentClinicCrmLead');
  });

  it('never creates Patient navigation from the Commercial Lead projection', () => {
    expect(board).not.toContain('/pacientes/');
    expect(board).not.toContain('contactPatientId');
    expect(page).toContain("Link to={'/pacientes/' + patient.id}");
  });

  it('preserves archived/legacy visibility and filters archived stages from mutation columns', () => {
    expect(board).toContain('Leads arquivados / legado');
    expect(board).toContain("filter((stage) => stage.pipelineId === selectedPipelineId && !stage.archivedAt)");
    expect(board).toContain('Boolean(pipeline.archivedAt) || Boolean(stage.archivedAt)');
  });

  it('treats post-COMMIT projection refresh failure as stale UI rather than command failure', () => {
    expect(adapter).toContain("projection: 'stale'");
    expect(adapter).toContain('Etapa atualizada, mas o quadro não pôde ser recarregado');
    expect(adapter.indexOf('const command = await transition(input);')).toBeLessThan(
      adapter.lastIndexOf('const snapshot = await refresh();'),
    );
  });

  it('keeps Patient-domain NPS/churn separate from the canonical commercial Lead count', () => {
    expect(page).toContain('Pesquisa de satisfação (NPS)');
    expect(page).toContain('Risco de abandono');
    expect(page).not.toContain('leads no funil');
    expect(board).toContain("title={'Pipeline comercial · ' + activeLeads.length + ' Lead(s)'}");
  });
});
