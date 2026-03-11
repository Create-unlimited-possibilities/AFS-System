'use client'

import { useEffect, useState } from 'react';
import { usePermissionStore } from '@/stores/permission';
import {
  getZiweiBooks,
  getZiweiBooksSources,
  type ZiweiBookChunk,
  type ZiweiBookSource,
} from '@/lib/admin-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  BookOpen,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Database,
  RefreshCw,
  Filter,
} from 'lucide-react';

export default function KnowledgePage() {
  const { can } = usePermissionStore();

  const [chunks, setChunks] = useState<ZiweiBookChunk[]>([]);
  const [sources, setSources] = useState<ZiweiBookSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalChunks, setTotalChunks] = useState(0);
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (can('memory:view')) {
      loadSources();
    }
  }, [can]);

  useEffect(() => {
    if (can('memory:view')) {
      loadChunks();
    }
  }, [can, page, selectedSource]);

  const loadSources = async () => {
    try {
      const result = await getZiweiBooksSources();
      if (result.success && result.sources) {
        setSources(result.sources);
        setTotalChunks(result.totalChunks || 0);
      }
    } catch (error) {
      console.error('Failed to load sources:', error);
    }
  };

  const loadChunks = async () => {
    setIsLoading(true);
    try {
      const result = await getZiweiBooks({
        page,
        limit: 10,
        search: searchQuery || undefined,
        source: selectedSource || undefined,
      });
      if (result.success) {
        setChunks(result.chunks || []);
        setTotalPages(result.pagination?.totalPages || 1);
        if (result.stats?.totalChunks) {
          setTotalChunks(result.stats.totalChunks);
        }
      }
    } catch (error) {
      console.error('Failed to load chunks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadChunks();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const toggleChunk = (id: string) => {
    setExpandedChunks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleRefresh = () => {
    loadSources();
    loadChunks();
  };

  if (!can('memory:view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">您没有权限查看知识库管理</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">算命书籍知识库</h1>
          <p className="text-gray-600">查看和管理紫微斗数相关书籍的知识片段</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              总知识片段
            </CardDescription>
            <CardTitle className="text-3xl">{totalChunks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              书籍来源
            </CardDescription>
            <CardTitle className="text-3xl">{sources.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              当前页
            </CardDescription>
            <CardTitle className="text-3xl">{page} / {totalPages}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="搜索知识片段..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-64">
              <select
                value={selectedSource}
                onChange={(e) => {
                  setSelectedSource(e.target.value);
                  setPage(1);
                }}
                className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">全部来源</option>
                {sources.map((source) => (
                  <option key={source.name} value={source.name}>
                    {source.name} ({source.count})
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleSearch} className="bg-orange-500 hover:bg-orange-600">
              搜索
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Source Tags */}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sources.map((source) => (
            <Badge
              key={source.name}
              variant={selectedSource === source.name ? 'default' : 'outline'}
              className={`cursor-pointer ${
                selectedSource === source.name
                  ? 'bg-orange-500 hover:bg-orange-600'
                  : 'hover:bg-gray-100'
              }`}
              onClick={() => {
                setSelectedSource(selectedSource === source.name ? '' : source.name);
                setPage(1);
              }}
            >
              {source.name} ({source.count})
            </Badge>
          ))}
        </div>
      )}

      {/* Content List */}
      <Card>
        <CardHeader>
          <CardTitle>知识片段列表</CardTitle>
          <CardDescription>
            共 {totalChunks} 个知识片段，点击展开查看详细内容
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
              <span className="ml-2 text-gray-500">加载中...</span>
            </div>
          ) : chunks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery || selectedSource
                ? '没有找到匹配的知识片段'
                : '暂无知识片段数据，请先运行迁移脚本导入书籍'}
            </div>
          ) : (
            <div className="space-y-3">
              {chunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="border rounded-lg overflow-hidden hover:border-orange-300 transition-colors"
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer bg-gray-50 hover:bg-gray-100"
                    onClick={() => toggleChunk(chunk.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="w-5 h-5 text-orange-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {chunk.content.substring(0, 80)}...
                        </p>
                        <p className="text-sm text-gray-500">
                          来源: {chunk.source} · 片段 #{chunk.chunk_id}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-2 flex-shrink-0">
                      {expandedChunks.has(chunk.id) ? '收起' : '展开'}
                    </Badge>
                  </div>
                  {expandedChunks.has(chunk.id) && (
                    <div className="p-4 bg-white border-t">
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {chunk.content}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-gray-500">
                第 {page} 页，共 {totalPages} 页
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  下一页
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}