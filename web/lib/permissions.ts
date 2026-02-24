import type { User, Role } from '@/types';

// Interface for admin user from admin-auth store
interface AdminUserRole {
  _id: string;
  name: string;
  isAdmin?: boolean;
  permissions: Array<{ _id: string; name: string }>;
}

interface AdminUser {
  _id: string;
  email: string;
  name: string;
  role?: AdminUserRole;
  lastLogin?: string;
}

// Union type for user-like objects (User from main site, or AdminUser from admin panel)
type UserLike = User | AdminUser | null;

// Helper to get user ID from either User or AdminUser
const getUserId = (user: UserLike): string | undefined => {
  if (!user) return undefined;
  return (user as any)._id || (user as any).id;
};

export const hasPermission = (user: UserLike, permissionName: string): boolean => {
  if (!user || !user.role) {
    return false;
  }

  if (!user.role.permissions || !Array.isArray(user.role.permissions)) {
    console.warn('[hasPermission] Invalid permissions:', {
      userId: getUserId(user),
      roleName: user.role.name,
      permissions: user.role.permissions
    });
    return false;
  }

  return user.role.permissions.some(
    (permission) => permission.name === permissionName
  );
};

export const hasAnyPermission = (user: UserLike, permissionNames: string[]): boolean => {
  if (!user || !user.role) {
    return false;
  }

  if (!user.role || !user.role.permissions) {
    console.warn('[hasAnyPermission] Invalid permissions');
    return false;
  }

  return permissionNames.some((permissionName) =>
    user.role?.permissions?.some((permission) => permission.name === permissionName)
  );
};

export const hasAllPermissions = (user: UserLike, permissionNames: string[]): boolean => {
  if (!user || !user.role) {
    return false;
  }

  if (!user.role.permissions || !Array.isArray(user.role.permissions)) {
    console.warn('[hasAllPermissions] Invalid permissions');
    return false;
  }

  return permissionNames.every((permissionName) =>
    user.role?.permissions?.some((permission) => permission.name === permissionName)
  );
};

export const hasRole = (user: UserLike, roleName: string): boolean => {
  if (!user || !user.role) {
    return false;
  }

  return user.role.name === roleName;
};

export const isAdmin = (user: UserLike): boolean => {
  // Check by isAdmin flag (set by backend) or by role name for backward compatibility
  if (!user || !user.role) {
    return false;
  }

  // Check if role has isAdmin flag (primary method)
  if (user.role.isAdmin) {
    return true;
  }

  // Fallback: check by role name (backward compatibility)
  return hasRole(user, '管理员') || hasRole(user, 'admin');
};

export const canManageUsers = (user: UserLike): boolean => {
  return hasAnyPermission(user, ['user:view', 'user:create', 'user:update', 'user:delete']);
};

export const canManageRoles = (user: UserLike): boolean => {
  return hasAnyPermission(user, ['role:view', 'role:create', 'role:update', 'role:delete']);
};

export const canManageSystem = (user: UserLike): boolean => {
  return hasAnyPermission(user, ['system:view', 'system:update']);
};

export const getPermissionLabel = (permissionName: string): string => {
  const labels: Record<string, string> = {
    'user:view': '查看用户',
    'user:create': '创建用户',
    'user:update': '更新用户',
    'user:delete': '删除用户',
    'role:view': '查看角色',
    'role:create': '创建角色',
    'role:update': '更新角色',
    'role:delete': '删除角色',
    'permission:view': '查看权限',
    'system:view': '查看系统设置',
    'system:update': '更新系统设置',
    'content:manage': '管理内容',
  };

  return labels[permissionName] || permissionName;
};

export const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    'user': '用户管理',
    'role': '角色管理',
    'system': '系统设置',
    'content': '内容管理',
    'other': '其他',
  };

  return labels[category] || category;
};

export const groupPermissionsByCategory = (permissions: string[]): Record<string, string[]> => {
  const grouped: Record<string, string[]> = {
    'user': [],
    'role': [],
    'system': [],
    'content': [],
    'other': [],
  };

  permissions.forEach((permission) => {
    const category = permission.split(':')[0] || 'other';
    if (grouped[category]) {
      grouped[category].push(permission);
    } else {
      grouped['other'].push(permission);
    }
  });

  return grouped;
};
