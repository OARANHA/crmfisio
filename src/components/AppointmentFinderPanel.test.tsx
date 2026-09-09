import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { Room, Unidade, User } from '../lib/types';
import { AppointmentFinderPanel } from './AppointmentFinderPanel';

const access = vi.hoisted(() => ({ user: null as User | null }));

vi.mock('../lib/currentUserAccess', () => ({
  useCurrentUserAccess: () => access,
}));

const professionalA: User = {
  id: 'professional-a',
  nome: 'Dra. Ana',
  email: 'ana@example.test',
  role: 'professional',
  registro: 'A-1',
  cor: '#000',
  ativo: true,
  professionalType: 'medico',
};

const professionalB: User = {
  id: 'professional-b',
  nome: 'Dr. Bruno',
  email: 'bruno@example.test',
  role: 'professional',
  registro: 'B-1',
  cor: '#111',
  ativo: true,
  professionalType: 'medico',
};

const admin: User = {
  id: 'admin-a',
  nome: 'Admin',
  email: 'admin@example.test',
  role: 'admin',
  registro: '',
  cor: '#222',
  ativo: true,
};

const unit: Unidade = { id: 'unit-a', nome: 'Unidade Centro', endereco: 'Centro' };
const room: Room = { id: 'room-a', nome: 'Sala 1', tipo: 'sala', unidadeId: unit.id };

const renderFinder = (onChoose = vi.fn()) => create(
  <AppointmentFinderPanel
    open
    appointments={[]}
    rooms={[room]}
    unidades={[unit]}
    fisios={[professionalA, professionalB]}
    defaultFisioId="all"
    defaultUnitId="all"
    onClose={() => undefined}
    onChoose={onChoose}
  />,
);

const optionLabels = (renderer: ReactTestRenderer) => renderer.root
  .findAllByType('option')
  .map((option) => option.children.join(''));

const availabilityButtons = (renderer: ReactTestRenderer) => renderer.root
  .findAllByType('button')
  .filter((button) => button.findAllByType('p').some((paragraph) => paragraph.children.join('').includes('usar este horário')));

describe('AppointmentFinderPanel professional scope', () => {
  it('never offers or emits another professional and follows a user-context switch', () => {
    const onChoose = vi.fn();
    access.user = professionalA;
    let renderer!: ReactTestRenderer;

    act(() => {
      renderer = renderFinder(onChoose);
    });

    expect(optionLabels(renderer)).not.toContain('Qualquer profissional');
    expect(renderer.root.findByProps({ 'aria-label': 'Profissional da busca' }).children).toBeTruthy();

    const firstUserSlots = availabilityButtons(renderer);
    expect(firstUserSlots.length).toBeGreaterThan(0);
    act(() => firstUserSlots.forEach((button) => button.props.onClick()));
    expect(onChoose).toHaveBeenCalled();
    for (const [slot] of onChoose.mock.calls) expect(slot.fisioId).toBe(professionalA.id);

    onChoose.mockClear();
    access.user = professionalB;
    act(() => {
      renderer.update(
        <AppointmentFinderPanel
          open
          appointments={[]}
          rooms={[room]}
          unidades={[unit]}
          fisios={[professionalA, professionalB]}
          defaultFisioId="all"
          defaultUnitId="all"
          onClose={() => undefined}
          onChoose={onChoose}
        />,
      );
    });

    const secondUserSlots = availabilityButtons(renderer);
    expect(secondUserSlots.length).toBeGreaterThan(0);
    act(() => secondUserSlots.forEach((button) => button.props.onClick()));
    expect(onChoose).toHaveBeenCalled();
    for (const [slot] of onChoose.mock.calls) expect(slot.fisioId).toBe(professionalB.id);

    renderer.unmount();
  });

  it('preserves the operational professional selector for admin/reception flows', () => {
    access.user = admin;
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = renderFinder();
    });

    const labels = optionLabels(renderer);
    expect(labels).toContain('Qualquer profissional');
    expect(labels).toContain(professionalA.nome);
    expect(labels).toContain(professionalB.nome);

    renderer.unmount();
  });
});
