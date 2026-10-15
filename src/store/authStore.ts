import { create } from 'zustand';
import { getCurrentUser, signOut } from 'aws-amplify/auth';

interface AuthState {
  isAuthenticated: boolean;
  isSigningOut: boolean;
  logoutError: string | null;
  setAuthenticated: (isAuthenticated: boolean) => void;
  clearLocalAuth: () => void;
  logout: () => Promise<void>;
}

/**
 * `signOut()` destroys Amplify's persisted Cognito session only after its awaited `RevokeToken`
 * request settles (the SDK clears its token store after that await returns), so a document teardown
 * mid-sign-out, or any rejection, can leave a restorable session behind. The mirror therefore keeps
 * reporting the session until destruction has been verified.
 */
const UNVERIFIED_SIGN_OUT_MESSAGE =
  'You are still signed in. Sign-out could not be verified, so the session was not cleared.';

/**
 * One initial attempt plus one bounded retry, both on the local scope. A global sign-out would
 * revoke every session of the account, which is a product decision this fix must not make.
 */
const MAX_LOCAL_SIGN_OUT_ATTEMPTS = 2;

function describeLogoutFailure(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Unknown sign-out error';
}

function unverifiedSignOutError(lastError: unknown): Error {
  if (lastError === null) return new Error(UNVERIFIED_SIGN_OUT_MESSAGE);
  return new Error(`${UNVERIFIED_SIGN_OUT_MESSAGE} Last SDK error: ${describeLogoutFailure(lastError)}`);
}

/**
 * `getCurrentUser()` answers "is the session gone?" from the SDK's persisted session store: once
 * `signOut()` has destroyed the tokens it rejects without contacting Cognito. Amplify's storage keys
 * are never inspected or removed here, because the SDK owns that boundary.
 */
async function isSessionDestroyed(): Promise<boolean> {
  try {
    await getCurrentUser();
    return false;
  } catch {
    return true;
  }
}

async function destroyAmplifySession(): Promise<void> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_LOCAL_SIGN_OUT_ATTEMPTS; attempt += 1) {
    try {
      await signOut({ global: false });
      lastError = null;
    } catch (error) {
      lastError = error;
    }

    // A rejection is not proof of failure (the SDK may have cleared the session before it threw) and
    // a resolution is not proof of success, so the persisted session decides, not the promise.
    if (await isSessionDestroyed()) return;
  }

  throw unverifiedSignOutError(lastError);
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isSigningOut: false,
  logoutError: null,
  setAuthenticated: (isAuthenticated: boolean) => {
    // A new session makes a previous sign-out failure stale.
    set(isAuthenticated ? { isAuthenticated, logoutError: null } : { isAuthenticated });
  },
  clearLocalAuth: () => {
    set({ isAuthenticated: false });
  },
  logout: async () => {
    // The in-flight flag is published immediately: it announces a pending sign-out and keeps a
    // slower startup lookup invalidated. No unauthenticated state is published here.
    set({ isSigningOut: true, logoutError: null });

    try {
      await destroyAmplifySession();
    } catch (error) {
      // Destruction could not be verified, so the UI stays authenticated and the failure is
      // surfaced. Publishing a logged-out UI on an unverified sign-out is what this fix removes.
      set({ isSigningOut: false, logoutError: describeLogoutFailure(error) });
      throw error;
    }

    set({ isAuthenticated: false, isSigningOut: false, logoutError: null });
  },
}));
