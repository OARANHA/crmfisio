import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcRoot = fileURLToPath(new URL('../', import.meta.url));

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

const sourceFiles = walk(srcRoot).filter((path) => /\.(ts|tsx|js|jsx)$/.test(path) && !path.endsWith('professionalRoleCutoverAudit.test.js'));

const forbidden = [
  /role\s*===\s*['"]fisio['"]/g,
  /role\s*!==\s*['"]fisio['"]/g,
  /role\s*=\s*['"]fisio['"]/g,
  /\['owner',\s*'admin',\s*'fisio'/g,
];

describe('professional role cutover audit', () => {
  it('has no direct fisio role coupling outside the compatibility layer', () => {
    const offenders = [];
    for (const path of sourceFiles) {
      const source = readFileSync(path, 'utf8');
      if (forbidden.some((pattern) => pattern.test(source))) offenders.push(relative(srcRoot, path));
      for (const pattern of forbidden) pattern.lastIndex = 0;
    }
    expect(offenders, `Residual role=fisio coupling:\n${offenders.join('\n')}`).toEqual([]);
  });
});
