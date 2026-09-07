import type { Patient, User } from './types';

export const patientName = (patients: Patient[], id: string) => patients.find((patient) => patient.id === id)?.nome ?? '—';

export const userName = (users: User[], id: string) => users.find((user) => user.id === id)?.nome ?? '—';
