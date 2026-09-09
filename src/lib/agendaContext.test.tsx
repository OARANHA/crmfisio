import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Appointment } from './types';
import { verifyAppointmentStatusMutation } from './appointmentOperations';

const repositoryMocks = vi.hoisted(() => ({
  insertAppointment: vi.fn(),
  mapAppointment: vi.fn((row: unknown) => row),
  updateAppointmentStatus: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  order: vi.fn(),
}));

vi.mock('./repository', () => repositoryMocks);

vi.mock('./useAuth', () => ({
  useAuth: () => ({
    profile: { clinic_id: 'clinic-a' },
    tenantAccessState: 'active',
  }),
}));

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: supabaseMocks.order,
        })),
      })),
    })),
  },
}));

import { AgendaProvider, useAgenda } from './agendaContext';

const appointment: Appointment = {
  id: 'appointment-a',
  pacienteId: 'patient-a',
  professionalId: 'professional-a',
  fisioId: 'professional-a',
  roomId: 'room-a',
  data: '2026-09-09',
  inicio: '10:00',
  fim: '11:00',
  status: 'em_atendimento',
  tipo: 'Consulta',
  valor: 0,
  pacoteId: null,
  serieId: null,
  notas: '',
};

let latestAgenda: ReturnType<typeof useAgenda> | null = null;

function Probe() {
  latestAgenda = useAgenda();
  return null;
}

describe('AgendaProvider canonical appointment status mutation', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    latestAgenda = null;
    repositoryMocks.insertAppointment.mockReset();
    repositoryMocks.mapAppointment.mockClear();
    repositoryMocks.updateAppointmentStatus.mockReset();
    supabaseMocks.order.mockReset();
    supabaseMocks.order.mockResolvedValue({ data: [appointment], error: null });
  });

  it('rolls back the optimistic status when the canonical mutation returns 0 rows with error=null', async () => {
    repositoryMocks.updateAppointmentStatus.mockImplementationOnce(async (id, status) => {
      verifyAppointmentStatusMutation({ data: [], error: null }, id, status);
    });

    await act(async () => {
      renderer = create(
        <AgendaProvider>
          <Probe />
        </AgendaProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latestAgenda?.appointments).toHaveLength(1);
    expect(latestAgenda?.appointments[0]?.status).toBe('em_atendimento');

    let caught: unknown;
    await act(async () => {
      try {
        await latestAgenda?.setAppointmentStatus('appointment-a', 'finalizado');
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('appointment_status_update_not_persisted');
    expect(repositoryMocks.updateAppointmentStatus).toHaveBeenCalledWith('appointment-a', 'finalizado');
    expect(latestAgenda?.appointments[0]?.status).toBe('em_atendimento');

    renderer?.unmount();
  });
});
