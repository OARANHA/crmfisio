import { isPlatformAdmin } from './platformAdmin';
import { platformSupabase } from './platformSupabaseClient';

let cachedUserId: string | null = null;
let cachedAllowed: boolean | null = null;
let pendingValidation: Promise<boolean> | null = null;

export function getCachedPlatformAdminAccess(): boolean | null {
  return cachedAllowed;
}

export async function validatePlatformAdminAccess(): Promise<boolean> {
  if (pendingValidation) return pendingValidation;

  const validation = (async () => {
    const { data } = await platformSupabase.auth.getSession();
    const userId = data.session?.user.id ?? null;

    if (!userId) {
      cachedUserId = null;
      cachedAllowed = false;
      return false;
    }

    if (cachedUserId !== userId) {
      cachedUserId = userId;
      cachedAllowed = null;
    }

    if (cachedAllowed !== null) return cachedAllowed;

    const allowed = await isPlatformAdmin();

    // Authentication may change while the RPC is in flight. Never let a result
    // calculated for the previous user overwrite the cache of the new session.
    if (cachedUserId !== userId) return false;

    cachedAllowed = allowed;
    return allowed;
  })();

  pendingValidation = validation;

  try {
    return await validation;
  } finally {
    // A sign-in/sign-out event can start a newer validation before this one
    // finishes. Only clear the promise that belongs to this invocation.
    if (pendingValidation === validation) pendingValidation = null;
  }
}

platformSupabase.auth.onAuthStateChange((_event, session) => {
  const nextUserId = session?.user.id ?? null;
  if (nextUserId !== cachedUserId) {
    cachedUserId = nextUserId;
    cachedAllowed = nextUserId ? null : false;
    pendingValidation = null;
  }
});
