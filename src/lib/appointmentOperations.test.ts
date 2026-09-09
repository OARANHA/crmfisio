import { describe, expect, it } from 'vitest';
import { verifyAppointmentStatusMutation } from './appointmentOperations';

describe('verifyAppointmentStatusMutation', () => {
  it('accepts exactly the expected appointment with the expected status', () => {
    expect(verifyAppointmentStatusMutation({
      data: [{ id: 'appointment-a', status: 'finalizado' }],
      error: null,
    }, 'appointment-a', 'finalizado')).toEqual({ id: 'appointment-a', status: 'finalizado' });
  });

  it('rejects zero rows even when Supabase reports error=null', () => {
    expect(() => verifyAppointmentStatusMutation({
      data: [],
      error: null,
    }, 'appointment-a', 'finalizado')).toThrow('appointment_status_update_not_persisted');
  });

  it('rejects a returned appointment with a different status', () => {
    expect(() => verifyAppointmentStatusMutation({
      data: [{ id: 'appointment-a', status: 'em_atendimento' }],
      error: null,
    }, 'appointment-a', 'finalizado')).toThrow('appointment_status_update_wrong_status');
  });

  it('rejects a returned row for a different appointment', () => {
    expect(() => verifyAppointmentStatusMutation({
      data: [{ id: 'appointment-b', status: 'finalizado' }],
      error: null,
    }, 'appointment-a', 'finalizado')).toThrow('appointment_status_update_wrong_appointment');
  });

  it('propagates RLS/permission failures', () => {
    const permissionError = { code: '42501', message: 'permission denied' };
    let caught: unknown;
    try {
      verifyAppointmentStatusMutation({ data: null, error: permissionError }, 'appointment-a', 'finalizado');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(permissionError);
  });

  it('rejects more than one returned row instead of guessing', () => {
    expect(() => verifyAppointmentStatusMutation({
      data: [
        { id: 'appointment-a', status: 'finalizado' },
        { id: 'appointment-a', status: 'finalizado' },
      ],
      error: null,
    }, 'appointment-a', 'finalizado')).toThrow('appointment_status_update_not_persisted');
  });
});
