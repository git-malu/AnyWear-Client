import { create } from 'zustand';
import { signOut } from 'aws-amplify/auth';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  setToken: (token: string) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!localStorage.getItem('auth_token'),
  token: localStorage.getItem('auth_token'),
  setToken: (token: string) => {
    localStorage.setItem('auth_token', token);
    set({ token, isAuthenticated: true });
  },
  logout: async () => {
    localStorage.removeItem('auth_token');
    try {
      await signOut();
    } catch (e) {
      console.error('Error signing out of Amplify:', e);
    }
    set({ token: null, isAuthenticated: false });
  },
}));
