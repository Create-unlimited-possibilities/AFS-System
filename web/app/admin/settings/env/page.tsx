'use client'

import { useEffect, useState } from 'react';
import { usePermissionStore } from '@/stores/permission';
import { getEnvVars, updateEnvVar, type EnvVar } from '@/lib/admin-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Save, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';

export default function EnvVarsPage() {
  const { can } = usePermissionStore();

  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingVar, setEditingVar] = useState<{ key: string; value: string } | null>(null);
  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!can('system:view')) return;
    loadEnvVars();
  }, [can]);

  const loadEnvVars = async () => {
    setIsLoading(true);
    try {
      const result = await getEnvVars();
      if (result.success && result.vars) {
        setEnvVars(result.vars);
      }
    } catch (error) {
      showMessage('error', '加载环境变量失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (envVar: EnvVar) => {
    if (!envVar.isEditable) return;
    setEditingVar({ key: envVar.key, value: envVar.isSecret ? '' : envVar.value });
  };

  const handleSave = async () => {
    if (!editingVar) return;
    setIsSaving(true);
    try {
      const result = await updateEnvVar(editingVar.key, editingVar.value);
      if (result.success) {
        showMessage('success', '环境变量已更新');
        setEditingVar(null);
        await loadEnvVars();
      } else {
        showMessage('error', result.error || '更新失败');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  if (!can('system:view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">您没有权限查看系统设置</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">环境变量管理</h1>
          <p className="text-gray-600">查看和编辑系统环境变量</p>
        </div>
        <Button variant="outline" onClick={loadEnvVars}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* Message */}
      {message && (
        <div className={`px-4 py-3 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>重要提示</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <p>• 敏感信息（密码、密钥等）会被隐藏显示</p>
          <p>• 只有标记为"可编辑"的变量才能修改</p>
          <p>• 修改某些变量可能需要重启服务才能生效</p>
        </CardContent>
      </Card>

      {/* Env Vars List */}
      <Card>
        <CardHeader>
          <CardTitle>环境变量列表</CardTitle>
          <CardDescription>
            共 {envVars.length} 个环境变量
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {envVars.map((envVar) => (
                <div
                  key={envVar.key}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="text-sm font-medium text-gray-900">
                          {envVar.key}
                        </code>
                        {envVar.isSecret && (
                          <Badge variant="outline" className="text-xs">
                            敏感
                          </Badge>
                        )}
                        {!envVar.isEditable && (
                          <Badge variant="secondary" className="text-xs">
                            只读
                          </Badge>
                        )}
                      </div>
                      {envVar.description && (
                        <p className="text-xs text-gray-500 mb-2">{envVar.description}</p>
                      )}
                      {editingVar?.key === envVar.key ? (
                        <Input
                          type={envVar.isSecret ? 'password' : 'text'}
                          value={editingVar.value}
                          onChange={(e) => setEditingVar({ ...editingVar, value: e.target.value })}
                          placeholder={envVar.isSecret ? '输入新值（留空保持不变）' : '输入新值'}
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {envVar.isSecret && !showSecrets.has(envVar.key)
                              ? '••••••••'
                              : envVar.value}
                          </code>
                          {envVar.isSecret && (
                            <button
                              onClick={() => toggleSecretVisibility(envVar.key)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {showSecrets.has(envVar.key) ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingVar?.key === envVar.key ? (
                        <>
                          <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-gradient-to-r from-orange-500 to-orange-600"
                          >
                            {isSaving ? '保存中...' : '保存'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingVar(null)}
                            disabled={isSaving}
                          >
                            取消
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(envVar)}
                          disabled={!envVar.isEditable}
                        >
                          编辑
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
