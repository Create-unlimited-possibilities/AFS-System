'use client'

import { useEffect, useState } from 'react';
import { usePermissionStore } from '@/stores/permission';
import {
  Trash2,
  RotateCcw,
  Search,
  Filter,
  AlertCircle,
  Clock,
  User,
  FileText,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle,
  XCircle,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getRecycleBin,
  getRecycleBinStats,
  restoreRecycleBinItem,
  purgeRecycleBinItem,
  batchRestoreRecycleBin,
  batchPurgeRecycleBin,
  type RecycleBinItem,
  type RecycleBinStats,
  type RecycleBinFilters,
} from '@/lib/admin-api';

export default function RecycleBinPage() {
  const { can } = usePermissionStore();

  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [stats, setStats] = useState<RecycleBinStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<RecycleBinFilters>({
    page: 1,
    limit: 20,
    status: 'pending_purge',
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const [restoreDialog, setRestoreDialog] = useState<{
    open: boolean;
    item: RecycleBinItem | null;
  }>({ open: false, item: null });

  const [purgeDialog, setPurgeDialog] = useState<{
    open: boolean;
    item: RecycleBinItem | null;
    isBatch: boolean;
  }>({ open: false, item: null, isBatch: false });

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (can('system:view')) {
      loadData();
    }
  }, [can, filters]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [itemsResult, statsResult] = await Promise.all([
        getRecycleBin(filters),
        getRecycleBinStats(),
      ]);

      if (itemsResult.success && itemsResult.items) {
        setItems(itemsResult.items);
        if (itemsResult.pagination) {
          setPagination(itemsResult.pagination);
        }
      }

      if (statsResult.success && statsResult.stats) {
        setStats(statsResult.stats);
      }
    } catch (error) {
      console.error('Failed to load recycle bin:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreDialog.item) return;

    setIsProcessing(true);
    try {
      const result = await restoreRecycleBinItem(restoreDialog.item._id);
      if (result.success) {
        setRestoreDialog({ open: false, item: null });
        loadData();
        setSelectedItems(new Set());
      } else {
        alert(`恢复失败: ${result.error}`);
      }
    } catch (error) {
      alert(`恢复失败: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurge = async () => {
    if (purgeDialog.isBatch) {
      // Batch purge
      setIsProcessing(true);
      try {
        const result = await batchPurgeRecycleBin(Array.from(selectedItems));
        if (result.success) {
          setPurgeDialog({ open: false, item: null, isBatch: false });
          loadData();
          setSelectedItems(new Set());
        } else {
          alert(`批量删除失败: ${result.error}`);
        }
      } catch (error) {
        alert(`批量删除失败: ${error}`);
      } finally {
        setIsProcessing(false);
      }
    } else if (purgeDialog.item) {
      // Single purge
      setIsProcessing(true);
      try {
        const result = await purgeRecycleBinItem(purgeDialog.item._id);
        if (result.success) {
          setPurgeDialog({ open: false, item: null, isBatch: false });
          loadData();
        } else {
          alert(`永久删除失败: ${result.error}`);
        }
      } catch (error) {
        alert(`永久删除失败: ${error}`);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleBatchRestore = async () => {
    if (selectedItems.size === 0) return;

    setIsProcessing(true);
    try {
      const result = await batchRestoreRecycleBin(Array.from(selectedItems));
      if (result.success) {
        loadData();
        setSelectedItems(new Set());
        if (result.failed && result.failed > 0) {
          alert(`部分恢复失败: ${result.failed} 项`);
        }
      } else {
        alert(`批量恢复失败: ${result.error}`);
      }
    } catch (error) {
      alert(`批量恢复失败: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedItems(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((i) => i._id)));
    }
  };

  const getItemTypeLabel = (type: string) => {
    return type === 'questionnaire_answer' ? '问卷回答' : '会话记忆';
  };

  const getItemTypeIcon = (type: string) => {
    return type === 'questionnaire_answer' ? (
      <FileText className="w-4 h-4" />
    ) : (
      <MessageSquare className="w-4 h-4" />
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('zh-CN');
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    const days = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return days;
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
          <h1 className="text-2xl font-bold text-gray-900">回收站</h1>
          <p className="text-gray-600">管理已删除的数据，30天后自动清除</p>
        </div>
        <Button onClick={() => loadData()} disabled={isLoading}>
          刷新
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500">待删除</p>
              <p className="text-2xl font-bold text-orange-600">
                {stats.pendingPurge}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500">已恢复</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.restored}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500">已清除</p>
              <p className="text-2xl font-bold text-gray-600">{stats.purged}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500">即将过期</p>
              <p className="text-2xl font-bold text-red-600">
                {stats.expiringSoon || 0}
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
              <Label>类型</Label>
              <Select
                value={filters.itemType || 'all'}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    itemType: value === 'all' ? undefined : value,
                    page: 1,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="questionnaire_answer">问卷回答</SelectItem>
                  <SelectItem value="conversation_memory">会话记忆</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={filters.status || 'pending_purge'}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value, page: 1 })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_purge">待删除</SelectItem>
                  <SelectItem value="restored">已恢复</SelectItem>
                  <SelectItem value="purged">已清除</SelectItem>
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
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch Actions */}
      {selectedItems.size > 0 && filters.status === 'pending_purge' && (
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="flex items-center justify-between py-4">
            <span className="text-orange-700">
              已选择 {selectedItems.size} 项
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBatchRestore}
                disabled={isProcessing}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                批量恢复
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  setPurgeDialog({ open: true, item: null, isBatch: true })
                }
                disabled={isProcessing}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                批量永久删除
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            回收站项目 ({pagination.total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Trash2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>回收站为空</p>
            </div>
          ) : (
            <>
              {/* Select All */}
              {filters.status === 'pending_purge' && (
                <div className="flex items-center gap-2 pb-4 border-b">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === items.length && items.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-600">全选</span>
                </div>
              )}

              <div className="divide-y">
                {items.map((item) => {
                  const daysLeft = getDaysUntilExpiry(item.expiresAt);
                  const isExpiring = daysLeft <= 7 && daysLeft > 0;

                  return (
                    <div
                      key={item._id}
                      className="py-4 flex items-start gap-4"
                    >
                      {filters.status === 'pending_purge' && (
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item._id)}
                          onChange={() => toggleSelect(item._id)}
                          className="w-4 h-4 mt-1"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="flex items-center gap-1">
                            {getItemTypeIcon(item.itemType)}
                            {getItemTypeLabel(item.itemType)}
                          </Badge>
                          {item.status === 'pending_purge' && (
                            <Badge
                              variant={isExpiring ? 'destructive' : 'secondary'}
                            >
                              {daysLeft > 0 ? `${daysLeft}天后过期` : '已过期'}
                            </Badge>
                          )}
                          {item.status === 'restored' && (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              已恢复
                            </Badge>
                          )}
                          {item.status === 'purged' && (
                            <Badge className="bg-gray-100 text-gray-700">
                              <XCircle className="w-3 h-3 mr-1" />
                              已清除
                            </Badge>
                          )}
                        </div>

                        <div className="mt-2 text-sm text-gray-600">
                          <div className="flex items-center gap-4 flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              所属用户: {item.userId?.name || '未知'}
                            </span>
                            {item.partnerId && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                对方: {item.partnerId?.name || '未知'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              删除时间: {formatDate(item.deletedAt)}
                            </span>
                            <span>删除者: {item.deletedBy?.name || '未知'}</span>
                          </div>
                        </div>
                      </div>

                      {item.status === 'pending_purge' && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRestoreDialog({ open: true, item })}
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            恢复
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              setPurgeDialog({ open: true, item, isBatch: false })
                            }
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            永久删除
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
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

      {/* Restore Dialog */}
      <Dialog
        open={restoreDialog.open}
        onOpenChange={(open) => setRestoreDialog({ open, item: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认恢复</DialogTitle>
            <DialogDescription>
              确定要恢复此项目吗？恢复后数据将回到原来的位置。
            </DialogDescription>
          </DialogHeader>
          {restoreDialog.item && (
            <div className="py-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {getItemTypeLabel(restoreDialog.item.itemType)}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  所属用户: {restoreDialog.item.userId?.name}
                </p>
                {restoreDialog.item.partnerId && (
                  <p className="text-sm text-gray-600">
                    对方用户: {restoreDialog.item.partnerId?.name}
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreDialog({ open: false, item: null })}
            >
              取消
            </Button>
            <Button onClick={handleRestore} disabled={isProcessing}>
              {isProcessing ? '恢复中...' : '确认恢复'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purge Dialog */}
      <Dialog
        open={purgeDialog.open}
        onOpenChange={(open) =>
          setPurgeDialog({ open, item: null, isBatch: false })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">
              <AlertCircle className="w-5 h-5 inline mr-2" />
              确认永久删除
            </DialogTitle>
            <DialogDescription>
              此操作不可撤销！数据将被永久删除，无法恢复。
            </DialogDescription>
          </DialogHeader>
          {purgeDialog.isBatch ? (
            <div className="py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700">
                  即将永久删除 {selectedItems.size} 个项目
                </p>
              </div>
            </div>
          ) : purgeDialog.item ? (
            <div className="py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {getItemTypeLabel(purgeDialog.item.itemType)}
                  </Badge>
                </div>
                <p className="text-sm text-red-700">
                  所属用户: {purgeDialog.item.userId?.name}
                </p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setPurgeDialog({ open: false, item: null, isBatch: false })
              }
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handlePurge}
              disabled={isProcessing}
            >
              {isProcessing ? '删除中...' : '确认永久删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
