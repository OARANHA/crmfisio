import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), rpc: vi.fn() }));
vi.mock('./supabaseClient', () => ({ supabase: {
  auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange, signInWithPassword: mocks.signIn, signOut: mocks.signOut },
  rpc: mocks.rpc,
} }));
import { AuthProvider, useAuth } from './useAuth';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
const session = (id: string, token = 'token') => ({ user: { id, email: `${id}@example.test` }, access_token: token });
const profile = (id: string) => ({ id, clinic_id: `clinic-${id}`, role: 'owner', ativo: true });
let current: ReturnType<typeof useAuth>;
let event: (name: string, value: any) => Promise<void>;
let renderer: ReactTestRenderer;
function Probe() { current = useAuth(); return null; }
async function mount() { await act(async () => { renderer = create(<AuthProvider><Probe /></AuthProvider>); }); }

beforeEach(() => {
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  mocks.onAuthStateChange.mockImplementation((callback) => { event = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; });
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === 'current_tenant_access_state') return { data: 'active', error: null };
    if (name === 'current_active_profile') return { data: profile('user'), error: null };
    return { data: null, error: new Error(`unexpected rpc ${name}`) };
  });
  mocks.signOut.mockResolvedValue({ error: null });
});
afterEach(() => { if (renderer) act(() => renderer.unmount()); vi.resetAllMocks(); });

describe('AuthProvider asynchronous session resolution', () => {
  it('ignores an initial session snapshot that arrives after a newer auth event', async () => {
    const initial = deferred<any>(); mocks.getSession.mockReturnValue(initial.promise); await mount();
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'current_tenant_access_state') return { data: 'active', error: null };
      if (name === 'current_active_profile') return { data: profile('new'), error: null };
      return { data: null, error: new Error('unexpected rpc') };
    });
    await act(async () => { await event('SIGNED_IN', session('new')); });
    await act(async () => { initial.resolve({ data: { session: session('old') } }); });
    expect(current.user?.id).toBe('new');
    expect(current.session?.user.id).toBe('new');
  });

  it.each(['access', 'profile'])('does not restore the user when an old %s result arrives after logout', async (stage) => {
    await mount();
    const pending = deferred<any>();
    mocks.rpc.mockImplementationOnce(async (name: string) => {
      if (stage === 'access' && name === 'current_tenant_access_state') return pending.promise;
      return { data: 'active', error: null };
    });
    if (stage === 'profile') {
      mocks.rpc.mockImplementationOnce(async () => ({ data: 'active', error: null }));
      mocks.rpc.mockImplementationOnce(async () => pending.promise);
    }
    let old!: Promise<void>;
    await act(async () => { old = event('SIGNED_IN', session('old')); });
    await act(async () => { await current.signOut(); });
    await act(async () => { pending.resolve({ data: stage === 'access' ? 'active' : profile('old'), error: null }); await old; });
    expect(current.user).toBeNull();
    expect(current.profile).toBeNull();
    expect(current.session).toBeNull();
    expect(current.tenantAccessState).toBe('unauthenticated');
  });

  it('keeps the latest user when two access resolutions finish out of order', async () => {
    await mount();
    const pending = deferred<any>();
    mocks.rpc.mockImplementationOnce(async () => pending.promise);
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'current_tenant_access_state') return { data: 'active', error: null };
      if (name === 'current_active_profile') return { data: profile('new'), error: null };
      return { data: null, error: new Error('unexpected rpc') };
    });
    let old!: Promise<void>;
    await act(async () => { old = event('SIGNED_IN', session('old')); });
    await act(async () => { await event('SIGNED_IN', session('new')); });
    await act(async () => { pending.resolve({ data: 'active', error: null }); await old; });
    expect(current.user?.id).toBe('new');
    expect(current.profile?.clinic_id).toBe('clinic-new');
  });

  it('clears the old profile immediately while a different user is resolving', async () => {
    await mount();
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'current_tenant_access_state') return { data: 'active', error: null };
      if (name === 'current_active_profile') return { data: profile('old'), error: null };
      return { data: null, error: new Error('unexpected rpc') };
    });
    await act(async () => { await event('SIGNED_IN', session('old')); });
    const pending = deferred<any>();
    mocks.rpc.mockImplementationOnce(async () => pending.promise);
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'current_tenant_access_state') return { data: 'active', error: null };
      if (name === 'current_active_profile') return { data: profile('new'), error: null };
      return { data: null, error: new Error('unexpected rpc') };
    });
    let next!: Promise<void>;
    await act(async () => { next = event('SIGNED_IN', session('new')); });
    expect(current.profile).toBeNull(); expect(current.user).toBeNull();
    expect(current.tenantAccessState).toBe('unknown');
    await act(async () => { pending.resolve({ data: 'active', error: null }); await next; });
    expect(current.user?.id).toBe('new');
  });

  it('preserves the current profile while renewing a token for the same user', async () => {
    await mount();
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'current_tenant_access_state') return { data: 'active', error: null };
      if (name === 'current_active_profile') return { data: profile('same'), error: null };
      return { data: null, error: new Error('unexpected rpc') };
    });
    await act(async () => { await event('SIGNED_IN', session('same')); });
    const pending = deferred<any>(); mocks.rpc.mockImplementationOnce(async () => pending.promise);
    let refresh!: Promise<void>;
    await act(async () => { refresh = event('TOKEN_REFRESHED', session('same', 'renewed')); });
    expect(current.user?.id).toBe('same'); expect(current.tenantAccessState).toBe('active');
    await act(async () => { pending.resolve({ data: 'active', error: null }); await refresh; });
    expect(current.session?.access_token).toBe('renewed');
  });

  it('ignores a pending password response after an explicit logout', async () => {
    await mount(); const pending = deferred<any>(); mocks.signIn.mockReturnValue(pending.promise);
    let login!: ReturnType<typeof current.signIn>;
    await act(async () => { login = current.signIn('old@example.test', 'test-password'); });
    await act(async () => { await current.signOut(); });
    await act(async () => { pending.resolve({ data: { user: session('old').user, session: session('old') }, error: null }); await login; });
    expect(current.user).toBeNull(); expect(current.session).toBeNull();
  });

  it('does not let an obsolete login denial sign out a newer valid session', async () => {
    await mount();
    const pending = deferred<any>(); mocks.rpc.mockImplementationOnce(async () => pending.promise);
    mocks.signIn.mockResolvedValue({ data: { user: session('old').user, session: session('old') }, error: null });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'current_tenant_access_state') return { data: 'active', error: null };
      if (name === 'current_active_profile') return { data: profile('new'), error: null };
      return { data: null, error: new Error('unexpected rpc') };
    });
    let login!: ReturnType<typeof current.signIn>;
    await act(async () => { login = current.signIn('old@example.test', 'test-password'); });
    await act(async () => { await event('SIGNED_IN', session('new')); });
    await act(async () => { pending.resolve({ data: 'inactive_profile', error: null }); await login; });
    expect(current.user?.id).toBe('new'); expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('still rejects an invalid profile for the current login', async () => {
    await mount(); mocks.rpc.mockResolvedValue({ data: 'inactive_profile', error: null });
    mocks.signIn.mockResolvedValue({ data: { user: session('user').user, session: session('user') }, error: null });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await act(async () => { expect((await current.signIn('user@example.test', 'test-password')).error?.message).toBe('Usuário sem perfil ativo e válido'); });
      expect(current.user).toBeNull(); expect(current.profile).toBeNull();
      expect(mocks.signOut).toHaveBeenCalledTimes(1);
    } finally { log.mockRestore(); }
  });

  it('preserves the suspended-clinic login flow without exposing a profile', async () => {
    await mount(); mocks.rpc.mockResolvedValue({ data: 'suspended', error: null });
    mocks.signIn.mockResolvedValue({ data: { user: session('user').user, session: session('user') }, error: null });
    await act(async () => { expect(await current.signIn('user@example.test', 'test-password')).toEqual({ error: null }); });
    expect(current.tenantAccessState).toBe('suspended'); expect(current.profile).toBeNull();
    expect(current.session?.user.id).toBe('user'); expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('bootstraps the active profile exclusively through the canonical RPC', async () => {
    await mount();
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'current_tenant_access_state') return { data: 'active', error: null };
      if (name === 'current_active_profile') return { data: profile('user'), error: null };
      return { data: null, error: new Error('unexpected rpc') };
    });
    await act(async () => { await event('SIGNED_IN', session('user')); });
    expect(current.user?.id).toBe('user');
    expect(mocks.rpc).toHaveBeenCalledWith('current_active_profile');
  });

  it('fails closed if the profile RPC ever returns another user id', async () => {
    await mount();
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'current_tenant_access_state') return { data: 'active', error: null };
      if (name === 'current_active_profile') return { data: profile('other'), error: null };
      return { data: null, error: new Error('unexpected rpc') };
    });
    await act(async () => { await event('SIGNED_IN', session('user')); });
    expect(current.user).toBeNull();
    expect(current.profile).toBeNull();
  });
});
