import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  role: 'owner',
  refreshFinancialExceptions: vi.fn(),
  resolveFinancialException: vi.fn(),
  toast: vi.fn(),
  financialExceptions: [{
    id: 'exception-a',
    appointmentId: 'appointment-a',
    patientId: 'patient-a',
    patientName: 'Paciente A',
    appointmentDate: '2026-09-09',
    appointmentStart: '10:00:00',
    reasonCode: 'package_exhausted',
    amount: 10000,
    sourcePackageId: null,
    packageName: 'Pacote A',
    detectedAt: '2026-09-09T09:00:00Z',
  }],
  financialExceptionsLoading: false,
  financialExceptionsError: null,
}));

vi.mock('../lib/currentUserAccess', () => ({
  useCurrentUserAccess: () => ({ user: { role: state.role } }),
}));

vi.mock('../lib/financeContext', () => ({
  useFinance: () => ({
    financialExceptions: state.financialExceptions,
    financialExceptionsLoading: state.financialExceptionsLoading,
    financialExceptionsError: state.financialExceptionsError,
    refreshFinancialExceptions: state.refreshFinancialExceptions,
    resolveFinancialException: state.resolveFinancialException,
  }),
}));

vi.mock('../lib/toastContext', () => ({
  useToast: () => ({ toast: state.toast }),
}));

vi.mock('../lib/ui', async () => {
  const ReactModule = await import('react');
  const h = ReactModule.createElement;
  return {
    Btn: ({ children, ...props }) => h('button', props, children),
    Card: ({ children }) => h('section', null, children),
    CardHead: ({ title, sub, right }) => h('header', null, h('h3', null, title), sub ? h('p', null, sub) : null, right),
    Chip: ({ children }) => h('span', null, children),
    Field: ({ label, children }) => h('label', null, h('span', null, label), children),
    Input: (props) => h('input', props),
    Modal: ({ open, title, children }) => open ? h('div', { role: 'dialog' }, h('h3', null, title), children) : null,
  };
});

import { FinancialExceptionQueue } from './FinancialExceptionQueue';

const buttonText = (node) => node.children.filter((child) => typeof child === 'string').join('');
const findButton = (renderer, label) => renderer.root.findAllByType('button').find((button) => buttonText(button) === label);

describe('FinancialExceptionQueue command feedback', () => {
  beforeEach(() => {
    state.role = 'owner';
    state.refreshFinancialExceptions.mockReset();
    state.resolveFinancialException.mockReset();
    state.toast.mockReset();
    state.financialExceptionsLoading = false;
    state.financialExceptionsError = null;
  });

  it('handles a rejected manual refresh promise instead of leaving an unhandled rejection', async () => {
    state.refreshFinancialExceptions.mockRejectedValueOnce(new Error('queue unavailable'));
    let renderer;
    await act(async () => {
      renderer = create(React.createElement(FinancialExceptionQueue));
    });

    const refresh = findButton(renderer, 'Atualizar');
    expect(refresh).toBeTruthy();

    await act(async () => {
      refresh.props.onClick();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(state.refreshFinancialExceptions).toHaveBeenCalledOnce();
    renderer.unmount();
  });

  it('shows a projection warning after persisted WAIVE instead of claiming the pending item remains open', async () => {
    const projectionWarning = 'Cortesia registrada, mas a fila de pendências não pôde ser atualizada.';
    state.resolveFinancialException.mockResolvedValueOnce({
      resolution: {
        exceptionId: 'exception-a',
        appointmentId: 'appointment-a',
        disposition: 'waived',
        amount: 10000,
        paymentId: null,
        resolvedAt: '2026-09-09T09:10:00Z',
      },
      projection: { finance: 'not_required', queue: 'stale' },
      projectionWarning,
    });

    let renderer;
    await act(async () => {
      renderer = create(React.createElement(FinancialExceptionQueue));
    });

    await act(async () => {
      findButton(renderer, 'Conceder cortesia').props.onClick();
    });

    const input = renderer.root.findByType('input');
    await act(async () => {
      input.props.onChange({ target: { value: 'Cortesia administrativa' } });
    });

    await act(async () => {
      findButton(renderer, 'Confirmar cortesia').props.onClick();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(state.resolveFinancialException).toHaveBeenCalledWith(
      'exception-a',
      'waived',
      'Cortesia administrativa',
    );
    expect(state.toast).toHaveBeenCalledWith(projectionWarning, 'warn');
    expect(state.toast.mock.calls.flat().join(' ')).not.toContain('permanece aberta');
    expect(renderer.toJSON()).not.toContain('A pendência permanece aberta');
    renderer.unmount();
  });

  it('keeps an RPC rejection as a real CHARGE failure', async () => {
    state.resolveFinancialException.mockRejectedValueOnce(new Error('rpc failed'));
    let renderer;
    await act(async () => {
      renderer = create(React.createElement(FinancialExceptionQueue));
    });

    await act(async () => {
      findButton(renderer, 'Gerar cobrança').props.onClick();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(state.toast).toHaveBeenCalledWith('Não foi possível gerar a cobrança desta pendência.', 'warn');
    renderer.unmount();
  });
});
