import { create } from 'zustand';
import { signOut } from 'aws-amplify/auth';

/**
 * Amplify's default token store persists the Cognito session under these keys: they are the durable
 * session boundary, so a document that still finds them can re-authenticate.
 */
const AMPLIFY_AUTH_STORAGE_PREFIX = 'CognitoIdentityServiceProvider.';

interface AuthState {
  isAuthenticated: boolean;
  isSigningOut: boolean;
  logoutError: string | null;
  setAuthenticated: (isAuthenticated: boolean) => void;
  clearLocalAuth: () => void;
  logout: () => Promise<void>;
}

/**
 * `signOut()` only removes Amplify's persisted tokens after its network revocation settles, so a
 * rejection or a document teardown during sign-out can leave a restorable session behind. Removing
 * the persisted auth keys here makes a completed logout durable regardless of SDK internals.
 */
function clearPersistedAuthStorage(): void {
  if (typeof localStorage === 'undefined') return;

  const persistedKeys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(AMPLIFY_AUTH_STORAGE_PREFIX)) persistedKeys.push(key);
  }

  for (const key of persistedKeys) {
    localStorage.removeItem(key);
  }
}

function describeLogoutFailure(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown sign-out error';
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
    // Pending sign-out is still a store change, so a slower startup lookup stays invalidated while
    // the UI keeps the session on screen instead of advertising a logout that is not durable yet.
    set({ isSigningOut: true, logoutError: null });

    try {
      await signOut();
    } catch (error) {
      // The SDK did not destroy the session, so do it here before reporting the failure: an
      // in-memory-only sign-out would let the next document restore the user from persisted tokens.
      clearPersistedAuthStorage();
      set({
        isAuthenticated: false,
        isSigningOut: false,
        logoutError: describeLogoutFailure(error),
      });
      throw error;
    }

    clearPersistedAuthStorage();
    set({ isAuthenticated: false, isSigningOut: false, logoutError: null });
  },
}));
