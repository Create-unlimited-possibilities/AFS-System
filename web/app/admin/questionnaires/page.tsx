'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissionStore } from '@/stores/permission';
import {
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestion,
  toggleQuestionStatus,
  batchImportQuestions,
  exportQuestions,
  type AdminQuestion,
  type QuestionFormData,
  type QuestionFilters,
  type QuestionRole,
  type QuestionLayer,
} from '@/lib/admin-api';
import { QuestionForm } from './components/QuestionForm';
import { QuestionList } from './components/QuestionList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Filter,
  Download,
  Upload,
  RefreshCw,
  Search,
} from 'lucide-react';

export default function QuestionnairesPage() {
  const router = useRouter();
  const { can } = usePermissionStore();

  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<AdminQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [filters, setFilters] = useState<QuestionFilters>({
    role: 'all',
    layer: 'all',
    active: null,
    search: '',
  });

  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AdminQuestion | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importData, setImportData] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    failed: number;
    errors: Array<{ question: string; error: string }>;
  } | null>(null);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!can('questionnaire:view')) {
      return;
    }
    loadQuestions();
  }, [can]);

  useEffect(() => {
    applyFilters();
  }, [questions, filters]);

  const loadQuestions = async () => {
    setIsLoading(true);
    try {
      const result = await getQuestions();
      if (result.success && result.questions) {
        setQuestions(result.questions);
      }
    } catch (error) {
      setErrorMessage('加载问题失败');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...questions];

    if (filters.role && filters.role !== 'all') {
      filtered = filtered.filter((q) => q.role === filters.role);
    }

    if (filters.layer && filters.layer !== 'all') {
      filtered = filtered.filter((q) => q.layer === filters.layer);
    }

    if (filters.active !== null) {
      filtered = filtered.filter((q) => q.active === filters.active);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (q) =>
          q.question.toLowerCase().includes(searchLower) ||
          (q.placeholder && q.placeholder.toLowerCase().includes(searchLower))
      );
    }

    filtered.sort((a, b) => a.order - b.order);
    setFilteredQuestions(filtered);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadQuestions();
  };

  const handleCreate = () => {
    setEditingQuestion(null);
    setShowForm(true);
  };

  const handleEdit = (question: AdminQuestion) => {
    setEditingQuestion(question);
    setShowForm(true);
  };

  const handleFormSubmit = async (data: QuestionFormData) => {
    setIsSaving(true);
    setErrorMessage('');
    try {
      let result;
      if (editingQuestion) {
        result = await updateQuestion(editingQuestion._id, data);
      } else {
        result = await createQuestion(data);
      }

      if (result.success) {
        setShowForm(false);
        setEditingQuestion(null);
        setSuccessMessage(editingQuestion ? '问题已更新' : '问题已创建');
        setTimeout(() => setSuccessMessage(''), 3000);
        await loadQuestions();
      } else {
        setErrorMessage(result.error || '保存失败');
      }
    } finally {
      setIsSaving(false);
    }
    return { success: true };
  };

  const handleDelete = async (questionId: string) => {
    const result = await deleteQuestion(questionId);
    if (result.success) {
      setSuccessMessage('问题已删除');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadQuestions();
    } else {
      setErrorMessage(result.error || '删除失败');
    }
  };

  const handleToggleStatus = async (questionId: string, active: boolean) => {
    const result = await toggleQuestionStatus(questionId, active);
    if (result.success) {
      setSuccessMessage(active ? '问题已启用' : '问题已禁用');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadQuestions();
    } else {
      setErrorMessage(result.error || '操作失败');
    }
  };

  const handleMoveUp = async (questionId: string) => {
    const index = filteredQuestions.findIndex((q) => q._id === questionId);
    if (index > 0) {
      const targetOrder = filteredQuestions[index - 1].order;
      const result = await reorderQuestion(questionId, targetOrder);
      if (result.success) {
        await loadQuestions();
      }
    }
  };

  const handleMoveDown = async (questionId: string) => {
    const index = filteredQuestions.findIndex((q) => q._id === questionId);
    if (index < filteredQuestions.length - 1) {
      const targetOrder = filteredQuestions[index + 1].order;
      const result = await reorderQuestion(questionId, targetOrder);
      if (result.success) {
        await loadQuestions();
      }
    }
  };

  const handleExport = async () => {
    try {
      const result = await exportQuestions(filters);
      if (result.success && result.questions) {
        const dataStr = JSON.stringify(result.questions, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `questions-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setSuccessMessage('问题已导出');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      setErrorMessage('导出失败');
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    setImportResult(null);
    try {
      const data = JSON.parse(importData);
      if (!Array.isArray(data)) {
        setErrorMessage('导入数据格式错误：必须是数组');
        return;
      }

      const result = await batchImportQuestions(data);
      if (result.success) {
        setImportResult({
          imported: result.imported || 0,
          failed: result.failed || 0,
          errors: result.errors || [],
        });
        if (result.imported && result.imported > 0) {
          await loadQuestions();
        }
      } else {
        setErrorMessage(result.error || '导入失败');
      }
    } catch (error) {
      setErrorMessage('JSON 格式错误');
    } finally {
      setIsImporting(false);
    }
  };

  if (!can('questionnaire:view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">您没有权限查看问卷管理</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">问卷管理</h1>
          <p className="text-gray-600">管理系统中的所有问题</p>
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
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
          {can('questionnaire:create') && (
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="w-4 h-4 mr-2" />
              导入
            </Button>
          )}
          {can('questionnaire:create') && (
            <Button
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              onClick={handleCreate}
            >
              <Plus className="w-4 h-4 mr-2" />
              添加问题
            </Button>
          )}
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总问题数</CardDescription>
            <CardTitle className="text-3xl">{questions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>启用中</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {questions.filter((q) => q.active).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>基础层</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {questions.filter((q) => q.layer === 'basic').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>情感层</CardDescription>
            <CardTitle className="text-3xl text-purple-600">
              {questions.filter((q) => q.layer === 'emotional').length}
            </CardTitle>
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
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>搜索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="搜索问题..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>角色</Label>
              <Select
                value={filters.role}
                onValueChange={(value: QuestionRole | 'all') =>
                  setFilters({ ...filters, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="elder">老人</SelectItem>
                  <SelectItem value="family">家人</SelectItem>
                  <SelectItem value="friend">朋友</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>层级</Label>
              <Select
                value={filters.layer}
                onValueChange={(value: QuestionLayer | 'all') =>
                  setFilters({ ...filters, layer: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="basic">基础层</SelectItem>
                  <SelectItem value="emotional">情感层</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={filters.active === null ? 'all' : String(filters.active)}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    active: value === 'all' ? null : value === 'true',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="true">启用</SelectItem>
                  <SelectItem value="false">禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Question Form (Modal) */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <QuestionForm
            initialData={editingQuestion || undefined}
            onSubmit={handleFormSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingQuestion(null);
            }}
            isLoading={isSaving}
            submitLabel={editingQuestion ? '更新问题' : '创建问题'}
          />
        </div>
      )}

      {/* Questions List */}
      <Card>
        <CardHeader>
          <CardTitle>问题列表</CardTitle>
          <CardDescription>
            显示 {filteredQuestions.length} 个问题
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuestionList
            questions={filteredQuestions}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleStatus={handleToggleStatus}
            onMoveUp={can('questionnaire:update') ? handleMoveUp : undefined}
            onMoveDown={can('questionnaire:update') ? handleMoveDown : undefined}
          />
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>批量导入问题</DialogTitle>
            <DialogDescription>
              粘贴JSON格式的问题数据，每个问题包含role、layer、question等字段
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>JSON 数据</Label>
              <Textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder='[{"role":"elder","layer":"basic","question":"您叫什么名字？","type":"textarea","active":true}]'
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            {importResult && (
              <div className={`p-4 rounded-lg ${
                importResult.imported > 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <p className="font-medium">
                  导入完成：{importResult.imported} 个成功，{importResult.failed} 个失败
                </p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 text-sm">
                    <p className="font-medium">错误详情：</p>
                    <ul className="list-disc list-inside">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err.question}: {err.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleImport}
              disabled={isImporting || !importData.trim()}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              {isImporting ? '导入中...' : '导入'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
