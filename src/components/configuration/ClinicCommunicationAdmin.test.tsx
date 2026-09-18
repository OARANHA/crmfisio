import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicCommunicationAdmin } from './ClinicCommunicationAdmin';

const testState = vi.hoisted(() => ({
  role: 'owner',
  loadEntitlement: vi.fn(),
  loadTemplates: vi.fn(),
  saveTemplate: vi.fn(),
}));

vi.mock('../../lib/currentUserAccess', () => ({
  useCurrentUserAccess: () => ({ user: { role: testState.role } }),
}));

vi.mock('../../lib/toastContext', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('../../lib/messageOutbox', () => ({
  loadMessageTemplates: testState.loadTemplates,
  saveMessageTemplate: testState.saveTemplate,
}));

vi.mock('../../lib/clinicEntitlement', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/clinicEntitlement')>();
  return {
    ...actual,
    loadCurrentClinicEntitlementState: testState.loadEntitlement,
  };
});

vi.mock('../messages/AutomationControlPanel', () => ({
  AutomationControlPanel: () => <div data-testid="automation-control">automation-control</div>,
}));

vi.mock('../messages/MessageTemplatesEditor', () => ({
  MessageTemplatesEditor: ({ templates }: { templates: unknown[] }) => (
    <div data-testid="message-template-editor">templates-{templates.length}</div>
  ),
}));

async function renderPanel(): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<ClinicCommunicationAdmin />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return renderer;
}

const entitlement = (effective: boolean) => ({
  clinicId: 'clinic-a',
  key: 'whatsapp.access' as const,
  configured: true,
  enabled: effective,
  effective,
  source: 'manual' as const,
  startsAt: null,
  expiresAt: null,
  updatedAt: null,
});

describe('ClinicCommunicationAdmin', () => {
  beforeEach(() => {
    testState.role = 'owner';
    testState.loadEntitlement.mockReset();
    testState.loadTemplates.mockReset();
    testState.saveTemplate.mockReset();
    testState.loadTemplates.mockResolvedValue([
      { id: 't1', template: 'confirmacao', body: 'Oi {nome}', active: true },
    ]);
  });

  it('renders automation and template configuration only after entitlement allows it', async () => {
    testState.loadEntitlement.mockResolvedValue(entitlement(true));
    const renderer = await renderPanel();

    expect(testState.loadEntitlement).toHaveBeenCalledWith('whatsapp.access');
    expect(testState.loadTemplates).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByProps({ 'data-testid': 'automation-control' })).toBeTruthy();
    expect(renderer.root.findByProps({ 'data-testid': 'message-template-editor' }).children.join('')).toBe('templates-1');
    expect(JSON.stringify(renderer.toJSON())).toContain('Módulo liberado');
  });

  it('keeps clinic configuration fail-closed when the module is not entitled', async () => {
    testState.loadEntitlement.mockResolvedValue(entitlement(false));
    const renderer = await renderPanel();
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain('Módulo não liberado');
    expect(renderer.root.findAllByProps({ 'data-testid': 'automation-control' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'message-template-editor' })).toHaveLength(0);
    expect(testState.loadTemplates).not.toHaveBeenCalled();
  });

  it('shows a retryable technical error when entitlement or templates cannot load', async () => {
    testState.loadEntitlement.mockResolvedValue(entitlement(true));
    testState.loadTemplates.mockRejectedValue(new Error('rpc unavailable'));
    const renderer = await renderPanel();
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain('Validação indisponível');
    expect(rendered).toContain('permanece bloqueada por segurança');
    expect(renderer.root.findAllByProps({ 'data-testid': 'automation-control' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'message-template-editor' })).toHaveLength(0);
  });

  it('does not expose administrative controls to a non-manager presentation context', async () => {
    testState.role = 'professional';
    testState.loadEntitlement.mockResolvedValue(entitlement(true));
    const renderer = await renderPanel();

    expect(JSON.stringify(renderer.toJSON())).toContain('Configurações indisponíveis para o acesso atual');
    expect(testState.loadEntitlement).not.toHaveBeenCalled();
    expect(testState.loadTemplates).not.toHaveBeenCalled();
    expect(renderer.root.findAllByProps({ 'data-testid': 'automation-control' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'message-template-editor' })).toHaveLength(0);
  });
});