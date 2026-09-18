import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./supabaseClient', () => ({ supabase: { from } }));

import { saveAutomationSettings, type AutomationSettings } from './automation';

const settings: AutomationSettings = {
  clinicId: 'clinic-a',
  confirmationsEnabled: true,
  confirmationHours: 48,
  npsEnabled: true,
  npsDelayMinutes: 15,
  npsLookbackDays: 7,
  waitlistAutoEnabled: true,
  waitlistOfferLimit: 3,
  waitlistExpiryMinutes: 30,
  reactivationEnabled: false,
  reactivationInactiveDays: 30,
  reactivationCooldownDays: 30,
  reactivationLimitPerRun: 10,
  sendWindowStart: '08:00',
  sendWindowEnd: '20:00',
  timezone: 'America/Sao_Paulo',
  active: true,
  updatedAt: '2026-09-17T00:00:00Z',
};

function updateQuery(result: { data: unknown; error: unknown }) {
  const builder = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
  };
  builder.update.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  return builder;
}

beforeEach(() => vi.clearAllMocks());

describe('saveAutomationSettings', () => {
  it('requires the server to return the row actually updated', async () => {
    const builder = updateQuery({ data: { clinic_id: 'clinic-a' }, error: null });
    from.mockReturnValue(builder);

    await expect(saveAutomationSettings(settings)).resolves.toBeUndefined();
    expect(from).toHaveBeenCalledWith('automation_settings');
    expect(builder.eq).toHaveBeenCalledWith('clinic_id', 'clinic-a');
    expect(builder.select).toHaveBeenCalledWith('clinic_id');
  });

  it('does not report success when RLS filters the update to zero rows', async () => {
    const builder = updateQuery({ data: null, error: null });
    from.mockReturnValue(builder);

    await expect(saveAutomationSettings(settings)).rejects.toThrow(
      'A configuração não pôde ser alterada com o acesso atual.',
    );
  });

  it('propagates a backend error', async () => {
    const error = new Error('write failed');
    const builder = updateQuery({ data: null, error });
    from.mockReturnValue(builder);

    await expect(saveAutomationSettings(settings)).rejects.toBe(error);
  });
});
