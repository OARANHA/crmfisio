import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: { rpc: mocks.rpc },
}));

import { useClinicalCapability } from './useClinicalCapability';

type HookState = ReturnType<typeof useClinicalCapability>;

let current: HookState;
let renderer: ReactTestRenderer | undefined;

function Probe({ userId = 'user-1' }: { userId?: string | null }) {
  current = useClinicalCapability('clinical.attend', userId);
  return null;
}

beforeEach(() => {
  mocks.rpc.mockReset();
});

afterEach(() => {
  if (renderer) {
    act(() => renderer?.unmount());
    renderer = undefined;
  }
  vi.restoreAllMocks();
});

describe('useClinicalCapability frontend contract', () => {
  it('calls the canonical RPC argument p_capability and exposes loading before resolution', async () => {
    let resolveRpc!: (value: { data: boolean; error: null }) => void;
    mocks.rpc.mockImplementation(() => new Promise((resolve) => { resolveRpc = resolve; }));

    await act(async () => {
      renderer = create(<Probe />);
    });

    expect(mocks.rpc).toHaveBeenCalledWith('current_user_has_clinical_capability', {
      p_capability: 'clinical.attend',
    });
    expect(current).toMatchObject({ status: 'loading', loading: true, allowed: false, denied: false, error: false });

    await act(async () => {
      resolveRpc({ data: true, error: null });
    });

    expect(current).toMatchObject({ status: 'allowed', loading: false, allowed: true, denied: false, error: false });
  });

  it('maps RPC false to denied', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    await act(async () => {
      renderer = create(<Probe />);
    });

    expect(current).toMatchObject({ status: 'denied', allowed: false, denied: true, error: false });
  });

  it('maps RPC errors to error without granting capability', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'postgrest failure' } });

    await act(async () => {
      renderer = create(<Probe />);
    });

    expect(current).toMatchObject({ status: 'error', allowed: false, denied: false, error: true });
  });

  it('maps rejected RPC calls to error without granting capability', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.rpc.mockRejectedValue(new Error('network failure'));

    await act(async () => {
      renderer = create(<Probe />);
    });

    expect(current).toMatchObject({ status: 'error', allowed: false, denied: false, error: true });
  });

  it('is denied without an authenticated user and does not call the RPC', async () => {
    await act(async () => {
      renderer = create(<Probe userId={null} />);
    });

    expect(current).toMatchObject({ status: 'denied', allowed: false, denied: true, loading: false, error: false });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
