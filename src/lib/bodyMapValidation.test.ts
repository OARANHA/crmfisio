import { describe, expect, it } from 'vitest';
import { validateBodyMapIntensity } from './bodyMapValidation';

describe('validateBodyMapIntensity', () => {
  it('aceita campo vazio como intensidade não informada', () => {
    expect(validateBodyMapIntensity('')).toEqual({ ok: true, value: null });
  });

  it('aceita inteiros entre 0 e 10 inclusive', () => {
    expect(validateBodyMapIntensity('0')).toEqual({ ok: true, value: 0 });
    expect(validateBodyMapIntensity('5')).toEqual({ ok: true, value: 5 });
    expect(validateBodyMapIntensity('10')).toEqual({ ok: true, value: 10 });
  });

  it('rejeita valores fora da faixa clínica', () => {
    expect(validateBodyMapIntensity('-1').ok).toBe(false);
    expect(validateBodyMapIntensity('11').ok).toBe(false);
  });

  it('rejeita decimais e valores não numéricos', () => {
    expect(validateBodyMapIntensity('5.5').ok).toBe(false);
    expect(validateBodyMapIntensity('dor').ok).toBe(false);
  });
});
