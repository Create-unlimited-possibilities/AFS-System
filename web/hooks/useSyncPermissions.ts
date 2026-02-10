'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { usePermissionStore } from '@/stores/permission';

/**
 * Hook to synchronize permissions with the current user
 * This should be used in the root layout or a provider component
 */
export function useSyncPermissions() {
  const user = useAuthStore((state) => state.user);
  const initializePermissions = usePermissionStore((state) => state.initializePermissions);
  const clearPermissions = usePermissionStore((state) => state.clearPermissions);

  useEffect(() => {
    console.log('[useSyncPermissions] User state changed:', {
      hasUser: !!user,
      hasRole: !!user?.role,
      userId: user?._id || user?.id,
      roleName: user?.role?.name
    });

    if (user && user.role) {
      const role = user.role;

      if (!role.permissions || !Array.isArray(role.permissions)) {
        console.warn('[useSyncPermissions] Role exists but permissions is missing or invalid:', {
          userId: user._id || user.id,
          roleName: role.name,
          permissions: role.permissions
        });
        clearPermissions();
        return;
      }

      const hasValidPermissions = role.permissions.length > 0;
      if (hasValidPermissions) {
        console.log('[useSyncPermissions] Initializing permissions for role:', role.name);
        initializePermissions(user);
      } else {
        console.log('[useSyncPermissions] Role has no permissions, clearing');
        clearPermissions();
      }
    } else {
      console.log('[useSyncPermissions] No user or no role, clearing permissions');
      clearPermissions();
    }
  }, [user, initializePermissions, clearPermissions]);
}
