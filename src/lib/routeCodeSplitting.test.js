import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8');
const shellSource = readFileSync(fileURLToPath(new URL('../components/Shell.tsx', import.meta.url)), 'utf8');

describe('route-level code splitting', () => {
  it('keeps routed pages out of eager App imports', () => {
    expect(appSource).not.toMatch(/^import .*from ['"]\.\/pages\//m);
    expect(appSource.match(/lazy\(\(\) => import\(['"]\.\/pages\//g)).toHaveLength(21);
  });

  it('keeps the clinical Shell mounted while nested route chunks load', () => {
    expect(shellSource).toContain('<Suspense fallback={<RouteContentFallback />}>');
    expect(shellSource).toContain('<Outlet />');
    expect(shellSource).toContain('aria-busy="true"');
  });

  it('uses a full-page boundary only for routes outside the Shell', () => {
    expect(appSource).toContain('const deferredRoute =');
    expect(appSource).toContain('deferredRoute(<ClinicAccessRequestPage />)');
    expect(appSource).toContain('deferredRoute(<PlatformAdminHomePage />)');
  });
});
