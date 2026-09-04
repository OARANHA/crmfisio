export type BodyMapIntensityValidation =
  | { ok: true; value: number | null }
  | { ok: false; message: string };

export function validateBodyMapIntensity(raw: string): BodyMapIntensityValidation {
  const value = raw.trim();
  if (value === '') return { ok: true, value: null };

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return { ok: false, message: 'Informe uma intensidade numérica entre 0 e 10.' };
  }
  if (!Number.isInteger(numeric)) {
    return { ok: false, message: 'A intensidade deve ser um número inteiro entre 0 e 10.' };
  }
  if (numeric < 0 || numeric > 10) {
    return { ok: false, message: 'A intensidade deve ficar entre 0 e 10.' };
  }

  return { ok: true, value: numeric };
}
