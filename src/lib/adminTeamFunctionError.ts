const SAFE_ADMIN_TEAM_MESSAGES = new Set([
  'Método não permitido',
  'Sessão ausente',
  'Sessão inválida',
  'Usuário sem perfil ativo',
  'Clínica suspensa ou indisponível',
  'JSON inválido',
  'Troca de senha obrigatória antes de continuar',
  'A nova senha deve ter ao menos 8 caracteres',
  'Apenas administradores podem gerenciar a equipe',
  'Permissões clínicas inválidas',
  'Nome, e-mail, perfil e senha inicial são obrigatórios',
  'A senha inicial deve ter ao menos 8 caracteres',
  'Perfil de acesso inválido',
  'Unidades inválidas',
  'Usuário não informado',
  'Usuário não pertence à clínica',
  'O proprietário não pode ser alterado por outro usuário',
  'Você não pode desativar o próprio usuário',
  'O papel proprietário e suas unidades não podem ser alterados por este fluxo',
  'Nome é obrigatório',
  'Ação inválida',
  'Falha ao gerenciar equipe',
]);

type JsonReadable = {
  json?: () => Promise<unknown>;
  clone?: () => JsonReadable;
};

export function safeAdminTeamServerMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const message = value.trim();
  return SAFE_ADMIN_TEAM_MESSAGES.has(message) ? message : null;
}

export async function resolveAdminTeamFunctionError(error: unknown, fallback: string): Promise<string> {
  if (!error || typeof error !== 'object') return fallback;
  const context = (error as { context?: unknown }).context;
  if (!context || typeof context !== 'object') return fallback;

  try {
    const response = context as JsonReadable;
    const readable = typeof response.clone === 'function' ? response.clone() : response;
    if (typeof readable.json !== 'function') return fallback;
    const payload = await readable.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
    return safeAdminTeamServerMessage((payload as { error?: unknown }).error) ?? fallback;
  } catch {
    return fallback;
  }
}
