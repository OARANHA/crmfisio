import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  userId: 'user-a' as string | null,
  isPlatformAdmin: vi.fn(),
  authCallback: null as null | ((event: string, session: { user: { id: string } } | null) => void),
}));

vi.mock('./platformAdmin', () => ({ isPlatformAdmin: testState.isPlatformAdmin }));
vi.mock('./platformSupabaseClient', () => ({
  platformSupabase: { auth: {
    getSession: vi.fn(async () => ({ data: { session: testState.userId ? { user: { id: testState.userId } } : null } })),
    onAuthStateChange: vi.fn((callback) => {
      testState.authCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
  } },
}));

import { getCachedPlatformAdminAccessStatus, resolvePlatformAdminAccess } from './platformAdminAccess';

let userSequence = 0;
function switchUser(userId: string | null) {
  testState.userId = userId;
  testState.authCallback?.('SIGNED_IN', userId ? { user: { id: userId } } : null);
}
describe('platformAdminAccess tri-state resolution', () => {
  beforeEach(() => {
    testState.isPlatformAdmin.mockReset();
    switchUser(`user-${++userSequence}`);
  });

  it('starts checking for a new authenticated user and resolves allowed', async () => {
    testState.isPlatformAdmin.mockResolvedValue(true);
    expect(getCachedPlatformAdminAccessStatus()).toBe('checking');
    await expect(resolvePlatformAdminAccess()).resolves.toEqual({ status: 'allowed' });
    expect(getCachedPlatformAdminAccessStatus()).toBe('allowed');
  });

  it('keeps a real negative authorization distinct from technical failure', async () => {
    testState.isPlatformAdmin.mockResolvedValue(false);
    await expect(resolvePlatformAdminAccess()).resolves.toEqual({ status: 'denied' });

    switchUser(`user-${++userSequence}`);
    const failure = new Error('network unavailable');
    testState.isPlatformAdmin.mockRejectedValue(failure);
    await expect(resolvePlatformAdminAccess()).resolves.toEqual({ status: 'error', cause: failure });
    expect(getCachedPlatformAdminAccessStatus()).toBe('checking');
  });

  it('treats an absent session as denied without calling the platform RPC', async () => {
    switchUser(null);
    await expect(resolvePlatformAdminAccess()).resolves.toEqual({ status: 'denied' });
    expect(testState.isPlatformAdmin).not.toHaveBeenCalled();
  });
});
