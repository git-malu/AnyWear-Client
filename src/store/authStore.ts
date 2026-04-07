import { create } from 'zustand';
import { signOut } from 'aws-amplify/auth';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  setToken: (token: string) => void;
  clearLocalAuth: () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!localStorage.getItem('auth_token'),
  token: localStorage.getItem('auth_token'),
  setToken: (token: string) => {
    localStorage.setItem('auth_token', token);
    set({ token, isAuthenticated: true });
  },
  clearLocalAuth: () => {
    localStorage.removeItem('auth_token');
    set({ token: null, isAuthenticated: false });
  },
  logout: async () => {
    // Clear local state immediately for fast UI response
    localStorage.removeItem('auth_token');
    set({ token: null, isAuthenticated: false });
    
    // Explicitly sign out of Amplify (this also triggers the Hub 'signedOut' event)
    try {
      await signOut();
    } catch (e) {
      console.error('Error signing out of Amplify:', e);
    }
  },
}));
