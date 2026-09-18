import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicCommunicationAdmin } from './ClinicCommunicationAdmin';

const testState = vi.hoisted(() => ({
  role: 'owner',
  loadEntitlement: vi.fn(),
}));

vi.mock('../../lib/currentUserAccess', () => ({
  useCurrentUserAccess: () => ({ user: { role: testState.role } }),
}));

vi.mock('../../lib/toastContext', () => ({
  useToast: () => ({ toast: vi.fn() }),
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
  });

  it('renders the existing automation configuration only after entitlement allows it', async () => {
    testState.loadEntitlement.mockResolvedValue(entitlement(true));
    const renderer = await renderPanel();

    expect(testState.loadEntitlement).toHaveBeenCalledWith('whatsapp.access');
    expect(renderer.root.findByProps({ 'data-testid': 'automation-control' })).toBeTruthy();
    expect(JSON.stringify(renderer.toJSON())).toContain('Módulo liberado');
  });

  it('keeps clinic configuration fail-closed when the module is not entitled', async () => {
    testState.loadEntitlement.mockResolvedValue(entitlement(false));
    const renderer = await renderPanel();
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain('Módulo não liberado');
    expect(rendered).toContain('Mensagens / WhatsApp não está disponível para esta clínica');
    expect(renderer.root.findAllByProps({ 'data-testid': 'automation-control' })).toHaveLength(0);
  });

  it('shows a retryable technical error instead of pretending the product is denied', async () => {
    testState.loadEntitlement.mockRejectedValue(new Error('rpc unavailable'));
    const renderer = await renderPanel();
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain('Validação indisponível');
    expect(rendered).toContain('permanece bloqueada por segurança');
    expect(renderer.root.findAllByProps({ 'data-testid': 'automation-control' })).toHaveLength(0);
  });

  it('does not expose administrative controls to a non-manager presentation context', async () => {
    testState.role = 'professional';
    testState.loadEntitlement.mockResolvedValue(entitlement(true));
    const renderer = await renderPanel();

    expect(JSON.stringify(renderer.toJSON())).toContain('Configurações indisponíveis para o acesso atual');
    expect(testState.loadEntitlement).not.toHaveBeenCalled();
    expect(renderer.root.findAllByProps({ 'data-testid': 'automation-control' })).toHaveLength(0);
  });
});
