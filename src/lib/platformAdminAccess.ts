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

  pendingValidation = (async () => {
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
    cachedAllowed = allowed;
    return allowed;
  })();

  try {
    return await pendingValidation;
  } finally {
    pendingValidation = null;
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
