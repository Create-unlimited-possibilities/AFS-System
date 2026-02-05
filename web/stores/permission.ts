import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface PermissionState {
  userPermissions: string[];
  userRole: string | null;
  isLoading: boolean;
  initializePermissions: (user: User) => void;
  clearPermissions: () => void;
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  isRole: (roleName: string) => boolean;
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      userPermissions: [],
      userRole: null,
      isLoading: false,

      initializePermissions: (user: User) => {
        const permissions = user.role?.permissions.map((p) => p.name) || [];
        const role = user.role?.name || null;

        set({
          userPermissions: permissions,
          userRole: role,
          isLoading: false,
        });
      },

      clearPermissions: () => {
        set({
          userPermissions: [],
          userRole: null,
          isLoading: false,
        });
      },

      can: (permission: string) => {
        const { userPermissions } = get();
        return userPermissions.includes(permission);
      },

      canAny: (permissions: string[]) => {
        const { userPermissions } = get();
        return permissions.some((p) => userPermissions.includes(p));
      },

      isRole: (roleName: string) => {
        const { userRole } = get();
        return userRole === roleName;
      },
    }),
    {
      name: 'permission-storage',
      partialize: (state) => ({
        userPermissions: state.userPermissions,
        userRole: state.userRole,
      }),
    }
  )
);
