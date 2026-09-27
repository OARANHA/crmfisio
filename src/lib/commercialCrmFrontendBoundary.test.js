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
    expect(adapter).toContain("supabase.rpc('transition_current_clinic_crm_lead_stage'");
    expect(adapter).not.toMatch(/supabase\s*\.from\s*\(\s*['"](?:contacts|crm_)/);
  });

  it('keeps role checks as UI affordance while the RPC adapter owns the mutation call', () => {
    expect(board).toContain('isOperationalRole(user?.role)');
    expect(board).toContain('executeCommercialCrmStageTransition');
    expect(adapter).toContain("supabase.rpc('transition_current_clinic_crm_lead_stage'");
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
      adapter.indexOf('const snapshot = await refresh();'),
    );
  });

  it('keeps Patient-domain NPS/churn separate from the canonical commercial Lead count', () => {
    expect(page).toContain('Pesquisa de satisfação (NPS)');
    expect(page).toContain('Risco de abandono');
    expect(page).not.toContain('leads no funil');
    expect(board).toContain("title={'Pipeline comercial · ' + activeLeads.length + ' Lead(s)'}");
  });
});
