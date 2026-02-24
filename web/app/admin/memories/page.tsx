'use client'

import { useEffect, useState } from 'react';
import { usePermissionStore } from '@/stores/permission';
import { getUser, getUserMemories, type UserMemorySummary, type AdminUser } from '@/lib/admin-api';
import { UserMemoryList } from './components/UserMemoryList';
import { MemoryDetail } from './components/MemoryDetail';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, FileText, HardDrive, Activity } from 'lucide-react';

export default function MemoriesPage() {
  const { can } = usePermissionStore();

  const [userSummaries, setUserSummaries] = useState<UserMemorySummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMemories: 0,
    indexedUsers: 0,
    roleCardGenerated: 0,
  });

  useEffect(() => {
    if (!can('memory:view')) {
      return;
    }
    loadUserSummaries();
  }, [can, refreshTrigger]);

  const loadUserSummaries = async () => {
    setIsLoading(true);
    try {
      const result = await getUserMemories({ search: searchQuery || undefined });
      if (result.success && result.users) {
        setUserSummaries(result.users);
        setStats({
          // Use pagination.total for accurate count, fall back to current page length
          totalUsers: result.pagination?.total ?? result.users.length,
          // Sum memory counts from all users on current page
          totalMemories: result.users.reduce((sum, u) => sum + u.memoryCount, 0),
          indexedUsers: result.users.filter(u => u.vectorIndexExists).length,
          roleCardGenerated: result.users.filter(u => u.roleCardGenerated).length,
        });
      }
    } catch (error) {
      console.error('Failed to load user memories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectUser = async (userId: string) => {
    setSelectedUserId(userId);
    try {
      const result = await getUser(userId);
      if (result.success && result.user) {
        setSelectedUser(result.user);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const handleBack = () => {
    setSelectedUserId(null);
    setSelectedUser(null);
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    if (selectedUserId) {
      handleSelectUser(selectedUserId);
    }
  };

  if (!can('memory:view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">您没有权限查看记忆管理</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">记忆管理</h1>
        <p className="text-gray-600">查看和管理用户的记忆数据和向量索引</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              总用户数
            </CardDescription>
            <CardTitle className="text-3xl">{stats.totalUsers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              总记忆数
            </CardDescription>
            <CardTitle className="text-3xl">{stats.totalMemories}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              已建索引
            </CardDescription>
            <CardTitle className="text-3xl text-blue-600">{stats.indexedUsers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              角色卡已生成
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.roleCardGenerated}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Content */}
      {selectedUserId ? (
        <MemoryDetail
          userId={selectedUserId}
          user={selectedUser}
          onBack={handleBack}
          onRefresh={handleRefresh}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>用户列表</CardTitle>
            <CardDescription>
              选择一个用户查看其记忆数据和向量索引状态
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserMemoryList
              users={userSummaries}
              isLoading={isLoading}
              selectedUserId={selectedUserId}
              onSelectUser={handleSelectUser}
              onSearchChange={(query) => {
                setSearchQuery(query);
                // Debounce search
                const timeout = setTimeout(() => {
                  setRefreshTrigger(prev => prev + 1);
                }, 500);
                return () => clearTimeout(timeout);
              }}
              searchQuery={searchQuery}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
