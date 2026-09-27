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
  listCandidates: vi.fn(),
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
    listCurrentClinicCrmContactIdentityCandidates: testState.listCandidates,
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
    testState.listCandidates.mockReset().mockResolvedValue([]);
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

    testState.role = 'recep';
    const reception = await renderBoard();
    expect(JSON.stringify(reception.toJSON())).toContain('avançar para Perdido');
    expect(JSON.stringify(reception.toJSON())).toContain('Novo prospect');
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
    expect(rendered).toContain('2 Contact(s) candidato(s)');
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
