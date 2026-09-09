import { describe, expect, it } from 'vitest';
import { resolveDashboardPresentation } from './dashboardPresentation';

const base = {
  authLoading: false,
  userPresent: true,
  role: 'professional' as const,
  attendStatus: 'allowed' as const,
  identityLoading: false,
  psychiatryRelevant: false,
  nexusStatus: 'denied' as const,
};

describe('dashboard semantic resolution', () => {
  it('does not render a generic dashboard while clinical.attend is still resolving', () => {
    expect(resolveDashboardPresentation({ ...base, attendStatus: 'loading' })).toBe('loading');
  });

  it('does not render a semantic dashboard while a confirmed clinician identity is still resolving', () => {
    expect(resolveDashboardPresentation({ ...base, identityLoading: true })).toBe('loading');
  });

  it('sends a resolved clinical professional to the clinician Home', () => {
    expect(resolveDashboardPresentation(base)).toBe('clinician');
  });

  it('waits for Nexus authorization before choosing the psychiatry presentation', () => {
    expect(resolveDashboardPresentation({ ...base, psychiatryRelevant: true, nexusStatus: 'loading' })).toBe('loading');
    expect(resolveDashboardPresentation({ ...base, psychiatryRelevant: true, nexusStatus: 'denied' })).toBe('clinician');
    expect(resolveDashboardPresentation({ ...base, psychiatryRelevant: true, nexusStatus: 'allowed' })).toBe('psychiatry');
  });

  it('treats capability denial as authorization outcome instead of perpetual loading', () => {
    expect(resolveDashboardPresentation({ ...base, attendStatus: 'denied' })).toBe('generic');
    expect(resolveDashboardPresentation({ ...base, attendStatus: 'error' })).toBe('generic');
  });
});
