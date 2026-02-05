'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PermissionGate } from '@/components/PermissionGate';
import type { Role, Permission } from '@/types';

interface RolesResponse {
  success: boolean;
  roles: Role[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, [pagination.page]);

  const fetchRoles = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/roles?page=${pagination.page}&limit=${pagination.limit}&search=${search}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data: RolesResponse = await response.json();
    if (data.success) {
      setRoles(data.roles);
      setPagination(data.pagination);
    }
  };

  const fetchPermissions = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/roles/permissions', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.success) {
      setAllPermissions(data.permissions);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('确定要删除这个角色吗？')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/roles/${roleId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchRoles();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRoles();
  };

  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">角色管理</h1>
        <PermissionGate permissions={['role:create']}>
          <Button onClick={() => setShowCreateModal(true)} className="mt-4">
            创建角色
          </Button>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <form onSubmit={handleSearch} className="mb-4 flex gap-2">
            <Input
              placeholder="搜索角色..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">搜索</Button>
          </form>

          <div className="space-y-4">
            {roles.map((role) => (
              <div key={role._id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{role.name}</h3>
                    <p className="text-gray-600 text-sm">{role.description}</p>
                    {role.isSystem && (
                      <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        系统角色
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <PermissionGate permissions={['role:update']}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingRole(role)}
                      >
                        编辑
                      </Button>
                    </PermissionGate>
                    {!role.isSystem && (
                      <PermissionGate permissions={['role:delete']}>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteRole(role._id)}
                        >
                          删除
                        </Button>
                      </PermissionGate>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="font-medium mb-2">权限 ({role.permissions.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {role.permissions.map((perm) => (
                      <span key={perm._id} className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {perm.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-between items-center">
            <span>共 {pagination.total} 条记录</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
              >
                上一页
              </Button>
              <span className="flex items-center">
                {pagination.page} / {pagination.pages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page === pagination.pages}
              >
                下一页
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4">所有权限</h3>
          <div className="space-y-4">
            {Object.entries(groupedPermissions).map(([category, perms]) => (
              <div key={category}>
                <h4 className="font-medium text-sm text-gray-700 mb-2">{category}</h4>
                <div className="space-y-2">
                  {perms.map((perm) => (
                    <div key={perm._id} className="text-sm">
                      <div className="font-medium">{perm.name}</div>
                      <div className="text-gray-500 text-xs">{perm.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
