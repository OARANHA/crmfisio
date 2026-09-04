import { describe, expect, it } from 'vitest';
import { createInitialEemState, eemRedFlags, generateEemNarrative, toggleEemOption } from './eem';

describe('Nexus EEM', () => {
  it('remove estado normal quando uma alteração incompatível é selecionada', () => {
    let state = createInitialEemState();
    state = toggleEemOption(state, 'humor', 'distimico');
    expect(state.humor).toContain('distimico');
    expect(state.humor).not.toContain('eutimico');
  });

  it('mantém lentificação e aceleração da fala mutuamente exclusivas', () => {
    let state = createInitialEemState();
    state = toggleEemOption(state, 'fala', 'fala_lentificada');
    state = toggleEemOption(state, 'fala', 'fala_acelerada');
    expect(state.fala).toContain('fala_acelerada');
    expect(state.fala).not.toContain('fala_lentificada');
    expect(state.fala).not.toContain('fala_normal');
  });

  it('orientado global substitui demais estados de orientação', () => {
    let state = createInitialEemState();
    state = toggleEemOption(state, 'orientacao', 'desorientado_tempo');
    state = toggleEemOption(state, 'orientacao', 'orientado_global');
    expect(state.orientacao).toEqual(['orientado_global']);
  });

  it('ideação suicida gera red flag crítica', () => {
    let state = createInitialEemState();
    state = toggleEemOption(state, 'pensamentoConteudo', 'conteudo_ideacao_suicida');
    const flags = eemRedFlags(state);
    expect(flags.some((flag) => flag.flagCode === 'eem.thought.suicidal-ideation' && flag.severity === 'critical')).toBe(true);
  });

  it('narrativa é determinística e inclui observações livres', () => {
    const state = createInitialEemState();
    state.observacoesLivres = 'Contato ocular preservado.';
    const first = generateEemNarrative(state);
    const second = generateEemNarrative(state);
    expect(first).toBe(second);
    expect(first).toContain('EXAME DO ESTADO MENTAL');
    expect(first).toContain('Contato ocular preservado.');
  });
});
