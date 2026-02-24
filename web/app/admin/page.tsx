'use client'

import { useEffect, useState } from 'react';
import { useAdminAuthStore } from '@/stores/admin-auth';
import { usePermissionStore } from '@/stores/permission';
import { usePathname, useRouter } from 'next/navigation';
import {
  Users,
  FileQuestion,
  MessageSquare,
  Activity,
  ArrowRight,
  TrendingUp,
  Database,
  CheckCircle,
  XCircle,
  Clock,
  UserPlus,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatsCard } from '@/components/admin/StatsCard';
import { UserGrowthChart } from '@/components/admin/UserGrowthChart';
import Link from 'next/link';
import {
  getDashboardStats,
  getSystemStatusFast,
  getRecentActivity,
  type DashboardStats,
  type SystemStatus,
  type RecentActivity,
} from '@/lib/admin-api';

export default function AdminDashboardPage() {
  const { admin } = useAdminAuthStore();
  const { can } = usePermissionStore();
  const pathname = usePathname();
  const router = useRouter();

  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsCheckingStatus(true);
      const [statsResult, statusResult, activityResult] = await Promise.all([
        getDashboardStats(),
        getSystemStatusFast(),
        getRecentActivity(5),
      ]);

      if (statsResult.success) {
        setDashboardStats(statsResult.stats || null);
      }
      if (statusResult.success) {
        setSystemStatus(statusResult.status || null);
      }
      if (activityResult.success) {
        setRecentActivities(activityResult.activities || []);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
      setIsCheckingStatus(false);
    }
  };

  const statsCards = [
    {
      title: '总用户数',
      value: dashboardStats?.totalUsers || 0,
      description: '注册用户总数',
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      href: '/admin/users',
      permission: 'user:view',
    },
    {
      title: '今日新增',
      value: dashboardStats?.newUsersToday || 0,
      description: '今天新注册用户',
      icon: UserPlus,
      color: 'from-green-500 to-green-600',
      href: '/admin/users',
      permission: 'user:view',
    },
    {
      title: '活跃用户',
      value: dashboardStats?.activeUsers || 0,
      description: '最近7天活跃用户',
      icon: Activity,
      color: 'from-purple-500 to-purple-600',
      href: '/admin/users',
      permission: 'user:view',
    },
    {
      title: '总对话数',
      value: dashboardStats?.totalConversations || 0,
      description: 'AI对话总数',
      icon: MessageSquare,
      color: 'from-orange-500 to-orange-600',
      href: '/admin/conversations',
      permission: 'conversation:view',
    },
  ];

  const quickActions = [
    {
      title: '生成邀请码',
      description: '创建新的管理员注册邀请码',
      href: '/admin/settings/invite-codes',
      permission: 'invitecode:create',
      color: 'bg-orange-500',
    },
    {
      title: '查看用户',
      description: '管理所有注册用户',
      href: '/admin/users',
      permission: 'user:view',
      color: 'bg-blue-500',
    },
    {
      title: '系统设置',
      description: '配置系统参数',
      href: '/admin/settings',
      permission: 'system:view',
      color: 'bg-gray-700',
    },
  ];

  const filteredStats = statsCards.filter((stat) => !stat.permission || can(stat.permission));
  const filteredActions = quickActions.filter((action) => !action.permission || can(action.permission));

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_registered':
        return <UserPlus className="w-4 h-4 text-blue-500" />;
      case 'memory_created':
        return <Database className="w-4 h-4 text-green-500" />;
      case 'conversation_started':
        return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case 'rolecard_generated':
        return <CheckCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActivityLabel = (activity: RecentActivity) => {
    switch (activity.type) {
      case 'user_registered':
        return `${activity.userName} 注册了账号`;
      case 'memory_created':
        return `${activity.userName} 添加了新记忆`;
      case 'conversation_started':
        return `${activity.userName} 开始了新对话`;
      case 'rolecard_generated':
        return `${activity.userName} 生成了角色卡`;
      default:
        return activity.description;
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">
          欢迎回来，{admin?.name || '管理员'}！
        </h1>
        <p className="text-orange-100">
          这是您的管理后台仪表盘。在这里您可以查看系统概览和管理各项功能。
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.title} href={stat.href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color}`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-2xl">{stat.value}</CardTitle>
                  <CardDescription className="mt-1">{stat.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* User Growth Chart */}
      <UserGrowthChart />

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            系统状态
          </CardTitle>
          <CardDescription>各服务组件运行状态</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* MongoDB */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-green-500" />
                <span className="font-medium">MongoDB</span>
              </div>
              {isCheckingStatus ? (
                <Badge className="bg-yellow-100 text-yellow-700">检查中...</Badge>
              ) : systemStatus?.mongodb.connected ? (
                <Badge className="bg-green-100 text-green-700">正常</Badge>
              ) : (
                <Badge variant="destructive">离线</Badge>
              )}
            </div>

            {/* ChromaDB */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-500" />
                <span className="font-medium">ChromaDB</span>
              </div>
              {isCheckingStatus ? (
                <Badge className="bg-yellow-100 text-yellow-700">检查中...</Badge>
              ) : systemStatus?.chromadb.connected ? (
                <Badge className="bg-green-100 text-green-700">正常</Badge>
              ) : (
                <Badge variant="destructive">离线</Badge>
              )}
            </div>

            {/* LLM */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-500" />
                <span className="font-medium">
                  LLM ({(() => {
                    const providerNames: Record<string, string> = {
                      'ollama': 'Ollama',
                      'deepseek': 'DeepSeek',
                      'openai': 'OpenAI'
                    };
                    return providerNames[systemStatus?.llm.provider || ''] || 'Other';
                  })()})
                </span>
              </div>
              {isCheckingStatus ? (
                <Badge className="bg-yellow-100 text-yellow-700">检查中...</Badge>
              ) : systemStatus?.llm.connected ? (
                <Badge className="bg-green-100 text-green-700">正常</Badge>
              ) : (
                <Badge variant="destructive">离线</Badge>
              )}
            </div>

            {/* Vector Store */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-orange-500" />
                <span className="font-medium">向量存储</span>
              </div>
              {isCheckingStatus ? (
                <Badge className="bg-yellow-100 text-yellow-700">检查中...</Badge>
              ) : systemStatus?.vectorStore.status === 'ready' ? (
                <Badge className="bg-green-100 text-green-700">就绪</Badge>
              ) : systemStatus?.vectorStore.status === 'building' ? (
                <Badge className="bg-yellow-100 text-yellow-700">构建中</Badge>
              ) : (
                <Badge variant="destructive">错误</Badge>
              )}
            </div>
          </div>

          {systemStatus?.vectorStore && (
            <div className="mt-4 text-sm text-gray-500">
              向量索引总数: {systemStatus.vectorStore.totalIndexes}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>快捷操作</CardTitle>
          <CardDescription>常用管理功能快速入口</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-orange-500 hover:shadow-md transition-all cursor-pointer">
                  <div className={`p-3 rounded-lg ${action.color}`}>
                    <ArrowRight className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{action.title}</h3>
                    <p className="text-sm text-gray-500">{action.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {recentActivities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>最近活动</CardTitle>
            <CardDescription>系统中的最新操作记录</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div
                  key={activity._id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="p-2 rounded-full bg-gray-100">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {getActivityLabel(activity)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle>系统信息</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">系统版本</dt>
              <dd className="font-medium">AFS System v1.0.0</dd>
            </div>
            <div>
              <dt className="text-gray-500">当前角色</dt>
              <dd className="font-medium">{admin?.role?.name || '管理员'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">邮箱</dt>
              <dd className="font-medium">{admin?.email || ''}</dd>
            </div>
            <div>
              <dt className="text-gray-500">用户ID</dt>
              <dd className="font-medium">{admin?._id || ''}</dd>
            </div>
            <div>
              <dt className="text-gray-500">最后登录</dt>
              <dd className="font-medium">
                {admin?.lastLogin
                  ? new Date(admin.lastLogin).toLocaleString('zh-CN')
                  : '首次登录'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
