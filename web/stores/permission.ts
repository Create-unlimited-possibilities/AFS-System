import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface RoleWithPermissions {
  _id: string;
  name: string;
  permissions: Array<{ _id: string; name: string }>;
  [key: string]: any;
}

interface PermissionState {
  userPermissions: string[];
  userRole: string | null;
  isLoading: boolean;
  initializePermissions: (user: User | { role?: RoleWithPermissions }) => void;
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

      initializePermissions: (user: User | { role?: RoleWithPermissions }) => {
        const role = user?.role;
        if (!role) {
          console.log('[PermissionStore] No role found, clearing permissions');
          set({
            userPermissions: [],
            userRole: null,
            isLoading: false,
          });
          return;
        }

        const permissions = Array.isArray(role.permissions) ? role.permissions : [];
        const roleName = role.name || null;
        const isAdmin = (role as any).isAdmin === true;

        // Extract permission names - handle both populated (objects) and unpopulated (strings/ObjectIds)
        let permissionNames: string[] = [];
        for (const p of permissions) {
          if (typeof p === 'string') {
            // Unpopulated ObjectId - skip (can't get name)
            console.warn('[PermissionStore] Permission not populated:', p);
          } else if (p && typeof p === 'object' && p.name) {
            permissionNames.push(p.name);
          }
        }

        // If admin role has no permissions but isAdmin flag is true,
        // grant all common permissions (fallback for admin users)
        if (isAdmin && permissionNames.length === 0) {
          console.log('[PermissionStore] Admin with no permissions - granting all permissions');
          permissionNames = [
            'user:view', 'user:create', 'user:update', 'user:delete',
            'role:view', 'role:create', 'role:update', 'role:delete',
            'permission:view',
            'system:view', 'system:update',
            'questionnaire:view', 'questionnaire:create', 'questionnaire:update', 'questionnaire:delete',
            'memory:view', 'memory:manage',
            'invitecode:view', 'invitecode:create', 'invitecode:delete',
            'content:manage',
          ];
        }

        console.log('[PermissionStore] Initializing permissions:', {
          roleName,
          isAdmin,
          permissionsCount: permissionNames.length,
          permissionNames
        });

        set({
          userPermissions: permissionNames,
          userRole: roleName,
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
