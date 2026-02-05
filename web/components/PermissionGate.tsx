'use client';

import { usePermissionStore } from '@/stores/permission';

interface PermissionGateProps {
  permissions?: string[];
  roles?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({
  permissions = [],
  roles = [],
  requireAll = false,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can, canAny, isRole } = usePermissionStore();

  const hasPermissionAccess =
    permissions.length > 0
      ? requireAll
        ? permissions.every((perm) => can(perm))
        : canAny(permissions)
      : true;

  const hasRoleAccess =
    roles.length > 0 ? roles.some((role) => isRole(role)) : true;

  const hasAccess = hasPermissionAccess && hasRoleAccess;

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

interface RoleGateProps {
  roles: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGate({ roles, fallback = null, children }: RoleGateProps) {
  const { isRole } = usePermissionStore();

  const hasAccess = roles.some((role) => isRole(role));

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
