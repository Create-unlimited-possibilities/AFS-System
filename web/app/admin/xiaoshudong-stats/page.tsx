'use client'

import { useEffect, useState } from 'react';
import { useAdminAuthStore } from '@/stores/admin-auth';
import { usePermissionStore } from '@/stores/permission';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatsCard } from '@/components/admin/StatsCard';
import {
  MessageSquareHeart,
  Users,
  MessageSquare,
  TrendingUp,
  Calendar,
  Loader2,
  RefreshCw,
  Ear,
  Brain,
  GitCompare,
} from 'lucide-react';
import {
  getXiaoshudongStats,
  type XiaoshudongStats,
} from '@/lib/admin-api';
import { format, subDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function XiaoshudongStatsPage() {
  const { admin } = useAdminAuthStore();
  const { can } = usePermissionStore();
  const router = useRouter();

  const [stats, setStats] = useState<XiaoshudongStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date filter state
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    if (!can('memory:view')) {
      router.push('/admin');
      return;
    }
    loadStats();
  }, [dateRange]);

  const loadStats = async () => {
    try {
      setError(null);
      if (dateRange !== '30d') setIsLoading(true);
      else setIsRefreshing(true);

      const endDate = new Date().toISOString();
      const startDate = subDays(new Date(), dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90).toISOString();

      const result = await getXiaoshudongStats({ startDate, endDate });

      if (result.success && result.stats) {
        setStats(result.stats);
      } else {
        setError(result.error || '获取统计数据失败');
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
      setError('加载统计数据失败');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadStats();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <p className="text-gray-500">加载统计数据...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={loadStats} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate phase percentages
  const totalPhases = (stats?.phaseDistribution?.listening || 0) +
                      (stats?.phaseDistribution?.analysis || 0) +
                      (stats?.phaseDistribution?.transition || 0);

  const phaseData = totalPhases > 0 ? {
    listening: Math.round(((stats?.phaseDistribution?.listening || 0) / totalPhases) * 100),
    analysis: Math.round(((stats?.phaseDistribution?.analysis || 0) / totalPhases) * 100),
    transition: Math.round(((stats?.phaseDistribution?.transition || 0) / totalPhases) * 100),
  } : { listening: 0, analysis: 0, transition: 0 };

  // Get max value for daily chart scaling
  const maxDailyCount = Math.max(...(stats?.dailyStats?.map(d => d.count) || [0]), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <MessageSquareHeart className="w-8 h-8" />
              小树洞统计
            </h1>
            <p className="text-pink-100">
              查看小树洞功能的使用数据和用户参与情况
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="secondary"
            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex gap-2">
        <Button
          variant={dateRange === '7d' ? 'default' : 'outline'}
          onClick={() => setDateRange('7d')}
          size="sm"
        >
          最近 7 天
        </Button>
        <Button
          variant={dateRange === '30d' ? 'default' : 'outline'}
          onClick={() => setDateRange('30d')}
          size="sm"
        >
          最近 30 天
        </Button>
        <Button
          variant={dateRange === '90d' ? 'default' : 'outline'}
          onClick={() => setDateRange('90d')}
          size="sm"
        >
          最近 90 天
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="总对话数"
          value={stats?.totalConversations || 0}
          description="小树洞对话总数"
          icon={MessageSquare}
          color="from-pink-500 to-pink-600"
        />
        <StatsCard
          title="总用户数"
          value={stats?.totalUsers || 0}
          description="使用过小树洞的用户"
          icon={Users}
          color="from-purple-500 to-purple-600"
        />
        <StatsCard
          title="活跃会话"
          value={stats?.activeSessions || 0}
          description="当前在线会话数"
          icon={TrendingUp}
          color="from-blue-500 to-blue-600"
        />
        <StatsCard
          title="平均轮次"
          value={stats?.avgTurnCount?.toFixed(1) || '0'}
          description="平均对话轮数"
          icon={Calendar}
          color="from-green-500 to-green-600"
        />
      </div>

      {/* Daily Conversation Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            每日对话量趋势
          </CardTitle>
          <CardDescription>
            {dateRange === '7d' ? '最近 7 天' : dateRange === '30d' ? '最近 30 天' : '最近 90 天'}的对话量变化
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.dailyStats && stats.dailyStats.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-end gap-1 h-40">
                {stats.dailyStats.map((day) => {
                  const height = (day.count / maxDailyCount) * 100;
                  return (
                    <div
                      key={day.date}
                      className="flex-1 flex flex-col items-center gap-1 group"
                    >
                      <div className="relative w-full flex items-end justify-center">
                        <div
                          className="w-full max-w-8 bg-gradient-to-t from-pink-500 to-purple-500 rounded-t-sm transition-all hover:from-pink-400 hover:to-purple-400"
                          style={{ height: `${Math.max(height, 5)}%` }}
                        />
                        <div className="absolute -top-8 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {day.count} 次对话
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 truncate w-full text-center">
                        {format(new Date(day.date), 'M/d', { locale: zhCN })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              暂无数据
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="w-5 h-5" />
            对话阶段分布
          </CardTitle>
          <CardDescription>
            倾听阶段 vs 探索阶段的比例
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Listening Phase */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ear className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">倾听阶段</span>
                </div>
                <Badge className="bg-blue-100 text-blue-700">
                  {stats?.phaseDistribution?.listening || 0}
                </Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full transition-all"
                  style={{ width: `${phaseData.listening}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 text-right">
                {phaseData.listening}%
              </p>
              <p className="text-xs text-gray-400">
                用户倾诉和情感支持的阶段
              </p>
            </div>

            {/* Transition Phase */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-yellow-500" />
                  <span className="font-medium">过渡阶段</span>
                </div>
                <Badge className="bg-yellow-100 text-yellow-700">
                  {stats?.phaseDistribution?.transition || 0}
                </Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-yellow-500 to-yellow-400 h-3 rounded-full transition-all"
                  style={{ width: `${phaseData.transition}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 text-right">
                {phaseData.transition}%
              </p>
              <p className="text-xs text-gray-400">
                从倾听转向分析的过渡期
              </p>
            </div>

            {/* Analysis Phase */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-500" />
                  <span className="font-medium">探索分析</span>
                </div>
                <Badge className="bg-purple-100 text-purple-700">
                  {stats?.phaseDistribution?.analysis || 0}
                </Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all"
                  style={{ width: `${phaseData.analysis}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 text-right">
                {phaseData.analysis}%
              </p>
              <p className="text-xs text-gray-400">
                深度分析和建议阶段
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">关于小树洞</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p><strong>倾听阶段：</strong>用户倾诉烦恼，AI提供情感支持和引导</p>
            <p><strong>过渡阶段：</strong>用户准备接受更深层次的分析</p>
            <p><strong>探索分析：</strong>AI结合命理知识提供深度分析建议</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">数据说明</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>• 统计数据基于已保存的小树洞对话记忆</p>
            <p>• 活跃会话数为当前在线的实时会话</p>
            <p>• 平均轮次为每个用户的平均对话次数</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
