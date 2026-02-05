import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      hasHydrated: false,
      login: (user, token) => {
        console.log('[Auth] Login called, storing token to localStorage');
        // 同时存储到 localStorage，以便 API 调用使用
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token);
          console.log('[Auth] Token stored to localStorage:', token.substring(0, 20) + '...');
        }
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      },
      logout: () => {
        console.log('[Auth] Logout called, removing token from localStorage');
        // 清除 localStorage 中的 token
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },
      setUser: (user) => {
        set({ user });
      },
      setLoading: (isLoading) => set({ isLoading }),
      setHasHydrated: (hasHydrated) => {
        console.log('[Auth] Hydration state changed:', hasHydrated);
        set({ hasHydrated });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        console.log('[Auth] onRehydrateStorage called');
        state?.setHasHydrated(true);
        // 水合后同步 token 到 localStorage（双重保险）
        if (state?.token && typeof window !== 'undefined') {
          console.log('[Auth] Syncing token to localStorage after hydration:', state.token.substring(0, 20) + '...');
          localStorage.setItem('token', state.token);
        }
      }
    }
  )
);
