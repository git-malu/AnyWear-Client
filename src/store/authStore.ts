import { create } from 'zustand';
import { signOut } from 'aws-amplify/auth';

interface AuthState {
  isAuthenticated: boolean;
  setAuthenticated: (isAuthenticated: boolean) => void;
  clearLocalAuth: () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  setAuthenticated: (isAuthenticated: boolean) => {
    set({ isAuthenticated });
  },
  clearLocalAuth: () => {
    set({ isAuthenticated: false });
  },
  logout: async () => {
    // Clear local state immediately for fast UI response
    set({ isAuthenticated: false });
    
    // Explicitly sign out of Amplify (this also triggers the Hub 'signedOut' event)
    try {
      await signOut();
    } catch (e) {
      console.error('Error signing out of Amplify:', e);
    }
  },
}));
