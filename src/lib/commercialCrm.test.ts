import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());

vi.mock('./supabaseClient', () => ({
  supabase: { rpc },
}));

import {
  executeCommercialCrmStageTransition,
  listCurrentClinicCrmLeads,
  listCurrentClinicCrmPipelines,
  listCurrentClinicCrmStages,
  loadCurrentClinicCommercialCrm,
  transitionCurrentClinicCrmLeadStage,
} from './commercialCrm';

describe('commercial CRM canonical frontend adapter', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('loads only the released current-clinic CRM projections', async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{ id: 'pipeline-a', name: 'Comercial', is_default: true, archived_at: null }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{
          id: 'stage-a',
          pipeline_id: 'pipeline-a',
          name: 'Novo',
          position: 0,
          stage_kind: 'open',
          archived_at: null,
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{
          lead_id: 'lead-a',
          title: 'Avaliação',
          value_cents: 15000,
          source: 'site',
          lost_reason_code: null,
          lost_reason_detail: null,
          closed_at: null,
          owner_id: null,
          contact_id: 'contact-a',
          contact_name: 'Maria',
          contact_phone: '51999999999',
          contact_email: 'maria@example.com',
          contact_patient_id: null,
          contact_anonymized_at: null,
          pipeline_id: 'pipeline-a',
          pipeline_name: 'Comercial',
          stage_id: 'stage-a',
          stage_name: 'Novo',
          stage_kind: 'open',
          stage_position: 0,
        }],
        error: null,
      });

    const snapshot = await loadCurrentClinicCommercialCrm();

    expect(snapshot.pipelines).toEqual([
      { id: 'pipeline-a', name: 'Comercial', isDefault: true, archivedAt: null },
    ]);
    expect(snapshot.stages[0]).toMatchObject({
      id: 'stage-a',
      pipelineId: 'pipeline-a',
      stageKind: 'open',
      archivedAt: null,
    });
    expect(snapshot.leads[0]).toMatchObject({
      id: 'lead-a',
      contactId: 'contact-a',
      pipelineId: 'pipeline-a',
      stageId: 'stage-a',
    });
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      'list_current_clinic_crm_pipelines',
      'list_current_clinic_crm_stages',
      'list_current_clinic_crm_leads',
    ]);
    expect(rpc.mock.calls[1]?.[1]).toEqual({ p_pipeline_id: null });
  });

  it('maps individual projection functions without raw table reads', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await listCurrentClinicCrmPipelines();
    await listCurrentClinicCrmStages();
    await listCurrentClinicCrmLeads();

    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it('sends a trimmed free-form lost reason through the canonical transition RPC', async () => {
    rpc.mockResolvedValue({
      data: [{
        lead_id: 'lead-a',
        from_stage_id: 'stage-open',
        to_stage_id: 'stage-lost',
        stage_kind: 'lost',
        closed_at: '2026-09-27T12:00:00Z',
      }],
      error: null,
    });

    const result = await transitionCurrentClinicCrmLeadStage({
      leadId: 'lead-a',
      toStageId: 'stage-lost',
      lostReasonDetail: '  Sem interesse neste momento  ',
    });

    expect(rpc).toHaveBeenCalledWith('transition_current_clinic_crm_lead_stage', {
      p_lead_id: 'lead-a',
      p_to_stage_id: 'stage-lost',
      p_lost_reason_code: null,
      p_lost_reason_detail: 'Sem interesse neste momento',
    });
    expect(result).toMatchObject({
      leadId: 'lead-a',
      toStageId: 'stage-lost',
      stageKind: 'lost',
    });
  });

  it('keeps a persisted command successful when the post-COMMIT projection refetch fails', async () => {
    const command = {
      leadId: 'lead-a',
      fromStageId: 'stage-open',
      toStageId: 'stage-won',
      stageKind: 'won' as const,
      closedAt: '2026-09-27T12:00:00Z',
    };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await executeCommercialCrmStageTransition(
      { leadId: 'lead-a', toStageId: 'stage-won' },
      {
        transition: vi.fn().mockResolvedValue(command),
        refresh: vi.fn().mockRejectedValue(new Error('projection unavailable')),
      },
    );

    expect(result.command).toEqual(command);
    expect(result.snapshot).toBeNull();
    expect(result.projection).toBe('stale');
    expect(result.projectionWarning).toContain('Etapa atualizada');
    expect(result.projectionWarning).not.toContain('não foi possível mover');
  });

  it('treats RPC rejection as command failure and never starts the projection refresh', async () => {
    const commandError = new Error('rpc rejected');
    const refresh = vi.fn();

    await expect(executeCommercialCrmStageTransition(
      { leadId: 'lead-a', toStageId: 'stage-won' },
      {
        transition: vi.fn().mockRejectedValue(commandError),
        refresh,
      },
    )).rejects.toBe(commandError);

    expect(refresh).not.toHaveBeenCalled();
  });
});
