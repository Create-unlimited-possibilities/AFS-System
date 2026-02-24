'use client'

import { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, Database, Download, RotateCcw, FileText, Calendar, Tag, AlertCircle, Filter, Search, X, ChevronDown, ChevronUp, MessageCircle, User, Bot, Sparkles } from 'lucide-react';
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
import { getUserMemoryData, rebuildVectorIndex, exportUserMemories, type UserMemory, type VectorIndexStatus, type AdminUser } from '@/lib/admin-api';
import { usePermissionStore } from '@/stores/permission';

interface MemoryFilters {
  category: string;
  sourceType: string;
  indexed: string;
  search: string;
}

interface MemoryDetailProps {
  userId: string;
  user: AdminUser | null;
  onBack: () => void;
  onRefresh: () => void;
}

export function MemoryDetail({ userId, user, onBack, onRefresh }: MemoryDetailProps) {
  const { can } = usePermissionStore();
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [vectorStatus, setVectorStatus] = useState<VectorIndexStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  const [filters, setFilters] = useState<MemoryFilters>({
    category: 'all',
    sourceType: 'all',
    indexed: 'all',
    search: '',
  });

  useEffect(() => {
    loadMemoryData();
  }, [userId]);

  const loadMemoryData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getUserMemoryData(userId);
      if (result.success) {
        setMemories(result.memories || []);
        setVectorStatus(result.vectorIndex || null);
      } else {
        setError(result.error || 'Failed to load memory data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Apply filters to memories
  const filteredMemories = useMemo(() => {
    let filtered = [...memories];

    if (filters.category !== 'all') {
      filtered = filtered.filter((m) => m.category === filters.category);
    }

    if (filters.sourceType !== 'all') {
      filtered = filtered.filter((m) => m.sourceType === filters.sourceType);
    }

    if (filters.indexed !== 'all') {
      const isIndexed = filters.indexed === 'true';
      filtered = filtered.filter((m) => {
        // For conversation memories, check the indexed field
        if (m.sourceType === 'conversation') {
          return m.indexed === isIndexed;
        }
        // For other types, assume they're indexed if vector status exists
        return vectorStatus?.exists === isIndexed;
      });
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.content.toLowerCase().includes(searchLower) ||
          (m.tags && m.tags.some((tag) => tag.toLowerCase().includes(searchLower)))
      );
    }

    return filtered;
  }, [memories, filters, vectorStatus?.exists]);

  // Calculate stats
  const stats = useMemo(() => ({
    total: memories.length,
    filtered: filteredMemories.length,
    byCategory: {
      self: memories.filter((m) => m.category === 'self').length,
      family: memories.filter((m) => m.category === 'family').length,
      friend: memories.filter((m) => m.category === 'friend').length,
      conversation: memories.filter((m) => m.category === 'conversation').length,
    },
    bySourceType: {
      answer: memories.filter((m) => m.sourceType === 'answer').length,
      conversation: memories.filter((m) => m.sourceType === 'conversation').length,
      manual: memories.filter((m) => m.sourceType === 'manual').length,
      imported: memories.filter((m) => m.sourceType === 'imported').length,
    },
    indexed: memories.filter((m) => m.sourceType === 'conversation' ? m.indexed : vectorStatus?.exists).length,
    notIndexed: memories.filter((m) => m.sourceType === 'conversation' ? !m.indexed : !vectorStatus?.exists).length,
  }), [memories, filteredMemories, vectorStatus?.exists]);

  const clearFilters = () => {
    setFilters({
      category: 'all',
      sourceType: 'all',
      indexed: 'all',
      search: '',
    });
  };

  const hasActiveFilters = filters.category !== 'all' || filters.sourceType !== 'all' || filters.indexed !== 'all' || filters.search !== '';

  const handleRebuildIndex = async () => {
    if (!can('memory:manage')) {
      alert('您没有权限执行此操作');
      return;
    }

    if (!confirm('确定要重建向量索引吗？这可能需要一些时间。')) {
      return;
    }

    setIsRebuilding(true);
    try {
      const result = await rebuildVectorIndex(userId);
      if (result.success) {
        alert('向量索引重建成功！');
        onRefresh();
      } else {
        alert(`重建失败: ${result.error}`);
      }
    } catch (err) {
      alert(`重建失败: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsRebuilding(false);
    }
  };

  const handleExport = async () => {
    if (!can('memory:view')) {
      alert('您没有权限执行此操作');
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportUserMemories(userId);
      if (result.success && result.data) {
        // Create a JSON file download
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `memories_${user?.uniqueCode || userId}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert(`导出失败: ${result.error}`);
      }
    } catch (err) {
      alert(`导出失败: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'self': return '自我';
      case 'family': return '家庭';
      case 'friend': return '朋友';
      case 'conversation': return '对话';
      default: return category;
    }
  };

  const getCategoryBadgeVariant = (category: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (category) {
      case 'self': return 'default';
      case 'family': return 'secondary';
      case 'friend': return 'outline';
      case 'conversation': return 'default';
      default: return 'outline';
    }
  };

  const getSourceTypeLabel = (sourceType: string) => {
    switch (sourceType) {
      case 'answer': return '问卷回答';
      case 'manual': return '手动添加';
      case 'imported': return '导入';
      case 'conversation': return '会话记忆';
      default: return sourceType;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user?.name || '用户'}的记忆</h2>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting || memories.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? '导出中...' : '导出记忆数据'}
          </Button>
          <Button
            onClick={handleRebuildIndex}
            disabled={isRebuilding || (vectorStatus?.memoryCount === 0)}
          >
            <RotateCcw className={`w-4 h-4 mr-2 ${isRebuilding ? 'animate-spin' : ''}`} />
            {isRebuilding ? '重建中...' : '重建向量索引'}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Vector Index Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            ChromaDB 向量索引状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vectorStatus ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">索引状态</p>
                <Badge variant={vectorStatus.exists ? "default" : "outline"} className="mt-1">
                  {vectorStatus.exists ? '已创建' : '未创建'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">向量数量</p>
                <p className="text-lg font-semibold mt-1">{vectorStatus.memoryCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">角色卡状态</p>
                <Badge variant={vectorStatus.hasRoleCard ? "default" : "outline"} className="mt-1">
                  {vectorStatus.hasRoleCard ? '已生成' : '未生成'}
                </Badge>
              </div>
              {vectorStatus.collectionName && (
                <div className="sm:col-span-3">
                  <p className="text-sm text-gray-500">集合名称</p>
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
                    {vectorStatus.collectionName}
                  </code>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">无法获取向量索引状态</p>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">总记忆数</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">自我</p>
            <p className="text-2xl font-bold text-blue-600">{stats.byCategory.self}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">家庭</p>
            <p className="text-2xl font-bold text-purple-600">{stats.byCategory.family}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">朋友</p>
            <p className="text-2xl font-bold text-green-600">{stats.byCategory.friend}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">对话</p>
            <p className="text-2xl font-bold text-orange-600">{stats.byCategory.conversation}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">筛选结果</p>
            <p className="text-2xl font-bold text-gray-600">{stats.filtered}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              筛选条件
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />
                  清除筛选
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? '收起' : '展开'}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>搜索</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="搜索内容或标签..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>类别</Label>
                <Select
                  value={filters.category}
                  onValueChange={(value) => setFilters({ ...filters, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类别</SelectItem>
                    <SelectItem value="self">自我</SelectItem>
                    <SelectItem value="family">家庭</SelectItem>
                    <SelectItem value="friend">朋友</SelectItem>
                    <SelectItem value="conversation">对话</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>来源</Label>
                <Select
                  value={filters.sourceType}
                  onValueChange={(value) => setFilters({ ...filters, sourceType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部来源</SelectItem>
                    <SelectItem value="answer">问卷回答</SelectItem>
                    <SelectItem value="conversation">会话记忆</SelectItem>
                    <SelectItem value="manual">手动添加</SelectItem>
                    <SelectItem value="imported">导入</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>索引状态</Label>
                <Select
                  value={filters.indexed}
                  onValueChange={(value) => setFilters({ ...filters, indexed: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="true">已索引</SelectItem>
                    <SelectItem value="false">未索引</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Memory List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            记忆内容 ({filteredMemories.length} 条)
          </CardTitle>
          <CardDescription>
            {hasActiveFilters
              ? `从 ${memories.length} 条记忆中筛选出 ${filteredMemories.length} 条`
              : '用户的所有记忆数据'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredMemories.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>{hasActiveFilters ? '没有符合筛选条件的记忆' : '暂无记忆数据'}</p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  清除筛选条件
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMemories.map((memory) => (
                <Card key={memory._id} className={`border-l-4 ${
                  memory.sourceType === 'conversation' ? 'border-l-orange-500' :
                  memory.category === 'self' ? 'border-l-blue-500' :
                  memory.category === 'family' ? 'border-l-purple-500' :
                  memory.category === 'friend' ? 'border-l-green-500' :
                  'border-l-gray-500'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getCategoryBadgeVariant(memory.category)}>
                          {getCategoryLabel(memory.category)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {getSourceTypeLabel(memory.sourceType)}
                        </Badge>
                        {memory.sourceType === 'conversation' && (
                          <Badge
                            variant={memory.indexed ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {memory.indexed ? '已索引' : '待索引'}
                          </Badge>
                        )}
                        {memory.messageCount && memory.messageCount > 0 && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" />
                            {memory.messageCount} 条消息
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {new Date(memory.createdAt).toLocaleDateString('zh-CN')}
                      </div>
                    </div>

                    {/* Conversation messages in chat format */}
                    {memory.sourceType === 'conversation' && memory.rawMessages && memory.rawMessages.length > 0 ? (
                      <ConversationMessageDisplay
                        rawMessages={memory.rawMessages}
                        summary={memory.summary}
                        keyTopics={memory.keyTopics}
                        facts={memory.facts}
                      />
                    ) : (
                      /* Plain content for non-conversation memories */
                      <p className="text-gray-800 whitespace-pre-wrap">{memory.content}</p>
                    )}

                    {/* Tags */}
                    {memory.tags && memory.tags.length > 0 && (
                      <div className="flex items-center gap-2 mt-3">
                        <Tag className="w-3 h-3 text-gray-400" />
                        <div className="flex flex-wrap gap-1">
                          {memory.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {memory.partnerId && (
                      <div className="mt-2 text-xs text-gray-400">
                        对话对象ID: {memory.partnerId}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Component to display conversation messages in chat bubble format
 */
interface ConversationMessageDisplayProps {
  rawMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    isOwner?: boolean;
  }>;
  summary?: string | null;
  keyTopics?: string[];
  facts?: string[];
}

function ConversationMessageDisplay({
  rawMessages,
  summary,
  keyTopics,
  facts,
}: ConversationMessageDisplayProps) {
  const [showSummary, setShowSummary] = useState(false);
  const [showFacts, setShowFacts] = useState(false);

  return (
    <div className="space-y-3">
      {/* Chat messages */}
      <div className="space-y-2 max-h-96 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
        {rawMessages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex items-end gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                {msg.role === 'user' ? (
                  <User className="w-3 h-3" />
                ) : (
                  <Bot className="w-3 h-3" />
                )}
              </div>

              {/* Message bubble */}
              <div className={`rounded-2xl px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Key Topics as tags */}
      {keyTopics && keyTopics.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="w-3 h-3 text-orange-500" />
          <span className="text-xs text-gray-500">关键话题:</span>
          {keyTopics.map((topic, index) => (
            <Badge key={index} variant="outline" className="text-xs border-orange-300 text-orange-600">
              {topic}
            </Badge>
          ))}
        </div>
      )}

      {/* AI Summary - Collapsible */}
      {summary && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              AI 摘要
            </span>
            {showSummary ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>
          {showSummary && (
            <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900">
              {summary}
            </div>
          )}
        </div>
      )}

      {/* Facts - Collapsible */}
      {facts && facts.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowFacts(!showFacts)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              提取的事实 ({facts.length})
            </span>
            {showFacts ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>
          {showFacts && (
            <div className="px-3 py-2 bg-white dark:bg-gray-900">
              <ul className="space-y-1">
                {facts.map((fact, index) => (
                  <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
