'use client'

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissionStore } from '@/stores/permission';
import { getUsers, toggleUserStatus, type AdminUser, type UserFilters } from '@/lib/admin-api';
import { DataTable, Column } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Eye, Edit, Ban, CheckCircle, UserPlus, RefreshCw } from 'lucide-react';

export default function UsersPage() {
  const router = useRouter();
  const { can } = usePermissionStore();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filters, setFilters] = useState<UserFilters>({
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    userId: '',
    userName: '',
    action: '' as 'toggle' | 'delete',
    targetStatus: false,
  });

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!can('user:view')) {
      return;
    }
    loadUsers();
  }, [can, filters]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const result = await getUsers(filters);
      if (result.success && result.users) {
        setUsers(result.users);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadUsers();
  };

  const handleSearch = (search: string) => {
    setFilters({ ...filters, search, page: 1 });
  };

  const handleFilter = (filter: string) => {
    if (filter === 'all') {
      setFilters({ ...filters, isActive: undefined, page: 1 });
    } else if (filter === 'active') {
      setFilters({ ...filters, isActive: true, page: 1 });
    } else if (filter === 'inactive') {
      setFilters({ ...filters, isActive: false, page: 1 });
    }
  };

  const handlePageChange = (page: number) => {
    setFilters({ ...filters, page });
  };

  const handleSort = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilters({ ...filters, sortBy, sortOrder });
  };

  const openConfirmDialog = (
    userId: string,
    userName: string,
    action: 'toggle' | 'delete',
    targetStatus = false
  ) => {
    setConfirmDialog({
      isOpen: true,
      userId,
      userName,
      action,
      targetStatus,
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({
      isOpen: false,
      userId: '',
      userName: '',
      action: 'toggle',
      targetStatus: false,
    });
  };

  const handleConfirmAction = async () => {
    setIsProcessing(true);
    try {
      if (confirmDialog.action === 'toggle') {
        const result = await toggleUserStatus(confirmDialog.userId, confirmDialog.targetStatus);
        if (result.success) {
          setUsers(users.map(u =>
            u._id === confirmDialog.userId
              ? { ...u, isActive: confirmDialog.targetStatus }
              : u
          ));
        }
      } else if (confirmDialog.action === 'delete') {
        // Handle delete - will be implemented
        console.log('Delete user:', confirmDialog.userId);
      }
      closeConfirmDialog();
    } catch (error) {
      console.error('Failed to perform action:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const columns: Column<AdminUser>[] = [
    {
      key: 'name',
      title: '用户',
      sortable: true,
      render: (user) => (
        <div>
          <div className="font-medium text-gray-900">{user.name}</div>
          <div className="text-sm text-gray-500">{user.email}</div>
        </div>
      ),
    },
    {
      key: 'uniqueCode',
      title: '唯一码',
      sortable: true,
      render: (user) => (
        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
          {user.uniqueCode}
        </code>
      ),
    },
    {
      key: 'role',
      title: '角色',
      sortable: true,
      render: (user) => (
        <Badge variant={user.role?.name === '管理员' ? 'default' : 'secondary'}>
          {user.role?.name || '普通用户'}
        </Badge>
      ),
    },
    {
      key: 'isActive',
      title: '状态',
      sortable: true,
      render: (user) => (
        <div className="flex items-center gap-1">
          {user.isActive ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-600">激活</span>
            </>
          ) : (
            <>
              <Ban className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-600">禁用</span>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      title: '注册时间',
      sortable: true,
      render: (user) => (
        <div className="text-sm text-gray-600">
          {new Date(user.createdAt).toLocaleDateString('zh-CN')}
          <div className="text-xs text-gray-400">
            {new Date(user.createdAt).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      ),
    },
    {
      key: 'lastLogin',
      title: '最后登录',
      sortable: true,
      render: (user) => (
        <div className="text-sm text-gray-600">
          {user.lastLogin
            ? new Date(user.lastLogin).toLocaleDateString('zh-CN')
            : '从未登录'}
        </div>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      render: (user) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/admin/users/${user._id}`)}>
              <Eye className="w-4 h-4 mr-2" />
              查看详情
            </DropdownMenuItem>
            {can('user:update') && (
              <DropdownMenuItem onClick={() => router.push(`/admin/users/${user._id}/edit`)}>
                <Edit className="w-4 h-4 mr-2" />
                编辑
              </DropdownMenuItem>
            )}
            {can('user:update') && (
              <DropdownMenuItem
                onClick={() =>
                  openConfirmDialog(user._id, user.name, 'toggle', !user.isActive)
                }
              >
                {user.isActive ? (
                  <>
                    <Ban className="w-4 h-4 mr-2" />
                    禁用用户
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    启用用户
                  </>
                )}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (!can('user:view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">您没有权限查看用户管理</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
          <p className="text-gray-600">管理系统中的所有用户</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          {can('user:create') && (
            <Button
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              onClick={() => router.push('/admin/users/create')}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              添加用户
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总用户数</CardDescription>
            <CardTitle className="text-3xl">{pagination.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>激活用户</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {users.filter(u => u.isActive).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>禁用用户</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {users.filter(u => !u.isActive).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <CardDescription>查看和管理所有注册用户</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={users}
            columns={columns}
            isLoading={isLoading}
            searchable
            searchPlaceholder="搜索用户名、邮箱或唯一码..."
            filterable
            filterOptions={[
              { value: 'all', label: '全部用户' },
              { value: 'active', label: '激活用户' },
              { value: 'inactive', label: '禁用用户' },
            ]}
            pagination={pagination}
            onPageChange={handlePageChange}
            onSearchChange={handleSearch}
            onFilterChange={handleFilter}
            onSortChange={handleSort}
            emptyMessage="暂无用户数据"
            rowKey={(user) => user._id}
          />
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirmDialog}
        onConfirm={handleConfirmAction}
        title={
          confirmDialog.action === 'toggle'
            ? confirmDialog.targetStatus
              ? '启用用户'
              : '禁用用户'
            : '删除用户'
        }
        description={
          confirmDialog.action === 'toggle'
            ? `确定要${confirmDialog.targetStatus ? '启用' : '禁用'}用户 "${confirmDialog.userName}" 吗？`
            : `确定要删除用户 "${confirmDialog.userName}" 吗？此操作不可撤销。`
        }
        confirmText={confirmDialog.action === 'toggle' ? (confirmDialog.targetStatus ? '启用' : '禁用') : '删除'}
        variant={confirmDialog.action === 'delete' ? 'danger' : 'warning'}
        isLoading={isProcessing}
      />
    </div>
  );
}
