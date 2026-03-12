import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!localStorage.getItem('auth_token'),
  token: localStorage.getItem('auth_token'),
  setToken: (token: string) => {
    localStorage.setItem('auth_token', token);
    set({ token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('auth_token');
    set({ token: null, isAuthenticated: false });
  },
}));
