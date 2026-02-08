'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PermissionGate } from '@/components/PermissionGate';
import type { Role, Permission } from '@/types';
import { Shield, Search, Edit, Trash2, UserPlus, Key, CheckCircle } from 'lucide-react';
import CloudPattern from '@/components/decorations/CloudPattern'

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
    <div className="min-h-screen gradient-bg">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto relative">
          <div className="absolute top-10 right-10 opacity-10 animate-float">
            <CloudPattern className="w-32 h-16 text-orange-500" />
          </div>

          <div className="mb-8 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">角色管理</h1>
                  <p className="text-gray-600 mt-1">配置系统角色和权限</p>
                </div>
              </div>
              <PermissionGate permissions={['role:create']}>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
                >
                  <UserPlus className="h-5 w-5" />
                  创建角色
                </Button>
              </PermissionGate>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-6 hover:shadow-xl transition-all duration-300 animate-slide-up">
              <form onSubmit={handleSearch} className="mb-6 flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="搜索角色..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-12 rounded-xl border-gray-200 focus:border-green-500 focus:ring-green-500 transition-all duration-300"
                  />
                </div>
                <Button
                  type="submit"
                  className="gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
                >
                  <Search className="h-5 w-5" />
                  搜索
                </Button>
              </form>

              <div className="space-y-4">
                {roles.map((role, index) => (
                  <div
                    key={role._id}
                    className="card-traditional p-5 hover:shadow-2xl transform hover:-translate-y-1"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                            <Shield className="h-5 w-5 text-white" />
                          </div>
                          <h3 className="font-bold text-xl text-gray-900">{role.name}</h3>
                        </div>
                        <p className="text-gray-600 text-sm mb-3">{role.description}</p>
                        {role.isSystem && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-lg border border-blue-200">
                            <CheckCircle className="h-3 w-3" />
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
                            className="border-2 border-green-200 text-green-600 hover:bg-green-50 hover:border-green-400 transition-all duration-300"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                        {!role.isSystem && (
                          <PermissionGate permissions={['role:delete']}>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteRole(role._id)}
                              className="border-2 border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-400 transition-all duration-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                        )}
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Key className="h-4 w-4 text-orange-600" />
                        <h4 className="font-medium text-gray-900">权限 ({role.permissions.length})</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {role.permissions.map((perm) => (
                          <span key={perm._id} className="px-3 py-1.5 bg-gradient-to-br from-gray-50 to-orange-50 border-2 border-orange-100 rounded-lg text-sm text-gray-700">
                            {perm.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-between items-center pt-4 border-t-2 border-gray-200">
                <span className="text-gray-600">共 <span className="font-bold text-gray-900">{pagination.total}</span> 条记录</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    className="border-2 border-green-200 hover:bg-green-50 hover:border-green-400 transition-all duration-300"
                  >
                    上一页
                  </Button>
                  <span className="flex items-center px-4 py-2 bg-green-50 rounded-lg font-medium text-green-700">
                    {pagination.page} / {pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page === pagination.pages}
                    className="border-2 border-green-200 hover:bg-green-50 hover:border-green-400 transition-all duration-300"
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                  <Key className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-bold text-xl text-gray-900">所有权限</h3>
              </div>
              <div className="space-y-5">
                {Object.entries(groupedPermissions).map(([category, perms], index) => (
                  <div key={category} style={{ animationDelay: `${index * 0.05}s` }}>
                    <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      {category}
                    </h4>
                    <div className="space-y-2">
                      {perms.map((perm) => (
                        <div key={perm._id} className="p-3 bg-white rounded-xl border-2 border-gray-100 hover:border-orange-200 transition-all duration-300">
                          <div className="font-medium text-gray-900 text-sm mb-1">{perm.name}</div>
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
      </div>
    </div>
  );
}
