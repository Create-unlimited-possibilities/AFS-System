'use client'

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { Permission } from '@/lib/admin-api';

interface PermissionEditorProps {
  permissions: Permission[];
  selectedPermissionIds: string[];
  onSelectionChange: (permissionIds: string[]) => void;
  disabled?: boolean;
}

const PERMISSION_CATEGORIES: Record<string, string> = {
  user: '用户管理',
  role: '角色管理',
  system: '系统设置',
  content: '内容管理',
  other: '其他',
};

const CATEGORY_COLORS: Record<string, string> = {
  user: 'bg-blue-100 text-blue-700 border-blue-300',
  role: 'bg-green-100 text-green-700 border-green-300',
  system: 'bg-purple-100 text-purple-700 border-purple-300',
  content: 'bg-orange-100 text-orange-700 border-orange-300',
  other: 'bg-gray-100 text-gray-700 border-gray-300',
};

export function PermissionEditor({
  permissions,
  selectedPermissionIds,
  onSelectionChange,
  disabled = false,
}: PermissionEditorProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(PERMISSION_CATEGORIES))
  );

  // Group permissions by category
  const groupedPermissions = permissions.reduce((acc, permission) => {
    const category = permission.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const togglePermission = (permissionId: string) => {
    if (selectedPermissionIds.includes(permissionId)) {
      onSelectionChange(selectedPermissionIds.filter((id) => id !== permissionId));
    } else {
      onSelectionChange([...selectedPermissionIds, permissionId]);
    }
  };

  const toggleCategoryAll = (category: string, checked: boolean) => {
    const categoryPermissions = groupedPermissions[category] || [];
    if (checked) {
      const newIds = [...new Set([...selectedPermissionIds, ...categoryPermissions.map((p) => p._id)])];
      onSelectionChange(newIds);
    } else {
      onSelectionChange(selectedPermissionIds.filter((id) => !categoryPermissions.some((p) => p._id === id)));
    }
  };

  const isCategoryFullySelected = (category: string): boolean => {
    const categoryPermissions = groupedPermissions[category] || [];
    return categoryPermissions.every((p) => selectedPermissionIds.includes(p._id));
  };

  const isCategoryPartiallySelected = (category: string): boolean => {
    const categoryPermissions = groupedPermissions[category] || [];
    const selectedCount = categoryPermissions.filter((p) => selectedPermissionIds.includes(p._id)).length;
    return selectedCount > 0 && selectedCount < categoryPermissions.length;
  };

  return (
    <div className="space-y-4">
      {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, categoryLabel]) => {
        const categoryPermissions = groupedPermissions[categoryKey] || [];
        if (categoryPermissions.length === 0) return null;

        const isExpanded = expandedCategories.has(categoryKey);
        const isFullySelected = isCategoryFullySelected(categoryKey);
        const isPartiallySelected = isCategoryPartiallySelected(categoryKey);

        return (
          <Card key={categoryKey}>
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => toggleCategory(categoryKey)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isFullySelected}
                    ref={(ref: any) => {
                      if (ref) {
                        const input = ref.querySelector?.('input');
                        if (input) {
                          input.indeterminate = isPartiallySelected && !isFullySelected;
                        }
                      }
                    }}
                    onCheckedChange={(checked) => {
                      toggleCategoryAll(categoryKey, checked === true);
                    }}
                    disabled={disabled}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <CardTitle className="text-lg">{categoryLabel}</CardTitle>
                  <Badge className={CATEGORY_COLORS[categoryKey]}>
                    {categoryPermissions.length} 个权限
                  </Badge>
                </div>
                <div className="text-gray-400">
                  {isExpanded ? '▼' : '▶'}
                </div>
              </div>
              {isPartiallySelected && !isFullySelected && (
                <CardDescription className="mt-2">
                  已选择 {categoryPermissions.filter((p) => selectedPermissionIds.includes(p._id)).length} / {categoryPermissions.length} 个权限
                </CardDescription>
              )}
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-3">
                {categoryPermissions.map((permission) => (
                  <div
                    key={permission._id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Checkbox
                      id={permission._id}
                      checked={selectedPermissionIds.includes(permission._id)}
                      onCheckedChange={() => togglePermission(permission._id)}
                      disabled={disabled}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor={permission._id}
                        className="font-medium text-sm cursor-pointer block"
                      >
                        {permission.name}
                      </label>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {permission.description}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
