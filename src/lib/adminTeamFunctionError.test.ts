import { describe, expect, it } from 'vitest';
import { resolveAdminTeamFunctionError, safeAdminTeamServerMessage } from './adminTeamFunctionError';

const httpError = (payload: unknown) => ({
  context: {
    clone: () => ({ json: async () => payload }),
  },
});

describe('admin-team Edge Function error normalization', () => {
  it('recovers an explicitly safe JSON error from a FunctionsHttpError-like context', async () => {
    await expect(resolveAdminTeamFunctionError(
      httpError({ error: 'Perfil de acesso inválido' }),
      'Não foi possível salvar o profissional.',
    )).resolves.toBe('Perfil de acesso inválido');
  });

  it('does not expose raw SQL or constraint details from an older deployed Edge response', async () => {
    await expect(resolveAdminTeamFunctionError(
      httpError({ error: 'duplicate key value violates unique constraint profiles_role_check' }),
      'Não foi possível salvar o profissional.',
    )).resolves.toBe('Não foi possível salvar o profissional.');
  });

  it('falls back when the FunctionsHttpError response body is not JSON-readable', async () => {
    await expect(resolveAdminTeamFunctionError(
      { context: { json: async () => { throw new Error('invalid json'); } } },
      'Não foi possível salvar o profissional.',
    )).resolves.toBe('Não foi possível salvar o profissional.');
  });

  it('does not trust arbitrary success-payload error strings either', () => {
    expect(safeAdminTeamServerMessage('relation profiles does not exist')).toBeNull();
    expect(safeAdminTeamServerMessage('Permissões clínicas inválidas')).toBe('Permissões clínicas inválidas');
  });
});
