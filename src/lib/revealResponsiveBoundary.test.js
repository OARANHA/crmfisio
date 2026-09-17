import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('../components/Reveal.tsx', import.meta.url)),
  'utf8',
);

describe('Reveal responsive boundary', () => {
  it('allows animated wrappers to shrink when they are grid or flex items', () => {
    expect(source).toContain("`rv min-w-0 ${inView ? 'is-in' : ''} ${className}`");
  });
});
