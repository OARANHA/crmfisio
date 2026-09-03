import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function auditText(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value.trim() || fallback;
  if (value === null || value === undefined) return fallback;

  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

export function auditTimestamp(value: unknown): string {
  if (typeof value !== 'string' && !(value instanceof Date)) return 'Data indisponível';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';

  return format(date, 'dd/MM HH:mm:ss', { locale: ptBR });
}
