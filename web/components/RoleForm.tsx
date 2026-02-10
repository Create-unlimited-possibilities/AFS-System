'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Role, Permission } from '@/types';

interface RoleFormProps {
  role?: Role;
  permissions: Permission[];
  onSubmit: (data: { name: string; description: string; permissions: string[] }) => void;
  onCancel: () => void;
}

export function RoleForm({ role, permissions, onSubmit, onCancel }: RoleFormProps) {
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    (role?.permissions || []).map((p) => p._id)
  );

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      permissions: selectedPermissions
    });
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">
        {role ? '编辑角色' : '创建角色'}
      </h2>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="role-name">角色名称</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={role?.isSystem}
            />
          </div>
          <div>
            <Label htmlFor="role-description">描述</Label>
            <Input
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label>权限</Label>
            <div className="mt-2 space-y-4 max-h-96 overflow-y-auto">
              {Object.entries(groupedPermissions).map(([category, perms]) => (
                <div key={category}>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">{category}</h4>
                  <div className="space-y-2">
                    {perms.map((perm) => (
                      <div key={perm._id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`perm-${perm._id}`}
                          checked={selectedPermissions.includes(perm._id)}
                          onChange={() => handlePermissionToggle(perm._id)}
                          className="w-4 h-4"
                        />
                        <label
                          htmlFor={`perm-${perm._id}`}
                          className="text-sm cursor-pointer"
                        >
                          <span className="font-medium">{perm.name}</span>
                          <span className="ml-2 text-gray-500">{perm.description}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit" disabled={role?.isSystem}>
            {role ? '更新角色' : '创建角色'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
