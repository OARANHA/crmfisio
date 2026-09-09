import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { AgendaV3Summary } from './AgendaV3Summary';

const summary = {
  total: 7,
  confirmed: 2,
  inService: 1,
  finished: 3,
  pending: 1,
  missed: 1,
  nominalValue: 95000,
};

describe('AgendaV3Summary status navigation', () => {
  it('emits the pending filter when Pendentes is clicked', () => {
    const onFilterChange = vi.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<AgendaV3Summary label="Atendimentos na semana" summary={summary} onFilterChange={onFilterChange} />);
    });

    const button = renderer.root.findByProps({ 'aria-label': 'Filtrar agenda por pendentes: 1' });
    act(() => button.props.onClick());
    expect(onFilterChange).toHaveBeenCalledWith('pending');
    renderer.unmount();
  });

  it('emits the in-service filter when Em atendimento is clicked', () => {
    const onFilterChange = vi.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<AgendaV3Summary label="Atendimentos na semana" summary={summary} onFilterChange={onFilterChange} />);
    });

    const button = renderer.root.findByProps({ 'aria-label': 'Filtrar agenda por em atendimento: 1' });
    act(() => button.props.onClick());
    expect(onFilterChange).toHaveBeenCalledWith('in_service');
    renderer.unmount();
  });

  it('emits the finished filter when Finalizados is clicked and exposes the active filter', () => {
    const onFilterChange = vi.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<AgendaV3Summary label="Atendimentos na semana" summary={summary} activeFilter="finished" onFilterChange={onFilterChange} />);
    });

    const button = renderer.root.findByProps({ 'aria-label': 'Filtrar agenda por finalizados: 3' });
    expect(button.props['aria-pressed']).toBe(true);
    act(() => button.props.onClick());
    expect(onFilterChange).toHaveBeenCalledWith('finished');
    renderer.unmount();
  });
});
