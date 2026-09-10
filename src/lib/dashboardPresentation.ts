import type { PresentationContext } from './presentationContext';
import type { Role } from './types';

type CapabilityStatus = 'loading' | 'allowed' | 'denied' | 'error';

export type DashboardPresentation = 'loading' | 'reception' | 'generic' | 'clinician' | 'psychiatry';

export function resolveDashboardPresentation(input: {
  authLoading: boolean;
  userPresent: boolean;
  role: Role | null | undefined;
  presentationContext?: PresentationContext;
  attendStatus: CapabilityStatus;
  identityLoading: boolean;
  psychiatryRelevant: boolean;
  nexusStatus: CapabilityStatus;
}): DashboardPresentation {
  if (input.authLoading || !input.userPresent) return 'loading';
  if (input.role === 'recep') return 'reception';

  if (
    input.presentationContext === 'management'
    && (input.role === 'owner' || input.role === 'admin')
  ) {
    return 'generic';
  }

  // Only roles that can independently hold clinical identity/capability need
  // the clinical-home resolution boundary. Other roles stay operational.
  if (input.role !== 'professional' && input.role !== 'owner' && input.role !== 'admin') return 'generic';

  if (input.attendStatus === 'loading') return 'loading';
  if (input.attendStatus !== 'allowed') return 'generic';

  // Once clinical.attend is confirmed, identity determines presentation and
  // therefore must finish resolving before choosing a semantic dashboard.
  if (input.identityLoading) return 'loading';

  if (input.psychiatryRelevant) {
    if (input.nexusStatus === 'loading') return 'loading';
    if (input.nexusStatus === 'allowed') return 'psychiatry';
  }

  return 'clinician';
}
