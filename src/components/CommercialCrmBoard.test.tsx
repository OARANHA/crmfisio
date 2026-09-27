import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommercialCrmSnapshot } from '../lib/commercialCrm';
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

describe('CommercialCrmBoard', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
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

    testState.role = 'recep';
    const reception = await renderBoard();
    expect(JSON.stringify(reception.toJSON())).toContain('avançar para Perdido');
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
