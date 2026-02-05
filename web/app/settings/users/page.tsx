'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PermissionGate } from '@/components/PermissionGate';
import type { User, Role } from '@/types';
import { getUserId } from '@/types';

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
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">用户管理</h1>
        <PermissionGate permissions={['user:create']}>
          <Button onClick={() => setShowCreateModal(true)} className="mt-4">
            创建用户
          </Button>
        </PermissionGate>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSearch} className="mb-4 flex gap-2">
          <Input
            placeholder="搜索用户..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button type="submit">搜索</Button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">名称</th>
                <th className="text-left p-2">邮箱</th>
                <th className="text-left p-2">角色</th>
                <th className="text-left p-2">状态</th>
                <th className="text-left p-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-b">
                  <td className="p-2">{user.name}</td>
                  <td className="p-2">{user.email}</td>
                  <td className="p-2">{user.role?.name || '-'}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {user.isActive ? '活跃' : '禁用'}
                    </span>
                  </td>
                  <td className="p-2">
                    <PermissionGate permissions={['user:update']}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleStatus(getUserIdOrThrow(user))}
                        className="mr-2"
                      >
                        {user.isActive ? '禁用' : '启用'}
                      </Button>
                    </PermissionGate>
                    <PermissionGate permissions={['user:update']}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingUser(user)}
                        className="mr-2"
                      >
                        编辑
                      </Button>
                    </PermissionGate>
                    <PermissionGate permissions={['user:delete']}>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(getUserIdOrThrow(user))}
                      >
                        删除
                      </Button>
                    </PermissionGate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </div>
  );
}
