'use client'

import { useEffect, useState } from 'react';
import { usePermissionStore } from '@/stores/permission';
import {
  FileText,
  Search,
  Filter,
  Clock,
  User,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Activity,
  Database,
  Settings,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getActivityLogs,
  getActivityLogStats,
  exportActivityLogs,
  type ActivityLogItem,
  type ActivityLogStats,
  type ActivityLogFilters,
} from '@/lib/admin-api';

export default function ActivityLogsPage() {
  const { can } = usePermissionStore();

  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [stats, setStats] = useState<ActivityLogStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [filters, setFilters] = useState<ActivityLogFilters>({
    page: 1,
    limit: 20,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    if (can('system:view')) {
      loadData();
    }
  }, [can, filters]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [logsResult, statsResult] = await Promise.all([
        getActivityLogs(filters),
        getActivityLogStats({
          startDate: filters.startDate,
          endDate: filters.endDate,
        }),
      ]);

      if (logsResult.success && logsResult.logs) {
        setLogs(logsResult.logs);
        if (logsResult.pagination) {
          setPagination(logsResult.pagination);
        }
      }

      if (statsResult.success && statsResult.stats) {
        setStats(statsResult.stats);
      }
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    setIsExporting(true);
    try {
      const result = await exportActivityLogs(filters, format);
      if (result.success && result.data) {
        if (format === 'csv') {
          // CSV is returned as string
          const blob = new Blob([result.data as string], {
            type: 'text/csv;charset=utf-8;',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          // JSON
          const blob = new Blob([JSON.stringify(result.data, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `activity_logs_${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } else {
        alert(`导出失败: ${result.error}`);
      }
    } catch (error) {
      alert(`导出失败: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'user':
        return <User className="w-4 h-4" />;
      case 'memory':
        return <Database className="w-4 h-4" />;
      case 'questionnaire':
        return <FileText className="w-4 h-4" />;
      case 'system':
        return <Settings className="w-4 h-4" />;
      case 'role':
        return <Shield className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      user: '用户',
      memory: '记忆',
      questionnaire: '问卷',
      system: '系统',
      role: '角色',
    };
    return labels[category] || category;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('zh-CN');
  };

  const getCategoryBadgeVariant = (
    category: string
  ): 'default' | 'secondary' | 'outline' | 'destructive' => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      user: 'default',
      memory: 'secondary',
      questionnaire: 'outline',
      system: 'default',
      role: 'secondary',
    };
    return variants[category] || 'outline';
  };

  if (!can('system:view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">您没有权限访问此页面</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">操作日志</h1>
          <p className="text-gray-600">查看系统操作记录和审计日志</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleExport('csv')}
            disabled={isExporting}
          >
            <Download className="w-4 h-4 mr-2" />
            导出 CSV
          </Button>
          <Button onClick={() => loadData()} disabled={isLoading}>
            刷新
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500">总操作数</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500">成功操作</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.bySuccess?.succeeded || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500">失败操作</p>
              <p className="text-2xl font-bold text-red-600">
                {stats.bySuccess?.failed || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500">操作类型</p>
              <p className="text-2xl font-bold text-blue-600">
                {Object.keys(stats.byOperation || {}).length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>搜索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="搜索..."
                  value={filters.search || ''}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value, page: 1 })
                  }
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>类别</Label>
              <Select
                value={filters.category || 'all'}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    category: value === 'all' ? undefined : value,
                    page: 1,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类别</SelectItem>
                  <SelectItem value="user">用户</SelectItem>
                  <SelectItem value="memory">记忆</SelectItem>
                  <SelectItem value="questionnaire">问卷</SelectItem>
                  <SelectItem value="system">系统</SelectItem>
                  <SelectItem value="role">角色</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={filters.success || 'all'}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    success: value === 'all' ? undefined : value,
                    page: 1,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="true">成功</SelectItem>
                  <SelectItem value="false">失败</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>每页显示</Label>
              <Select
                value={String(filters.limit || 20)}
                onValueChange={(value) =>
                  setFilters({ ...filters, limit: parseInt(value), page: 1 })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10条</SelectItem>
                  <SelectItem value="20">20条</SelectItem>
                  <SelectItem value="50">50条</SelectItem>
                  <SelectItem value="100">100条</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            操作记录 ({pagination.total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>暂无操作记录</p>
            </div>
          ) : (
            <>
              <div className="divide-y">
                {logs.map((log) => (
                  <div
                    key={log._id}
                    className="py-4 cursor-pointer hover:bg-gray-50"
                    onClick={() =>
                      setExpandedLog(expandedLog === log._id ? null : log._id)
                    }
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={getCategoryBadgeVariant(log.category)}
                            className="flex items-center gap-1"
                          >
                            {getCategoryIcon(log.category)}
                            {getCategoryLabel(log.category)}
                          </Badge>
                          <span className="text-sm font-medium">
                            {log.operation}
                          </span>
                          {log.success ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>

                        <p className="mt-1 text-sm text-gray-700">
                          {log.description || log.operation}
                        </p>

                        <div className="mt-2 text-xs text-gray-500 flex items-center gap-4 flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            操作者: {log.actorName || log.actorId?.name || '系统'}
                          </span>
                          {log.targetName && (
                            <span>目标: {log.targetName}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(log.createdAt)}
                          </span>
                        </div>

                        {/* Expanded Details */}
                        {expandedLog === log._id && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                            {log.errorMessage && (
                              <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-red-700">
                                错误: {log.errorMessage}
                              </div>
                            )}
                            {log.details && Object.keys(log.details).length > 0 && (
                              <div>
                                <p className="font-medium mb-1">详细信息:</p>
                                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.ipAddress && (
                              <p className="mt-2 text-gray-500">
                                IP地址: {log.ipAddress}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-gray-500">
                    第 {pagination.page} / {pagination.totalPages} 页
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFilters({ ...filters, page: pagination.page - 1 })
                      }
                      disabled={pagination.page <= 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFilters({ ...filters, page: pagination.page + 1 })
                      }
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      下一页
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
