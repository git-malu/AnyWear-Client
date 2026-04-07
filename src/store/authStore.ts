import { create } from 'zustand';
import { signOut } from 'aws-amplify/auth';

interface AuthState {
  isAuthenticated: boolean;
  setAuthenticated: (isAuthenticated: boolean) => void;
  clearLocalAuth: () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: localStorage.getItem('isAuthenticated') === 'true',
  setAuthenticated: (isAuthenticated: boolean) => {
    if (isAuthenticated) {
      localStorage.setItem('isAuthenticated', 'true');
    } else {
      localStorage.removeItem('isAuthenticated');
    }
    set({ isAuthenticated });
  },
  clearLocalAuth: () => {
    localStorage.removeItem('isAuthenticated');
    set({ isAuthenticated: false });
  },
  logout: async () => {
    // Clear local state immediately for fast UI response
    localStorage.removeItem('isAuthenticated');
    set({ isAuthenticated: false });
    
    // Explicitly sign out of Amplify (this also triggers the Hub 'signedOut' event)
    try {
      await signOut();
    } catch (e) {
      console.error('Error signing out of Amplify:', e);
    }
  },
}));
