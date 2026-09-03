import type { Access, ModuleKey, Role } from './types';

export const ROLES: readonly Role[] = ['owner', 'admin', 'fisio', 'recep', 'financeiro'];

export const ACCESS_MATRIX: Record<Role, Record<ModuleKey, Access>> = {
  owner: { dashboard: 'full', agenda: 'full', pacientes: 'full', clinico: 'read', financeiro: 'full', crm: 'full', mensagens: 'full', relatorios: 'full', config: 'full' },
  admin: { dashboard: 'full', agenda: 'full', pacientes: 'full', clinico: 'read', financeiro: 'full', crm: 'full', mensagens: 'full', relatorios: 'full', config: 'full' },
  fisio: { dashboard: 'read', agenda: 'full', pacientes: 'full', clinico: 'full', financeiro: 'read', crm: 'read', mensagens: 'read', relatorios: 'read', config: 'none' },
  recep: { dashboard: 'none', agenda: 'full', pacientes: 'full', clinico: 'none', financeiro: 'full', crm: 'full', mensagens: 'full', relatorios: 'none', config: 'none' },
  financeiro: { dashboard: 'read', agenda: 'read', pacientes: 'read', clinico: 'none', financeiro: 'full', crm: 'read', mensagens: 'read', relatorios: 'read', config: 'none' },
};

export const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && ROLES.includes(value as Role);

export const accessFor = (role: Role | null | undefined, module: ModuleKey): Access =>
  role ? ACCESS_MATRIX[role][module] : 'none';

export const isClinicManager = (role: Role | null | undefined): boolean =>
  role === 'owner' || role === 'admin';

export const isOperationalRole = (role: Role | null | undefined): boolean =>
  role === 'owner' || role === 'admin' || role === 'recep';

export const isClinicalRole = (role: Role | null | undefined): boolean => role === 'fisio';
