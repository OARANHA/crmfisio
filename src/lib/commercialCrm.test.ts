import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());

vi.mock('./supabaseClient', () => ({
  supabase: { rpc },
}));

import {
  createCurrentClinicCrmContact,
  createCurrentClinicCrmLead,
  executeCommercialCrmLeadDetailsUpdate,
  executeCommercialCrmProspectCreation,
  executeCommercialCrmProspectResolution,
  executeCommercialCrmStageTransition,
  listCurrentClinicCrmContactIdentityCandidates,
  listCurrentClinicCrmLeadActivities,
  listCurrentClinicCrmLeads,
  listCurrentClinicCrmPipelines,
  listCurrentClinicCrmStages,
  loadCurrentClinicCommercialCrm,
  resolveCurrentClinicCrmProspectIdentity,
  transitionCurrentClinicCrmLeadStage,
  updateCurrentClinicCrmLeadDetails,
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
          lead_updated_at: '2026-09-28T03:00:00Z',
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
      updatedAt: '2026-09-28T03:00:00Z',
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

  it('maps the released Lead activity projection into a bounded frontend shape', async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          id: 'activity-stage',
          activity_type: 'stage_changed',
          actor_id: 'actor-secret',
          actor_kind: 'human',
          metadata: {
            from_stage_id: 'stage-open',
            to_stage_id: 'stage-lost',
            lost_reason_detail: 'SEGREDO LIVRE',
            candidate_ids: ['contact-secret'],
            patient_id: 'patient-secret',
          },
          created_at: '2026-09-27T12:00:00Z',
        },
        {
          id: 'activity-identity',
          activity_type: 'contact_identity_resolved',
          actor_id: 'actor-secret',
          actor_kind: 'human',
          metadata: {
            resolution_mode: 'explicit_reuse',
            requested_contact_id: 'contact-requested',
            resolved_contact_id: 'contact-resolved',
            candidate_ids: ['contact-resolved'],
            match_reasons: ['phone_exact'],
            distinct_reason: 'SEGREDO DISTINTO',
          },
          created_at: '2026-09-27T11:00:00Z',
        },
      ],
      error: null,
    });

    const activities = await listCurrentClinicCrmLeadActivities('lead-a');

    expect(rpc).toHaveBeenCalledWith('list_current_clinic_crm_lead_activities', {
      p_lead_id: 'lead-a',
    });
    expect(activities).toEqual([
      {
        id: 'activity-stage',
        activityType: 'stage_changed',
        createdAt: '2026-09-27T12:00:00Z',
        fromStageId: 'stage-open',
        toStageId: 'stage-lost',
        resolutionMode: null,
      },
      {
        id: 'activity-identity',
        activityType: 'contact_identity_resolved',
        createdAt: '2026-09-27T11:00:00Z',
        fromStageId: null,
        toStageId: null,
        resolutionMode: 'explicit_reuse',
      },
    ]);

    const serialized = JSON.stringify(activities);
    expect(serialized).not.toContain('actor-secret');
    expect(serialized).not.toContain('SEGREDO LIVRE');
    expect(serialized).not.toContain('SEGREDO DISTINTO');
    expect(serialized).not.toContain('contact-secret');
    expect(serialized).not.toContain('contact-requested');
    expect(serialized).not.toContain('contact-resolved');
    expect(serialized).not.toContain('patient-secret');
    expect(serialized).not.toContain('phone_exact');
  });

  it('maps the released Contact identity candidate projection without Patient fields', async () => {
    rpc.mockResolvedValueOnce({
      data: [{
        contact_id: 'contact-a',
        display_name: 'Maria Silva',
        phone: '51999999999',
        email: 'maria@example.com',
        match_reasons: ['phone_exact', 'email_exact'],
        open_lead_count: 2,
      }],
      error: null,
    });

    const candidates = await listCurrentClinicCrmContactIdentityCandidates({
      phone: '  51999999999  ',
      email: '  maria@example.com  ',
    });

    expect(rpc).toHaveBeenCalledWith('list_current_clinic_crm_contact_identity_candidates', {
      p_phone: '51999999999',
      p_email: 'maria@example.com',
    });
    expect(candidates).toEqual([{
      contactId: 'contact-a',
      displayName: 'Maria Silva',
      phone: '51999999999',
      email: 'maria@example.com',
      matchReasons: ['phone_exact', 'email_exact'],
      openLeadCount: 2,
    }]);
    expect(JSON.stringify(candidates)).not.toContain('patient');
  });

  it('calls the RELEASED prospect identity resolver with stable caller IDs and explicit mode', async () => {
    rpc.mockResolvedValueOnce({
      data: [{
        contact_id: 'contact-existing',
        lead_id: 'lead-new',
        resolution_mode: 'explicit_reuse',
      }],
      error: null,
    });

    const result = await resolveCurrentClinicCrmProspectIdentity({
      contactId: 'contact-draft',
      leadId: 'lead-new',
      name: '  Maria Prospect  ',
      phone: '  51999999999  ',
      email: '  maria@example.com  ',
      title: '  Avaliação comercial  ',
      pipelineId: 'pipeline-a',
      resolutionMode: 'explicit_reuse',
      selectedContactId: 'contact-existing',
      distinctReason: null,
    });

    expect(rpc).toHaveBeenCalledWith('resolve_current_clinic_crm_prospect_identity', {
      p_contact_id: 'contact-draft',
      p_lead_id: 'lead-new',
      p_name: 'Maria Prospect',
      p_title: 'Avaliação comercial',
      p_resolution_mode: 'explicit_reuse',
      p_phone: '51999999999',
      p_email: 'maria@example.com',
      p_pipeline_id: 'pipeline-a',
      p_selected_contact_id: 'contact-existing',
      p_distinct_reason: null,
    });
    expect(result).toEqual({
      contactId: 'contact-existing',
      leadId: 'lead-new',
      resolutionMode: 'explicit_reuse',
    });
  });

  it('keeps a resolved prospect successful when only the canonical CRM refetch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await executeCommercialCrmProspectResolution(
      {
        contactId: 'contact-draft',
        leadId: 'lead-new',
        name: 'Maria Prospect',
        phone: null,
        email: null,
        title: 'Avaliação comercial',
        pipelineId: 'pipeline-a',
        resolutionMode: 'create_if_clear',
      },
      {
        resolve: vi.fn().mockResolvedValue({
          contactId: 'contact-draft',
          leadId: 'lead-new',
          resolutionMode: 'create_if_clear',
        }),
        refresh: vi.fn().mockRejectedValue(new Error('projection unavailable')),
      },
    );

    expect(result.command).toEqual({
      contactId: 'contact-draft',
      leadId: 'lead-new',
      resolutionMode: 'create_if_clear',
    });
    expect(result.snapshot).toBeNull();
    expect(result.projection).toBe('stale');
    expect(result.projectionWarning).toContain('Prospect resolvido');
  });

  it('creates Contact and Lead only through the released current-clinic commands', async () => {
    rpc.mockResolvedValueOnce({ data: 'contact-new', error: null });
    rpc.mockResolvedValueOnce({ data: 'lead-new', error: null });

    await createCurrentClinicCrmContact({
      contactId: 'contact-new',
      name: '  Maria Prospect  ',
      phone: '  51999999999  ',
      email: '  maria@example.com  ',
    });
    await createCurrentClinicCrmLead({
      leadId: 'lead-new',
      contactId: 'contact-new',
      title: '  Avaliação comercial  ',
      pipelineId: 'pipeline-a',
    });

    expect(rpc.mock.calls).toEqual([
      ['create_current_clinic_crm_contact', {
        p_contact_id: 'contact-new',
        p_name: 'Maria Prospect',
        p_phone: '51999999999',
        p_email: 'maria@example.com',
      }],
      ['create_current_clinic_crm_lead', {
        p_lead_id: 'lead-new',
        p_contact_id: 'contact-new',
        p_title: 'Avaliação comercial',
        p_pipeline_id: 'pipeline-a',
        p_stage_id: null,
        p_owner_id: null,
        p_value_cents: null,
        p_source: null,
      }],
    ]);
  });

  it('composes the released commands in order and never refreshes after Lead rejection', async () => {
    const createContact = vi.fn().mockResolvedValue('contact-new');
    const leadError = new Error('lead rejected');
    const createLead = vi.fn().mockRejectedValue(leadError);
    const refresh = vi.fn();

    await expect(executeCommercialCrmProspectCreation(
      {
        contactId: 'contact-new',
        leadId: 'lead-new',
        name: 'Maria Prospect',
        phone: null,
        email: null,
        title: 'Avaliação comercial',
        pipelineId: 'pipeline-a',
      },
      { createContact, createLead, refresh },
    )).rejects.toBe(leadError);

    expect(createContact).toHaveBeenCalledTimes(1);
    expect(createLead).toHaveBeenCalledTimes(1);
    expect(createContact.mock.invocationCallOrder[0]).toBeLessThan(createLead.mock.invocationCallOrder[0]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('keeps a created prospect successful when only the projection refetch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await executeCommercialCrmProspectCreation(
      {
        contactId: 'contact-new',
        leadId: 'lead-new',
        name: 'Maria Prospect',
        title: 'Avaliação comercial',
        pipelineId: 'pipeline-a',
      },
      {
        createContact: vi.fn().mockResolvedValue('contact-new'),
        createLead: vi.fn().mockResolvedValue('lead-new'),
        refresh: vi.fn().mockRejectedValue(new Error('projection unavailable')),
      },
    );

    expect(result.command).toEqual({ contactId: 'contact-new', leadId: 'lead-new' });
    expect(result.snapshot).toBeNull();
    expect(result.projection).toBe('stale');
    expect(result.projectionWarning).toContain('Prospect criado');
  });

  it('updates Lead commercial details only through the canonical RPC with the projection token', async () => {
    rpc.mockResolvedValueOnce({
      data: 'lead-a',
      error: null,
    });

    const result = await updateCurrentClinicCrmLeadDetails({
      leadId: 'lead-a',
      expectedUpdatedAt: '2026-09-28T03:00:00Z',
      title: '  Avaliação premium  ',
      valueCents: 125000,
      source: '  indicação  ',
    });

    expect(rpc).toHaveBeenCalledWith('update_current_clinic_crm_lead_details', {
      p_lead_id: 'lead-a',
      p_expected_updated_at: '2026-09-28T03:00:00Z',
      p_title: 'Avaliação premium',
      p_value_cents: 125000,
      p_source: 'indicação',
    });
    expect(result).toEqual({ leadId: 'lead-a' });
  });

  it('normalizes an empty manual source to null before the details command', async () => {
    rpc.mockResolvedValueOnce({ data: 'lead-a', error: null });

    await updateCurrentClinicCrmLeadDetails({
      leadId: 'lead-a',
      expectedUpdatedAt: '2026-09-28T03:00:00Z',
      title: 'Avaliação',
      valueCents: null,
      source: '   ',
    });

    expect(rpc).toHaveBeenCalledWith('update_current_clinic_crm_lead_details', {
      p_lead_id: 'lead-a',
      p_expected_updated_at: '2026-09-28T03:00:00Z',
      p_title: 'Avaliação',
      p_value_cents: null,
      p_source: null,
    });
  });

  it('keeps persisted Lead details successful when only the canonical refetch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await executeCommercialCrmLeadDetailsUpdate(
      {
        leadId: 'lead-a',
        expectedUpdatedAt: '2026-09-28T03:00:00Z',
        title: 'Avaliação premium',
        valueCents: 125000,
        source: 'indicação',
      },
      {
        update: vi.fn().mockResolvedValue({ leadId: 'lead-a' }),
        refresh: vi.fn().mockRejectedValue(new Error('projection unavailable')),
      },
    );

    expect(result.command).toEqual({ leadId: 'lead-a' });
    expect(result.snapshot).toBeNull();
    expect(result.projection).toBe('stale');
    expect(result.projectionWarning).toContain('Detalhes salvos');
  });

  it('does not refetch when the Lead details command itself rejects', async () => {
    const refresh = vi.fn();
    const commandError = new Error('crm_lead_details_stale');

    await expect(executeCommercialCrmLeadDetailsUpdate(
      {
        leadId: 'lead-a',
        expectedUpdatedAt: '2026-09-28T03:00:00Z',
        title: 'Avaliação stale',
        valueCents: null,
        source: null,
      },
      {
        update: vi.fn().mockRejectedValue(commandError),
        refresh,
      },
    )).rejects.toBe(commandError);

    expect(refresh).not.toHaveBeenCalled();
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
