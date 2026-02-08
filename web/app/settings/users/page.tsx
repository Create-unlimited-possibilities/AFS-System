'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PermissionGate } from '@/components/PermissionGate';
import type { User, Role } from '@/types';
import { getUserId } from '@/types';
import { Users, Search, Edit, Trash2, UserPlus, Shield, CheckCircle, XCircle } from 'lucide-react';
import CloudPattern from '@/components/decorations/CloudPattern'

interface UsersResponse {
  success: boolean;
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [pagination.page]);

  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/users?page=${pagination.page}&limit=${pagination.limit}&search=${search}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data: UsersResponse = await response.json();
    if (data.success) {
      setUsers(data.users);
      setPagination(data.pagination);
    }
  };

  const fetchRoles = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/roles', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.success) {
      setRoles(data.roles);
    }
  };

  const handleToggleStatus = async (userId: string) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/users/${userId}/toggle-status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('确定要删除这个用户吗？')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchUsers();
  };

  const getUserIdOrThrow = (user: User): string => {
    const id = getUserId(user);
    if (!id) throw new Error('User ID is required');
    return id;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  return (
    <div className="min-h-screen gradient-bg">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto relative">
          <div className="absolute top-10 left-10 opacity-10 animate-float">
            <CloudPattern className="w-32 h-16 text-orange-500" />
          </div>

          <div className="mb-8 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">用户管理</h1>
                  <p className="text-gray-600 mt-1">管理系统中的所有用户账户</p>
                </div>
              </div>
              <PermissionGate permissions={['user:create']}>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
                >
                  <UserPlus className="h-5 w-5" />
                  创建用户
                </Button>
              </PermissionGate>
            </div>
          </div>

          <Card className="mb-6 hover:shadow-xl transition-all duration-300 animate-slide-up">
            <CardContent className="pt-6">
              <form onSubmit={handleSearch} className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="搜索用户..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all duration-300"
                  />
                </div>
                <Button
                  type="submit"
                  className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
                >
                  <Search className="h-5 w-5" />
                  搜索
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-blue-200">
                      <th className="text-left p-4 font-semibold text-gray-900">名称</th>
                      <th className="text-left p-4 font-semibold text-gray-900">邮箱</th>
                      <th className="text-left p-4 font-semibold text-gray-900">角色</th>
                      <th className="text-left p-4 font-semibold text-gray-900">状态</th>
                      <th className="text-left p-4 font-semibold text-gray-900">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user, index) => (
                      <tr key={user._id} className="border-b hover:bg-blue-50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                              <Users className="h-5 w-5 text-white" />
                            </div>
                            <span className="font-medium text-gray-900">{user.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-gray-600">{user.email}</td>
                        <td className="p-4">
                          {user.role?.name ? (
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-purple-600" />
                              <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-lg text-sm font-medium">
                                {user.role.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          {user.isActive ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
                              <CheckCircle className="h-4 w-4" />
                              活跃
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-lg text-sm font-medium">
                              <XCircle className="h-4 w-4" />
                              禁用
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <PermissionGate permissions={['user:update']}>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleStatus(getUserIdOrThrow(user))}
                                className={`border-2 hover:bg-gray-50 transition-all duration-300 ${
                                  user.isActive
                                    ? 'border-orange-200 text-orange-600 hover:border-orange-400'
                                    : 'border-green-200 text-green-600 hover:border-green-400'
                                }`}
                              >
                                {user.isActive ? '禁用' : '启用'}
                              </Button>
                            </PermissionGate>
                            <PermissionGate permissions={['user:update']}>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingUser(user)}
                                className="border-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-all duration-300"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                            <PermissionGate permissions={['user:delete']}>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteUser(getUserIdOrThrow(user))}
                                className="border-2 border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-400 transition-all duration-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-between items-center">
                <span className="text-gray-600">共 <span className="font-bold text-gray-900">{pagination.total}</span> 条记录</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    className="border-2 border-blue-200 hover:bg-blue-50 hover:border-blue-400 transition-all duration-300"
                  >
                    上一页
                  </Button>
                  <span className="flex items-center px-4 py-2 bg-blue-50 rounded-lg font-medium text-blue-700">
                    {pagination.page} / {pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page === pagination.pages}
                    className="border-2 border-blue-200 hover:bg-blue-50 hover:border-blue-400 transition-all duration-300"
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
