import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AdminRole {
  _id: string;
  name: string;
  isAdmin: boolean;
  permissions: Array<{ _id: string; name: string }>;
}

interface AdminUser {
  _id: string;
  email: string;
  name: string;
  role?: AdminRole;
  lastLogin?: string;
}

interface AdminAuthState {
  admin: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;
  login: (admin: AdminUser, token: string) => void;
  logout: () => void;
  setAdmin: (admin: AdminUser) => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      admin: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      hasHydrated: false,
      login: (admin, token) => {
        console.log('[AdminAuth] Login called, storing token to localStorage');
        // Store admin token in separate key to avoid conflict with user auth
        if (typeof window !== 'undefined') {
          localStorage.setItem('admin_token', token);
          console.log('[AdminAuth] Token stored to localStorage:', token.substring(0, 20) + '...');
        }
        set({
          admin,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      },
      logout: () => {
        console.log('[AdminAuth] Logout called, removing token from localStorage');
        // Clear admin token from localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('admin_token');
        }
        set({
          admin: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },
      setAdmin: (admin) => {
        set({ admin });
      },
      setLoading: (isLoading) => set({ isLoading }),
      setHasHydrated: (hasHydrated) => {
        console.log('[AdminAuth] Hydration state changed:', hasHydrated);
        set({ hasHydrated });
      },
    }),
    {
      name: 'admin-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        admin: state.admin,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        console.log('[AdminAuth] onRehydrateStorage called');
        state?.setHasHydrated(true);
        // Sync token to localStorage after hydration
        if (state?.token && typeof window !== 'undefined') {
          console.log('[AdminAuth] Syncing token to localStorage after hydration:', state.token.substring(0, 20) + '...');
          localStorage.setItem('admin_token', state.token);
        }
      }
    }
  )
);

// Helper function to get admin token for API calls
export const getAdminToken = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    const token = localStorage.getItem('admin_token');
    return token || undefined;
  } catch {
    return undefined;
  }
};
