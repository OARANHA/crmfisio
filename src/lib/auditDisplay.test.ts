import { describe, expect, it } from 'vitest';
import { auditText, auditTimestamp } from './auditDisplay';

describe('audit display', () => {
  it('formats valid timestamps without throwing', () => {
    expect(auditTimestamp('2026-09-03T03:00:27Z')).toMatch(/^03\/09 \d{2}:00:27$/);
  });

  it('keeps the audit list renderable with legacy timestamps', () => {
    expect(auditTimestamp('')).toBe('Data indisponível');
    expect(auditTimestamp(null)).toBe('Data indisponível');
    expect(auditTimestamp('not-a-date')).toBe('Data indisponível');
  });

  it('normalizes legacy null and structured values', () => {
    expect(auditText(null, 'Ação não informada')).toBe('Ação não informada');
    expect(auditText({ paciente_id: '123' }, '—')).toBe('{"paciente_id":"123"}');
  });
});
