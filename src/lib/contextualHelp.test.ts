import { describe, expect, it } from 'vitest';
import { resolveHelpContext } from './helpContent';

describe('contextual help', () => {
  it('routes agenda screens to agenda help', () => {
    expect(resolveHelpContext('/agenda', 'recep')?.key).toBe('agenda');
    expect(resolveHelpContext('/hoje', 'professional')?.key).toBe('agenda');
  });

  it('uses clinical help on a patient chart only for clinical/manager roles', () => {
    expect(resolveHelpContext('/pacientes/patient-1', 'professional')?.key).toBe('atendimento');
    expect(resolveHelpContext('/pacientes/patient-1', 'admin')?.key).toBe('atendimento');
    expect(resolveHelpContext('/pacientes/patient-1', 'recep')?.key).toBe('pacientes');
  });

  it('does not teach a care professional to settle receivables', () => {
    const help = resolveHelpContext('/financeiro', 'professional');
    expect(help?.key).toBe('financeiro');
    expect(help?.steps.some((step) => step.title.includes('Baixe somente'))).toBe(false);
    expect(help?.steps.some((step) => step.title === 'Profissional clínico consulta sem operar caixa')).toBe(true);
  });

  it('does not expose clinical evolution instructions to reception', () => {
    const help = resolveHelpContext('/pacientes/patient-1', 'recep');
    const text = help?.steps.map((step) => `${step.title} ${step.body}`).join(' ') ?? '';
    expect(text).not.toContain('Registre a evolução da sessão');
    expect(text).not.toContain('session_id');
  });

  it('keeps CRM mutation guidance away from read-only roles', () => {
    const professional = resolveHelpContext('/crm', 'professional');
    const recep = resolveHelpContext('/crm', 'recep');
    expect(professional?.key).toBe('crm');
    expect(professional?.steps.some((step) => step.title === 'Use o funil para estado operacional')).toBe(false);
    expect(recep?.steps.some((step) => step.title === 'Use o funil para estado operacional')).toBe(true);
  });

  it('warns operational WhatsApp users against retrying uncertain delivery', () => {
    const help = resolveHelpContext('/mensagens', 'recep');
    expect(help?.key).toBe('mensagens');
    expect(help?.safetyNote).toContain('DELIVERY_UNCERTAIN');
    expect(help?.steps.some((step) => step.title === 'Resultado incerto não é falha definitiva')).toBe(true);
  });

  it('teaches report readers to separate realized value from pipeline', () => {
    const help = resolveHelpContext('/relatorios', 'financeiro');
    expect(help?.key).toBe('relatorios');
    expect(help?.steps.some((step) => step.title === 'Realizado e pipeline são diferentes')).toBe(true);
    expect(resolveHelpContext('/relatorios', 'recep')).toBeNull();
  });

  it('includes package and custom assessment guidance in existing core contexts', () => {
    const finance = resolveHelpContext('/financeiro', 'admin');
    const clinical = resolveHelpContext('/pacientes/patient-1', 'professional');
    expect(finance?.steps.some((step) => step.title === 'Pacote não é o mesmo que lançamento avulso')).toBe(true);
    expect(clinical?.steps.some((step) => step.title.includes('Avaliação padrão'))).toBe(true);
  });

  it('returns no help outside supported contexts', () => {
    expect(resolveHelpContext('/configuracoes', 'admin')).toBeNull();
  });
});
