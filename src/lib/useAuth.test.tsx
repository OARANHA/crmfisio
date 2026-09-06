import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock('./supabaseClient', () => ({ supabase: {
  auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange, signInWithPassword: mocks.signIn, signOut: mocks.signOut },
  rpc: mocks.rpc, from: mocks.from,
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
  mocks.rpc.mockResolvedValue({ data: 'active', error: null });
  mocks.from.mockImplementation(() => {
    let id = '';
    const query: any = { select: () => query, eq: (field: string, value: string) => { if (field === 'id') id = value; return query; }, single: async () => ({ data: profile(id), error: null }) };
    return query;
  });
  mocks.signOut.mockResolvedValue({ error: null });
});
afterEach(() => { if (renderer) act(() => renderer.unmount()); vi.resetAllMocks(); });

describe('AuthProvider asynchronous session resolution', () => {
  it('ignores an initial session snapshot that arrives after a newer auth event', async () => {
    const initial = deferred<any>(); mocks.getSession.mockReturnValue(initial.promise); await mount();
    await act(async () => { await event('SIGNED_IN', session('new')); });
    await act(async () => { initial.resolve({ data: { session: session('old') } }); });
    expect(current.user?.id).toBe('new');
    expect(current.session?.user.id).toBe('new');
  });

  it.each(['access', 'profile'])('does not restore the user when an old %s result arrives after logout', async (stage) => {
    await mount();
    const pending = deferred<any>();
    if (stage === 'access') mocks.rpc.mockReturnValueOnce(pending.promise);
    else mocks.from.mockReturnValueOnce({ select() { return this; }, eq() { return this; }, single: () => pending.promise });
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
    const pending = deferred<any>(); mocks.rpc.mockReturnValueOnce(pending.promise);
    let old!: Promise<void>;
    await act(async () => { old = event('SIGNED_IN', session('old')); });
    await act(async () => { await event('SIGNED_IN', session('new')); });
    await act(async () => { pending.resolve({ data: 'active', error: null }); await old; });
    expect(current.user?.id).toBe('new');
    expect(current.profile?.clinic_id).toBe('clinic-new');
  });

  it('clears the old profile immediately while a different user is resolving', async () => {
    await mount(); await act(async () => { await event('SIGNED_IN', session('old')); });
    const pending = deferred<any>(); mocks.rpc.mockReturnValueOnce(pending.promise);
    let next!: Promise<void>;
    await act(async () => { next = event('SIGNED_IN', session('new')); });
    expect(current.profile).toBeNull(); expect(current.user).toBeNull();
    expect(current.tenantAccessState).toBe('unknown');
    await act(async () => { pending.resolve({ data: 'active', error: null }); await next; });
    expect(current.user?.id).toBe('new');
  });

  it('preserves the current profile while renewing a token for the same user', async () => {
    await mount(); await act(async () => { await event('SIGNED_IN', session('same')); });
    const pending = deferred<any>(); mocks.rpc.mockReturnValueOnce(pending.promise);
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
    const pending = deferred<any>(); mocks.rpc.mockReturnValueOnce(pending.promise);
    mocks.signIn.mockResolvedValue({ data: { user: session('old').user, session: session('old') }, error: null });
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
});
