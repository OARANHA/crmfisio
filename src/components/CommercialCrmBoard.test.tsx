import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommercialCrmIdentityCandidate, CommercialCrmSnapshot } from '../lib/commercialCrm';
import { CommercialCrmBoard } from './CommercialCrmBoard';

const testState = vi.hoisted(() => ({
  role: 'owner',
  snapshot: {
    pipelines: [
      { id: 'pipeline-a', name: 'Comercial', isDefault: true, archivedAt: null },
      { id: 'pipeline-b', name: 'Parcerias', isDefault: false, archivedAt: null },
    ],
    stages: [
      { id: 'stage-open', pipelineId: 'pipeline-a', name: 'Novo', position: 0, stageKind: 'open', archivedAt: null },
      { id: 'stage-lost', pipelineId: 'pipeline-a', name: 'Perdido', position: 1, stageKind: 'lost', archivedAt: null },
      { id: 'stage-b', pipelineId: 'pipeline-b', name: 'Entrada', position: 0, stageKind: 'open', archivedAt: null },
    ],
    leads: [
      {
        id: 'lead-a',
        title: 'Avaliação inicial',
        valueCents: null,
        source: 'site',
        lostReasonCode: null,
        lostReasonDetail: null,
        closedAt: null,
        updatedAt: '2026-09-28T03:00:00Z',
        ownerId: null,
        contactId: 'contact-a',
        contactName: 'Maria Silva',
        contactPhone: '51999999999',
        contactEmail: 'maria@example.com',
        contactPatientId: null,
        contactAnonymizedAt: null,
        pipelineId: 'pipeline-a',
        pipelineName: 'Comercial',
        stageId: 'stage-open',
        stageName: 'Novo',
        stageKind: 'open',
        stagePosition: 0,
      },
    ],
  } as CommercialCrmSnapshot,
  load: vi.fn(),
  execute: vi.fn(),
  executeDetails: vi.fn(),
  listCandidates: vi.fn(),
  listActivities: vi.fn(),
  executeResolution: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('../lib/currentUserAccess', () => ({
  useCurrentUserAccess: () => ({ user: { id: 'user-a', role: testState.role } }),
}));

vi.mock('../lib/toastContext', () => ({
  useToast: () => ({ toast: testState.toast }),
}));

vi.mock('../lib/commercialCrm', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/commercialCrm')>();
  return {
    ...original,
    loadCurrentClinicCommercialCrm: testState.load,
    executeCommercialCrmStageTransition: testState.execute,
    executeCommercialCrmLeadDetailsUpdate: testState.executeDetails,
    listCurrentClinicCrmContactIdentityCandidates: testState.listCandidates,
    listCurrentClinicCrmLeadActivities: testState.listActivities,
    executeCommercialCrmProspectResolution: testState.executeResolution,
  };
});

async function renderBoard(): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<CommercialCrmBoard />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return renderer;
}

function baseSnapshot(): CommercialCrmSnapshot {
  return {
    pipelines: [
      { id: 'pipeline-a', name: 'Comercial', isDefault: true, archivedAt: null },
      { id: 'pipeline-b', name: 'Parcerias', isDefault: false, archivedAt: null },
    ],
    stages: [
      { id: 'stage-open', pipelineId: 'pipeline-a', name: 'Novo', position: 0, stageKind: 'open', archivedAt: null },
      { id: 'stage-lost', pipelineId: 'pipeline-a', name: 'Perdido', position: 1, stageKind: 'lost', archivedAt: null },
      { id: 'stage-b', pipelineId: 'pipeline-b', name: 'Entrada', position: 0, stageKind: 'open', archivedAt: null },
    ],
    leads: [
      {
        id: 'lead-a',
        title: 'Avaliação inicial',
        valueCents: null,
        source: 'site',
        lostReasonCode: null,
        lostReasonDetail: null,
        closedAt: null,
        updatedAt: '2026-09-28T03:00:00Z',
        ownerId: null,
        contactId: 'contact-a',
        contactName: 'Maria Silva',
        contactPhone: '51999999999',
        contactEmail: 'maria@example.com',
        contactPatientId: null,
        contactAnonymizedAt: null,
        pipelineId: 'pipeline-a',
        pipelineName: 'Comercial',
        stageId: 'stage-open',
        stageName: 'Novo',
        stageKind: 'open',
        stagePosition: 0,
      },
    ],
  };
}

function identityCandidate(
  contactId: string,
  displayName: string,
  matchReasons: string[],
): CommercialCrmIdentityCandidate {
  return {
    contactId,
    displayName,
    phone: matchReasons.some((reason) => reason.startsWith('phone_')) ? '51999999999' : null,
    email: matchReasons.includes('email_exact') ? 'maria@example.com' : null,
    matchReasons,
    openLeadCount: 0,
  };
}

function fillProspectForm(renderer: ReactTestRenderer) {
  const openButton = renderer.root.findAllByType('button').find((button) =>
    button.props.children === 'Novo prospect',
  );
  expect(openButton).toBeTruthy();
  act(() => openButton?.props.onClick());

  const nameInput = renderer.root.findByProps({ placeholder: 'Nome do contato' });
  const phoneInput = renderer.root.findByProps({ placeholder: 'Telefone (opcional)' });
  const emailInput = renderer.root.findByProps({ placeholder: 'E-mail (opcional)' });
  const titleInput = renderer.root.findByProps({ placeholder: 'Interesse / assunto comercial' });

  act(() => {
    nameInput.props.onChange({ target: { value: '  Maria Prospect  ' } });
    phoneInput.props.onChange({ target: { value: '  51999999999  ' } });
    emailInput.props.onChange({ target: { value: '  maria@example.com  ' } });
    titleInput.props.onChange({ target: { value: '  Avaliação comercial  ' } });
  });
}

async function verifyProspect(renderer: ReactTestRenderer) {
  const verifyButton = renderer.root.findAllByType('button').find((button) =>
    button.props.children === 'Verificar e continuar',
  );
  expect(verifyButton).toBeTruthy();
  await act(async () => {
    verifyButton?.props.onClick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('CommercialCrmBoard', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn()
        .mockReturnValueOnce('contact-new')
        .mockReturnValueOnce('lead-new'),
    });
    testState.role = 'owner';
    testState.snapshot = baseSnapshot();
    testState.load.mockReset().mockImplementation(async () => testState.snapshot);
    testState.execute.mockReset().mockImplementation(async () => ({
      command: {
        leadId: 'lead-a',
        fromStageId: 'stage-open',
        toStageId: 'stage-lost',
        stageKind: 'lost',
        closedAt: '2026-09-27T12:00:00Z',
      },
      snapshot: testState.snapshot,
      projection: 'fresh',
      projectionWarning: null,
    }));
    testState.executeDetails.mockReset().mockImplementation(async () => ({
      command: { leadId: 'lead-a' },
      snapshot: testState.snapshot,
      projection: 'fresh',
      projectionWarning: null,
    }));
    testState.listCandidates.mockReset().mockResolvedValue([]);
    testState.listActivities.mockReset().mockResolvedValue([]);
    testState.executeResolution.mockReset().mockImplementation(async (input) => ({
      command: {
        contactId: input.selectedContactId ?? input.contactId,
        leadId: input.leadId,
        resolutionMode: input.resolutionMode,
      },
      snapshot: testState.snapshot,
      projection: 'fresh',
      projectionWarning: null,
    }));
    testState.toast.mockReset();
  });

  it('shows every active pipeline and selects the active default initially', async () => {
    const renderer = await renderBoard();
    const select = renderer.root.findByType('select');
    const rendered = JSON.stringify(renderer.toJSON());

    expect(select.props.value).toBe('pipeline-a');
    expect(rendered).toContain('Comercial · padrão · 1 Lead(s)');
    expect(rendered).toContain('Parcerias · 0 Lead(s)');
  });

  it('keeps professional and financeiro roles read-only while owner/admin/recep get mutation affordances', async () => {
    testState.role = 'professional';
    const professional = await renderBoard();
    expect(JSON.stringify(professional.toJSON())).toContain('visualização comercial em modo somente leitura');
    expect(JSON.stringify(professional.toJSON())).not.toContain('avançar para Perdido');
    expect(JSON.stringify(professional.toJSON())).not.toContain('Novo prospect');
    expect(JSON.stringify(professional.toJSON())).not.toContain('Editar detalhes');
    expect(JSON.stringify(professional.toJSON())).toContain('Ver histórico');

    testState.role = 'recep';
    const reception = await renderBoard();
    expect(JSON.stringify(reception.toJSON())).toContain('avançar para Perdido');
    expect(JSON.stringify(reception.toJSON())).toContain('Novo prospect');
    expect(JSON.stringify(reception.toJSON())).toContain('Editar detalhes');
  });

  it('edits only Lead commercial details with the exact projection concurrency token', async () => {
    const renderer = await renderBoard();

    const editButton = renderer.root.findAllByType('button').find((button) =>
      button.props.children === 'Editar detalhes',
    );
    expect(editButton).toBeTruthy();
    act(() => editButton?.props.onClick());

    const titleInput = renderer.root.findByProps({ placeholder: 'Interesse / assunto comercial' });
    const valueInput = renderer.root.findByProps({ placeholder: '0,00' });
    const sourceInput = renderer.root.findByProps({ placeholder: 'Ex.: indicação, site, evento' });

    act(() => {
      titleInput.props.onChange({ target: { value: '  Avaliação premium  ' } });
      valueInput.props.onChange({ target: { value: '1250,50' } });
      sourceInput.props.onChange({ target: { value: 'indicação' } });
    });

    const saveButton = renderer.root.findAllByType('button').find((button) =>
      button.props.children === 'Salvar detalhes',
    );
    expect(saveButton).toBeTruthy();

    await act(async () => {
      saveButton?.props.onClick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(testState.executeDetails).toHaveBeenCalledTimes(1);
    expect(testState.executeDetails).toHaveBeenCalledWith({
      leadId: 'lead-a',
      expectedUpdatedAt: '2026-09-28T03:00:00Z',
      title: 'Avaliação premium',
      valueCents: 125050,
      source: 'indicação',
    });
    expect(testState.execute).not.toHaveBeenCalled();
    expect(testState.executeResolution).not.toHaveBeenCalled();
  });

  it('refetches after a stale Lead details rejection and never retries the mutation silently', async () => {
    testState.executeDetails.mockRejectedValueOnce({
      message: 'crm_lead_details_stale',
      code: '40001',
    });

    const refreshed = baseSnapshot();
    refreshed.leads[0] = {
      ...refreshed.leads[0],
      title: 'Alterado por outro usuário',
      updatedAt: '2026-09-28T03:10:00Z',
    };
    testState.load
      .mockResolvedValueOnce(testState.snapshot)
      .mockResolvedValueOnce(refreshed);

    const renderer = await renderBoard();
    const editButton = renderer.root.findAllByType('button').find((button) =>
      button.props.children === 'Editar detalhes',
    );
    act(() => editButton?.props.onClick());

    const titleInput = renderer.root.findByProps({ placeholder: 'Interesse / assunto comercial' });
    act(() => titleInput.props.onChange({ target: { value: 'Tentativa stale' } }));

    const saveButton = renderer.root.findAllByType('button').find((button) =>
      button.props.children === 'Salvar detalhes',
    );
    await act(async () => {
      saveButton?.props.onClick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(testState.executeDetails).toHaveBeenCalledTimes(1);
    expect(testState.load).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Editar detalhes comerciais');
    expect(testState.toast).toHaveBeenCalledWith(
      'Este Lead mudou no servidor. O quadro foi atualizado; revise os dados antes de editar novamente.',
      'warn',
    );
  });

  it('does not expose Lead details editing for anonymized or archived Leads', async () => {
    const base = baseSnapshot();
    testState.snapshot = {
      ...base,
      pipelines: [
        ...base.pipelines,
        { id: 'pipeline-old', name: 'Antigo', isDefault: false, archivedAt: '2026-09-01T00:00:00Z' },
      ],
      stages: [
        ...base.stages,
        { id: 'stage-old', pipelineId: 'pipeline-old', name: 'Legado', position: 0, stageKind: 'open', archivedAt: null },
      ],
      leads: [
        {
          ...base.leads[0],
          id: 'lead-anon',
          contactId: 'contact-anon',
          contactAnonymizedAt: '2026-09-27T10:00:00Z',
        },
        {
          ...base.leads[0],
          id: 'lead-old',
          contactId: 'contact-old',
          contactName: 'Lead Legado',
          pipelineId: 'pipeline-old',
          pipelineName: 'Antigo',
          stageId: 'stage-old',
          stageName: 'Legado',
        },
      ],
    };

    const renderer = await renderBoard();
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain('Contato anonimizado');
    expect(rendered).toContain('Lead Legado');
    expect(renderer.root.findAllByType('button').filter((button) =>
      button.props.children === 'Editar detalhes',
    )).toHaveLength(0);
    expect(testState.executeDetails).not.toHaveBeenCalled();
  });

  it('uses create_if_clear when the canonical preview returns zero candidates', async () => {
    testState.role = 'recep';
    testState.listCandidates.mockResolvedValueOnce([]);

    const renderer = await renderBoard();
    fillProspectForm(renderer);
    await verifyProspect(renderer);

    expect(testState.executeResolution).toHaveBeenCalledTimes(1);
    expect(testState.executeResolution.mock.calls[0]?.[0]).toMatchObject({
      contactId: 'contact-new',
      leadId: 'lead-new',
      resolutionMode: 'create_if_clear',
      selectedContactId: null,
      distinctReason: null,
    });
  });

  it('requires an explicit human decision when exactly one candidate is returned', async () => {
    testState.role = 'recep';
    testState.listCandidates.mockResolvedValueOnce([
      identityCandidate('contact-a', 'Maria existente', ['phone_exact']),
    ]);

    const renderer = await renderBoard();
    fillProspectForm(renderer);
    await verifyProspect(renderer);

    const rendered = JSON.stringify(renderer.toJSON());
    expect(rendered).toContain('Decisão de identidade necessária');
    expect(rendered).toContain('Maria existente');
    expect(rendered).toContain('Criar novo Lead neste Contact');
    expect(testState.executeResolution).not.toHaveBeenCalled();
  });

  it('requires an explicit human decision when multiple candidates are returned', async () => {
    testState.role = 'recep';
    testState.listCandidates.mockResolvedValueOnce([
      identityCandidate('contact-a', 'Maria A', ['phone_exact']),
      identityCandidate('contact-b', 'Maria B', ['phone_br_legacy']),
    ]);

    const renderer = await renderBoard();
    fillProspectForm(renderer);
    await verifyProspect(renderer);

    const rendered = JSON.stringify(renderer.toJSON());
    const decisionCopy = renderer.root.findAllByType('p').find((paragraph) =>
      paragraph.children.join('') === 'O servidor encontrou 2 Contact(s) candidato(s). Revise os sinais abaixo; eles não afirmam que os registros representam a mesma pessoa.',
    );
    expect(decisionCopy).toBeTruthy();
    expect(rendered).toContain('Maria A');
    expect(rendered).toContain('Maria B');
    expect(testState.executeResolution).not.toHaveBeenCalled();
  });

  it('renders phone/email split conflict without selecting a Contact automatically', async () => {
    testState.role = 'recep';
    testState.listCandidates.mockResolvedValueOnce([
      identityCandidate('contact-phone', 'Contato telefone', ['phone_exact']),
      identityCandidate('contact-email', 'Contato e-mail', ['email_exact']),
    ]);

    const renderer = await renderBoard();
    fillProspectForm(renderer);
    await verifyProspect(renderer);

    expect(JSON.stringify(renderer.toJSON())).toContain(
      'Conflito de sinais: telefone e e-mail apontam para Contacts diferentes',
    );
    expect(testState.executeResolution).not.toHaveBeenCalled();
  });

  it('sends explicit_reuse only after the user selects a candidate', async () => {
    testState.role = 'recep';
    testState.listCandidates.mockResolvedValueOnce([
      identityCandidate('contact-existing', 'Maria existente', ['phone_exact', 'email_exact']),
    ]);

    const renderer = await renderBoard();
    fillProspectForm(renderer);
    await verifyProspect(renderer);

    const reuseButton = renderer.root.findAllByType('button').find((button) =>
      button.props.children === 'Criar novo Lead neste Contact',
    );
    expect(reuseButton).toBeTruthy();

    await act(async () => {
      reuseButton?.props.onClick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(testState.executeResolution).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'contact-new',
      leadId: 'lead-new',
      resolutionMode: 'explicit_reuse',
      selectedContactId: 'contact-existing',
      distinctReason: null,
    }));
  });

  it('blocks explicit_distinct until a non-empty reason is provided', async () => {
    testState.role = 'recep';
    testState.listCandidates.mockResolvedValueOnce([
      identityCandidate('contact-existing', 'Maria existente', ['phone_exact']),
    ]);

    const renderer = await renderBoard();
    fillProspectForm(renderer);
    await verifyProspect(renderer);

    const reasonInput = renderer.root.findByProps({ placeholder: 'Explique por que este Contact é distinto' });
    let distinctButton = renderer.root.findAllByType('button').find((button) =>
      button.props.children === 'Criar Contact distinto + Lead',
    );
    expect(distinctButton?.props.disabled).toBe(true);

    act(() => reasonInput.props.onChange({ target: { value: '  Homônima confirmada pela recepção  ' } }));

    distinctButton = renderer.root.findAllByType('button').find((button) =>
      button.props.children === 'Criar Contact distinto + Lead',
    );
    expect(distinctButton?.props.disabled).toBe(false);

    await act(async () => {
      distinctButton?.props.onClick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(testState.executeResolution).toHaveBeenCalledWith(expect.objectContaining({
      contactId: 'contact-new',
      leadId: 'lead-new',
      resolutionMode: 'explicit_distinct',
      selectedContactId: null,
      distinctReason: '  Homônima confirmada pela recepção  ',
    }));
  });

  it('surfaces a stale server rejection and refreshes candidates instead of falling back to Contact create', async () => {
    testState.role = 'recep';
    testState.listCandidates
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        identityCandidate('contact-newly-visible', 'Contato atualizado', ['email_exact']),
      ]);
    testState.executeResolution.mockRejectedValueOnce({
      message: 'crm_contact_identity_resolution_required',
      code: '23514',
    });

    const renderer = await renderBoard();
    fillProspectForm(renderer);
    await verifyProspect(renderer);

    const rendered = JSON.stringify(renderer.toJSON());
    expect(rendered).toContain('ambiguidade nova');
    expect(rendered).toContain('Contato atualizado');
    expect(testState.executeResolution).toHaveBeenCalledTimes(1);
  });

  it('retries the same create_if_clear intent with the same UUIDs without re-preview after transport uncertainty', async () => {
    testState.role = 'recep';
    testState.listCandidates
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        identityCandidate('contact-new', 'Self candidate after hidden commit', ['phone_exact']),
      ]);
    testState.executeResolution
      .mockRejectedValueOnce(new Error('uncertain response'))
      .mockImplementationOnce(async (input) => ({
        command: {
          contactId: input.contactId,
          leadId: input.leadId,
          resolutionMode: input.resolutionMode,
        },
        snapshot: testState.snapshot,
        projection: 'fresh',
        projectionWarning: null,
      }));

    const renderer = await renderBoard();
    fillProspectForm(renderer);
    await verifyProspect(renderer);

    expect(testState.listCandidates).toHaveBeenCalledTimes(1);
    expect(testState.executeResolution).toHaveBeenCalledTimes(1);
    expect(testState.executeResolution.mock.calls[0]?.[0]).toMatchObject({
      contactId: 'contact-new',
      leadId: 'lead-new',
      resolutionMode: 'create_if_clear',
      selectedContactId: null,
      distinctReason: null,
    });

    const renderedAfterUncertainty = JSON.stringify(renderer.toJSON());
    expect(renderedAfterUncertainty).toContain('Repetir mesma tentativa');
    expect(renderedAfterUncertainty).toContain('sem refazer o preview');

    const retryButton = renderer.root.findAllByType('button').find((button) =>
      button.props.children === 'Repetir mesma tentativa',
    );
    expect(retryButton).toBeTruthy();

    await act(async () => {
      retryButton?.props.onClick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(testState.listCandidates).toHaveBeenCalledTimes(1);
    expect(testState.executeResolution).toHaveBeenCalledTimes(2);
    expect(testState.executeResolution.mock.calls[1]?.[0]).toMatchObject({
      contactId: 'contact-new',
      leadId: 'lead-new',
      resolutionMode: 'create_if_clear',
      selectedContactId: null,
      distinctReason: null,
    });
  });

  it('loads the selected Lead timeline on demand and renders only bounded event copy', async () => {
    testState.listActivities.mockResolvedValueOnce([
      {
        id: 'activity-created',
        activityType: 'lead_created',
        createdAt: '2026-09-27T09:00:00Z',
        fromStageId: null,
        toStageId: null,
        resolutionMode: null,
      },
      {
        id: 'activity-stage',
        activityType: 'stage_changed',
        createdAt: '2026-09-27T10:00:00Z',
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
      {
        id: 'activity-details',
        activityType: 'lead_details_updated',
        createdAt: '2026-09-27T11:30:00Z',
        fromStageId: null,
        toStageId: null,
        resolutionMode: null,
      },
      {
        id: 'activity-future',
        activityType: 'future_sensitive_event',
        createdAt: '2026-09-27T12:00:00Z',
        fromStageId: null,
        toStageId: null,
        resolutionMode: null,
        metadata: {
          candidate_ids: ['contact-secret'],
          phone: '51999990000',
          patient_id: 'patient-secret',
        },
        actorId: 'actor-secret',
      },
    ]);

    const renderer = await renderBoard();
    const historyButton = renderer.root.findAllByType('button').find((button) =>
      button.props.children === 'Ver histórico',
    );
    expect(historyButton).toBeTruthy();

    await act(async () => {
      historyButton?.props.onClick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(testState.listActivities).toHaveBeenCalledWith('lead-a');
    const rendered = JSON.stringify(renderer.toJSON());
    expect(rendered).toContain('Histórico comercial do Lead');
    expect(rendered).toContain('Timeline operacional do CRM comercial. Não é histórico clínico.');
    expect(rendered).toContain('Lead criado no CRM comercial.');
    expect(rendered).toContain('Etapa alterada de \\"Novo\\" para \\"Perdido\\".');
    expect(rendered).toContain('Contact existente reutilizado por decisão explícita.');
    expect(rendered).toContain('Detalhes comerciais do Lead atualizados.');
    expect(rendered).toContain('Atividade comercial registrada.');
    expect(rendered).not.toContain('future_sensitive_event');
    expect(rendered).not.toContain('contact-secret');
    expect(rendered).not.toContain('51999990000');
    expect(rendered).not.toContain('patient-secret');
    expect(rendered).not.toContain('actor-secret');
  });

  it('shows timeline loading and empty states without preloading every Lead history', async () => {
    let resolveActivities!: (activities: unknown[]) => void;
    testState.listActivities.mockReturnValueOnce(new Promise((resolve) => {
      resolveActivities = resolve;
    }));

    const renderer = await renderBoard();
    expect(testState.listActivities).not.toHaveBeenCalled();

    const historyButton = renderer.root.findAllByType('button').find((button) =>
      button.props.children === 'Ver histórico',
    );
    act(() => historyButton?.props.onClick());

    expect(JSON.stringify(renderer.toJSON())).toContain('Carregando histórico comercial…');

    await act(async () => {
      resolveActivities([]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('Nenhuma atividade comercial registrada.');
  });

  it('shows a bounded timeline error and allows retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    testState.listActivities
      .mockRejectedValueOnce(new Error('backend detail that must not be rendered'))
      .mockResolvedValueOnce([]);

    const renderer = await renderBoard();
    const historyButton = renderer.root.findAllByType('button').find((button) =>
      button.props.children === 'Ver histórico',
    );

    await act(async () => {
      historyButton?.props.onClick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    let rendered = JSON.stringify(renderer.toJSON());
    expect(rendered).toContain('Não foi possível carregar o histórico comercial deste Lead.');
    expect(rendered).not.toContain('backend detail that must not be rendered');

    const retryButton = renderer.root.findAllByType('button').find((button) =>
      button.props.children === 'Tentar novamente',
    );
    await act(async () => {
      retryButton?.props.onClick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    rendered = JSON.stringify(renderer.toJSON());
    expect(testState.listActivities).toHaveBeenCalledTimes(2);
    expect(rendered).toContain('Nenhuma atividade comercial registrada.');
  });

  it('suppresses Contact PII and free-form Lead title when the Contact is anonymized', async () => {
    testState.snapshot = {
      ...baseSnapshot(),
      leads: [{
        ...baseSnapshot().leads[0],
        title: 'SEGREDO NO TITULO',
        contactName: 'NOME SEGREDO',
        contactPhone: '51911112222',
        contactEmail: 'segredo@example.com',
        contactPatientId: 'patient-secret',
        contactAnonymizedAt: '2026-09-27T10:00:00Z',
      }],
    };
    const renderer = await renderBoard();
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain('Contato anonimizado');
    expect(rendered).toContain('Dados comerciais identificáveis ocultados.');
    expect(rendered).not.toContain('SEGREDO NO TITULO');
    expect(rendered).not.toContain('NOME SEGREDO');
    expect(rendered).not.toContain('51911112222');
    expect(rendered).not.toContain('segredo@example.com');
    expect(rendered).not.toContain('patient-secret');
    expect(rendered).not.toContain('Editar detalhes');

    const historyButton = renderer.root.findAllByType('button').find((button) =>
      button.props.children === 'Ver histórico',
    );
    await act(async () => {
      historyButton?.props.onClick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const timelineRendered = JSON.stringify(renderer.toJSON());
    expect(timelineRendered).toContain('Histórico comercial do Lead');
    expect(timelineRendered).toContain('Contato anonimizado');
    expect(timelineRendered).not.toContain('SEGREDO NO TITULO');
    expect(timelineRendered).not.toContain('NOME SEGREDO');
    expect(timelineRendered).not.toContain('51911112222');
    expect(timelineRendered).not.toContain('segredo@example.com');
    expect(timelineRendered).not.toContain('patient-secret');
  });

  it('keeps Leads in archived pipeline or stage visible in an explicit read-only legacy section', async () => {
    const base = baseSnapshot();
    testState.snapshot = {
      ...base,
      pipelines: [
        ...base.pipelines,
        { id: 'pipeline-old', name: 'Comercial antigo', isDefault: false, archivedAt: '2026-09-01T00:00:00Z' },
      ],
      stages: [
        ...base.stages,
        { id: 'stage-old', pipelineId: 'pipeline-old', name: 'Legado', position: 0, stageKind: 'open', archivedAt: null },
      ],
      leads: [
        ...base.leads,
        {
          ...base.leads[0],
          id: 'lead-old',
          contactId: 'contact-old',
          contactName: 'Lead Legado',
          pipelineId: 'pipeline-old',
          pipelineName: 'Comercial antigo',
          stageId: 'stage-old',
          stageName: 'Legado',
        },
      ],
    };

    const renderer = await renderBoard();
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain('Leads arquivados / legado · 1');
    expect(rendered).toContain('Lead Legado');
    const legacyContext = renderer.root.findAllByType('p').find((paragraph) =>
      paragraph.children.join('') === 'Comercial antigo · Legado',
    );
    expect(legacyContext).toBeTruthy();
    expect(rendered).toContain('somente leitura');
  });

  it('requires a non-empty lost reason before invoking the canonical command', async () => {
    const renderer = await renderBoard();
    const advance = renderer.root.findAllByType('button').find((button) =>
      String(button.props.children).includes('avançar para Perdido'),
    );
    expect(advance).toBeTruthy();

    act(() => advance?.props.onClick());

    const input = renderer.root.findByProps({ placeholder: 'Ex.: não deseja seguir neste momento' });
    const confirmBefore = renderer.root.findAllByType('button').find((button) =>
      button.props.children === 'Confirmar perda',
    );
    expect(confirmBefore?.props.disabled).toBe(true);
    expect(testState.execute).not.toHaveBeenCalled();

    act(() => input.props.onChange({ target: { value: '  Sem interesse agora  ' } }));

    const confirmAfter = renderer.root.findAllByType('button').find((button) =>
      button.props.children === 'Confirmar perda',
    );
    expect(confirmAfter?.props.disabled).toBe(false);

    await act(async () => {
      confirmAfter?.props.onClick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(testState.execute).toHaveBeenCalledWith({
      leadId: 'lead-a',
      toStageId: 'stage-lost',
      lostReasonDetail: 'Sem interesse agora',
    });
  });
});
