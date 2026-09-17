import type { ReactElement, ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  cachedStatus: 'checking' as 'checking' | 'allowed' | 'denied' | 'error',
  resolution: { status: 'error', cause: new Error('network unavailable') } as
    | { status: 'allowed' }
    | { status: 'denied' }
    | { status: 'error'; cause: unknown },
  session: { user: { id: 'platform-user' } } as { user: { id: string } } | null,
  loadSettings: vi.fn(),
  loadRuns: vi.fn(),
  loadAudit: vi.fn(),
}));

vi.mock('react-router-dom', () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));
vi.mock('../components/PlatformAdminShell', () => ({
  PlatformAdminShell: ({ title, children }: { title: string; children: ReactNode }) => <div data-title={title}>{children}</div>,
}));
vi.mock('../lib/platformAdminAccess', () => ({
  getCachedPlatformAdminAccessStatus: () => testState.cachedStatus,
  resolvePlatformAdminAccess: vi.fn(async () => testState.resolution),
}));
vi.mock('../lib/platformSupabaseClient', () => ({
  platformSupabase: { auth: {
    getSession: vi.fn(async () => ({ data: { session: testState.session } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(async () => ({ error: null })),
  } },
}));
vi.mock('../lib/platformAdmin', () => ({
  loadPlatformAutomationSettings: testState.loadSettings,
  loadPlatformAutomationRuns: testState.loadRuns,
  loadPlatformAuditLog: testState.loadAudit,
  setPlatformAutomationSetting: vi.fn(),
}));

import { PlatformRevenuePage } from './PlatformRevenuePage';
import { PlatformAdminPage } from './PlatformAdminPage';

async function renderPage(element: ReactElement): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return renderer;
}
describe('Platform Admin tri-state authorization UI', () => {
  beforeEach(() => {
    testState.cachedStatus = 'checking';
    testState.resolution = { status: 'error', cause: new Error('network unavailable') };
    testState.session = { user: { id: 'platform-user' } };
    testState.loadSettings.mockReset().mockResolvedValue([]);
    testState.loadRuns.mockReset().mockResolvedValue([]);
    testState.loadAudit.mockReset().mockResolvedValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('renders verification failure instead of access denied on a technical error', async () => {
    const renderer = await renderPage(<PlatformRevenuePage />);
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain('Não foi possível verificar os privilégios de Platform Admin');
    expect(rendered).not.toContain('Acesso negado');
  });

  it('does not leave governance stuck in privilege loading when authorization fails technically', async () => {
    const renderer = await renderPage(<PlatformAdminPage />);
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain('Não foi possível verificar os privilégios de Platform Admin');
    expect(rendered).not.toContain('Validando privilégios da plataforma');
  });
  it('keeps authorization allowed when governance data loading fails', async () => {
    testState.resolution = { status: 'allowed' };
    testState.loadSettings.mockRejectedValue(new Error('data source unavailable'));

    const renderer = await renderPage(<PlatformAdminPage />);
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain('Governança');
    expect(rendered).toContain('Não foi possível carregar a governança da plataforma.');
    expect(rendered).not.toContain('Não foi possível verificar os privilégios de Platform Admin');
    expect(rendered).not.toContain('Acesso negado');
  });
});
