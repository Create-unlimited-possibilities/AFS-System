'use client';

import { useSyncPermissions } from '@/hooks/useSyncPermissions';

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  useSyncPermissions();
  return <>{children}</>;
}
