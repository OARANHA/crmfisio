import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { Appointment } from '../../lib/types';
import { ClinicianActiveEncounterBanner } from './ClinicianActiveEncounterBanner';

const encounter: Appointment = {
  id: 'encounter-yesterday',
  pacienteId: 'patient-a',
  professionalId: 'professional-a',
  fisioId: 'professional-a',
  roomId: 'room-a',
  data: '2026-09-08',
  inicio: '20:00',
  fim: '20:40',
  status: 'em_atendimento',
  tipo: 'Consulta',
  valor: 15000,
  pacoteId: null,
  serieId: null,
  notas: '',
};

describe('ClinicianActiveEncounterBanner', () => {
  it('keeps a previous-day active encounter visible and actionable inside the agenda', () => {
    const onContinue = vi.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <ClinicianActiveEncounterBanner
          encounter={encounter}
          patientLabel="Paciente Teste"
          now={new Date('2026-09-09T12:00:00')}
          onContinue={onContinue}
        />,
      );
    });

    const text = renderer.root.findAllByType('p').map((node) => node.children.join(' ')).join(' ');
    expect(text).toContain('Atendimento em andamento');
    expect(text).toContain('Paciente Teste');
    expect(text).toContain('Iniciado ontem às 20:00');
    expect(text).toContain('Atendimento aberto de uma data anterior.');

    const button = renderer.root.findByType('button');
    act(() => button.props.onClick());
    expect(onContinue).toHaveBeenCalledTimes(1);
    renderer.unmount();
  });
});
