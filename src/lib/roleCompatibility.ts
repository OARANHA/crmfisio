import type { Role } from './types';

const CANONICAL_ROLES = new Set<Role>(['owner', 'admin', 'professional', 'recep', 'financeiro']);

/**
 * Temporary read-boundary bridge for the staged operational-role cutover.
 *
 * Production may still return persisted legacy profiles while the compatibility
 * migration and frontend are deployed in sequence. Normalize that stored value
 * here so the rest of the application only reasons about the canonical Role.
 * Remove the legacy branch after the final cutover verifier proves zero rows.
 */
export function normalizeClinicRole(value: unknown): Role | null {
  const normalized = value === 'fisio' ? 'professional' : value;
  return typeof normalized === 'string' && CANONICAL_ROLES.has(normalized as Role)
    ? normalized as Role
    : null;
}
