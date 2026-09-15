import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(fileURLToPath(new URL('../pages/Pacientes.tsx', import.meta.url)), 'utf8');
const tableSource = readFileSync(fileURLToPath(new URL('../components/PatientDirectoryTableV2.tsx', import.meta.url)), 'utf8');

describe('patient directory UI Foundation V2', () => {
  it('uses TanStack Table for the operational directory', () => {
    expect(tableSource).toContain("from '@tanstack/react-table'");
    expect(tableSource).toContain('rowSortingFeature');
    expect(tableSource).toContain('createSortedRowModel');
  });

  it('preserves comfortable interaction sizing in the pilot', () => {
    expect(pageSource).toContain('!min-h-ui-control');
    expect(tableSource).toContain('px-6 py-5');
    expect(tableSource).toContain('!rounded-ui-data-surface');
    expect(pageSource).toContain('medicspro-page-title');
  });

  it('keeps row navigation keyboard accessible', () => {
    expect(tableSource).toContain('tabIndex={0}');
    expect(tableSource).toContain("event.key === 'Enter'");
    expect(tableSource).toContain("event.key === ' '");
    expect(tableSource).toContain('focus-visible:ring-2');
  });
});
