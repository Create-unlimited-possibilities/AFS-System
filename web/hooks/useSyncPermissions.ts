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
    if (user && user.role) {
      initializePermissions(user);
    } else {
      clearPermissions();
    }
  }, [user, initializePermissions, clearPermissions]);
}
