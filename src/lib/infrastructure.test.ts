import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./supabaseClient', () => ({ supabase: { from } }));
import { loadInfrastructure } from './infrastructure';

function query(data: unknown[], error: unknown = null) {
  const builder = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockResolvedValue({ data, error });
  return builder;
}

beforeEach(() => vi.clearAllMocks());

describe('loadInfrastructure', () => {
  it('scopes both reads to the clinic and active resources, preserving room-to-unit links', async () => {
    const units = query([{ id: 'u1', nome: 'Centro', endereco: null }]);
    const rooms = query([{ id: 'r1', nome: 'Sala 1', tipo: 'sala', unit_id: 'u1' }]);
    from.mockImplementation((table) => table === 'units' ? units : rooms);
    await expect(loadInfrastructure('clinic-a')).resolves.toEqual({
      unidades: [{ id: 'u1', nome: 'Centro', endereco: '' }],
      rooms: [{ id: 'r1', nome: 'Sala 1', tipo: 'sala', unidadeId: 'u1' }],
    });
    for (const builder of [units, rooms]) {
      expect(builder.eq).toHaveBeenCalledWith('clinic_id', 'clinic-a');
      expect(builder.eq).toHaveBeenCalledWith('ativo', true);
    }
  });

  it.each(['units', 'rooms'])('rejects a failed %s read instead of publishing partial infrastructure', async (failedTable) => {
    const error = new Error('read denied');
    from.mockImplementation((table) => query([], table === failedTable ? error : null));
    await expect(loadInfrastructure('clinic-a')).rejects.toBe(error);
  });
});
