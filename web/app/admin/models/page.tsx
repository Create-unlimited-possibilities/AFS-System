'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  RefreshCw, Trash2, FileText, Box, Server, Cpu, Brain, Settings2,
  CheckCircle, XCircle, Loader2, Plus, Edit, Save, X, Eye, EyeOff, Maximize2
} from 'lucide-react'
import { usePermissionStore } from '@/stores/permission'
import { adminApiRequest, getEnvVars, updateEnvVar } from '@/lib/admin-api'

interface OllamaModel {
  name: string
  size: number
  modified: string
  details?: {
    format?: string
    family?: string
    parameter_size?: string
  }
}

interface ModelStatus {
  ollama: {
    baseUrl: string
    models: OllamaModel[]
  }
  ggufFiles: string[]
  modelfiles: string[]
  ziweiModel: {
    registered: boolean
    name: string
    size?: number
  }
  envConfig: {
    ZIWEI_MODEL: string
    ZIWEI_TIMEOUT: string
    OLLAMA_BASE_URL: string
  }
}

interface LLMConfig {
  LLM_BACKEND: string
  LLM_MODEL: string
  LLM_TIMEOUT: string
  LLM_TEMPERATURE: string
  OLLAMA_BASE_URL: string
  OLLAMA_MODEL: string
  OLLAMA_TIMEOUT: string
  DEEPSEEK_API_KEY: string
  DEEPSEEK_BASE_URL: string
  DEEPSEEK_MODEL: string
  ZIWEI_MODEL: string
  ZIWEI_TIMEOUT: string
}

// DeepSeek 可用模型列表
const DEEPSEEK_MODELS = [
  { value: 'deepseek-chat', label: 'DeepSeek Chat (通用对话)' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (推理增强)' },
]

export default function ModelManagementPage() {
  const { can } = usePermissionStore()
  const [status, setStatus] = useState<ModelStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedModelfile, setSelectedModelfile] = useState<string | null>(null)
  const [modelfileContent, setModelfileContent] = useState('')
  const [editingContent, setEditingContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newModelName, setNewModelName] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // LLM Config state
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    LLM_BACKEND: 'deepseek',
    LLM_MODEL: '',
    LLM_TIMEOUT: '60000',
    LLM_TEMPERATURE: '0.7',
    OLLAMA_BASE_URL: '',
    OLLAMA_MODEL: '',
    OLLAMA_TIMEOUT: '30000',
    DEEPSEEK_API_KEY: '',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.com/v1',
    DEEPSEEK_MODEL: 'deepseek-reasoner',
    ZIWEI_MODEL: 'ziwei-8b',
    ZIWEI_TIMEOUT: '120000'
  })
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set())
  const [savingConfig, setSavingConfig] = useState(false)

  const loadStatus = async () => {
    setLoading(true)
    try {
      const data = await adminApiRequest<{ success: boolean; status: ModelStatus }>('/admin/models/status')
      if (data.success) {
        setStatus(data.status)
      }
    } catch (error) {
      console.error('Failed to load model status:', error)
      showMessage('error', '加载模型状态失败')
    } finally {
      setLoading(false)
    }
  }

  const loadLLMConfig = async () => {
    try {
      const result = await getEnvVars()
      if (result.success && result.vars) {
        const config: Partial<LLMConfig> = {}
        result.vars.forEach(v => {
          if (v.key in llmConfig) {
            config[v.key as keyof LLMConfig] = v.value
          }
        })
        setLlmConfig(prev => ({ ...prev, ...config }))
      }
    } catch (error) {
      console.error('Failed to load LLM config:', error)
    }
  }

  useEffect(() => {
    if (can('system:view')) {
      loadStatus()
      loadLLMConfig()
    }
  }, [can])

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleLoadModelfile = async (filename: string) => {
    try {
      const data = await adminApiRequest<{ success: boolean; content?: string; error?: string }>(
        `/admin/models/modelfiles/${encodeURIComponent(filename)}`
      )
      if (data.success && data.content) {
        setSelectedModelfile(filename)
        setModelfileContent(data.content)
        setEditingContent(data.content)
        setIsEditing(false)
        setDialogOpen(true) // 打开弹窗
      } else {
        showMessage('error', data.error || '加载 Modelfile 失败')
      }
    } catch (error) {
      showMessage('error', '加载 Modelfile 失败')
    }
  }

  const handleSaveModelfile = async () => {
    if (!selectedModelfile) return
    setSaving(true)
    try {
      const data = await adminApiRequest<{ success: boolean; error?: string }>(
        `/admin/models/modelfiles/${encodeURIComponent(selectedModelfile)}`,
        {
          method: 'PUT',
          body: JSON.stringify({ content: editingContent })
        }
      )
      if (data.success) {
        setModelfileContent(editingContent)
        setIsEditing(false)
        showMessage('success', 'Modelfile 保存成功')
      } else {
        showMessage('error', data.error || '保存失败')
      }
    } catch (error) {
      showMessage('error', '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateModel = async () => {
    if (!newModelName || !selectedModelfile) {
      showMessage('error', '请输入模型名称并选择 Modelfile')
      return
    }
    setCreating(true)
    try {
      const data = await adminApiRequest<{ success: boolean; message?: string; error?: string }>(
        '/admin/models/create',
        {
          method: 'POST',
          body: JSON.stringify({
            modelName: newModelName,
            modelfileName: selectedModelfile
          })
        }
      )
      if (data.success) {
        showMessage('success', data.message || '模型创建成功')
        setNewModelName('')
        await loadStatus()
      } else {
        showMessage('error', data.error || '创建失败')
      }
    } catch (error) {
      showMessage('error', '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteModel = async (modelName: string) => {
    if (!confirm(`确定要删除模型 "${modelName}" 吗？此操作不可恢复。`)) {
      return
    }
    try {
      const data = await adminApiRequest<{ success: boolean; error?: string }>(
        `/admin/models/${encodeURIComponent(modelName)}`,
        { method: 'DELETE' }
      )
      if (data.success) {
        showMessage('success', '模型已删除')
        await loadStatus()
      } else {
        showMessage('error', data.error || '删除失败')
      }
    } catch (error) {
      showMessage('error', '删除失败')
    }
  }

  const handleSaveConfig = async (key: string, value: string) => {
    setSavingConfig(true)
    try {
      const result = await updateEnvVar(key, value)
      if (result.success) {
        setLlmConfig(prev => ({ ...prev, [key]: value }))
        setEditingKey(null)
        showMessage('success', '配置已保存，重启服务后生效')
        // 如果删除了模型，刷新状态
        await loadStatus()
      } else {
        showMessage('error', result.error || '保存失败')
      }
    } catch (error) {
      showMessage('error', '保存失败')
    } finally {
      setSavingConfig(false)
    }
  }

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 ** 3) return `${(bytes / (1024 ** 3)).toFixed(2)} GB`
    if (bytes >= 1024 ** 2) return `${(bytes / (1024 ** 2)).toFixed(2)} MB`
    return `${(bytes / 1024).toFixed(2)} KB`
  }

  const isSecretKey = (key: string) => key.includes('API_KEY') || key.includes('SECRET')

  // 通用配置字段组件
  const ConfigField = ({ label, configKey, type = 'text', description, placeholder }: {
    label: string
    configKey: keyof LLMConfig
    type?: 'text' | 'password' | 'number'
    description?: string
    placeholder?: string
  }) => {
    const isSecret = isSecretKey(configKey)
    const isEditing = editingKey === configKey
    const value = llmConfig[configKey]
    const showValue = isSecret ? showSecrets.has(configKey) : true

    return (
      <div className="py-2">
        <Label className="text-sm text-gray-600">{label}</Label>
        {description && <p className="text-xs text-gray-400 mb-1">{description}</p>}
        <div className="flex items-center gap-2 mt-1">
          {isEditing ? (
            <>
              <Input
                type={isSecret ? 'password' : type}
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                placeholder={placeholder}
                className="flex-1"
                autoFocus
              />
              <Button
                size="sm"
                onClick={() => handleSaveConfig(configKey, editingValue)}
                disabled={savingConfig}
              >
                {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingKey(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded flex-1 truncate">
                {isSecret && !showValue ? '••••••••' : (value || '(未设置)')}
              </code>
              {isSecret && (
                <button
                  onClick={() => toggleSecretVisibility(configKey)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingKey(configKey)
                  setEditingValue(isSecret ? '' : value)
                }}
              >
                <Edit className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  // 模型选择下拉组件
  const ModelSelectField = ({ label, configKey, description }: {
    label: string
    configKey: keyof LLMConfig
    description?: string
  }) => {
    const currentValue = llmConfig[configKey]
    const isEditing = editingKey === configKey

    // 根据配置键决定使用哪个模型列表
    const getModelOptions = () => {
      if (configKey === 'OLLAMA_MODEL' || configKey === 'LLM_MODEL') {
        // 使用已注册的 Ollama 模型
        return status?.ollama.models.map(m => ({
          value: m.name,
          label: `${m.name} (${formatSize(m.size)})`
        })) || []
      }
      if (configKey === 'DEEPSEEK_MODEL') {
        return DEEPSEEK_MODELS
      }
      if (configKey === 'ZIWEI_MODEL') {
        // 命理模型 - 优先显示已注册的 ziwei 模型，也允许手动输入
        const ziweiModels = status?.ollama.models
          .filter(m => m.name.includes('ziwei'))
          .map(m => ({
            value: m.name,
            label: `${m.name} (${formatSize(m.size)})`
          })) || []
        // 如果当前值不在列表中，添加它
        if (currentValue && !ziweiModels.find(m => m.value === currentValue)) {
          ziweiModels.push({ value: currentValue, label: currentValue })
        }
        return ziweiModels
      }
      return []
    }

    const options = getModelOptions()

    return (
      <div className="py-2">
        <Label className="text-sm text-gray-600">{label}</Label>
        {description && <p className="text-xs text-gray-400 mb-1">{description}</p>}
        <div className="flex items-center gap-2 mt-1">
          {isEditing ? (
            <>
              <Select
                value={editingValue}
                onValueChange={setEditingValue}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {options.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                  {options.length === 0 && (
                    <SelectItem value="_none" disabled>暂无可用模型</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => handleSaveConfig(configKey, editingValue)}
                disabled={savingConfig || !editingValue}
              >
                {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingKey(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded flex-1">
                {currentValue || '(未设置)'}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingKey(configKey)
                  setEditingValue(currentValue)
                }}
              >
                <Edit className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  // 后端选择组件
  const BackendSelect = () => {
    const currentBackend = llmConfig.LLM_BACKEND
    const isEditing = editingKey === 'LLM_BACKEND'

    return (
      <div className="py-2">
        <Label className="text-sm text-gray-600">LLM 后端</Label>
        <p className="text-xs text-gray-400 mb-1">选择使用本地 Ollama 或云端 API</p>
        <div className="flex items-center gap-2 mt-1">
          {isEditing ? (
            <>
              <Select
                value={editingValue}
                onValueChange={setEditingValue}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="选择后端" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ollama">Ollama (本地)</SelectItem>
                  <SelectItem value="deepseek">DeepSeek (云端)</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => handleSaveConfig('LLM_BACKEND', editingValue)}
                disabled={savingConfig}
              >
                {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingKey(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Badge variant={currentBackend === 'ollama' ? 'default' : 'secondary'} className="flex-1 justify-center py-1">
                {currentBackend === 'ollama' ? 'Ollama (本地)' : 'DeepSeek (云端)'}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingKey('LLM_BACKEND')
                  setEditingValue(currentBackend)
                }}
              >
                <Edit className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (!can('system:view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">您没有权限访问此页面</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">模型管理</h1>
          <p className="text-gray-600">管理 LLM 配置、Ollama 模型和 Modelfile</p>
        </div>
        <Button variant="outline" onClick={() => { loadStatus(); loadLLMConfig(); }} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
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

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* LLM Configuration Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-500" />
                LLM 配置
              </CardTitle>
              <CardDescription>配置系统使用的大语言模型后端</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Default Settings */}
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700 flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    默认配置
                  </h4>
                  <p className="text-xs text-gray-500 mb-2">
                    LangGraph 节点的默认值，节点独立配置会覆盖此处设置
                  </p>
                  <BackendSelect />
                  <ModelSelectField
                    label="默认模型"
                    configKey="LLM_MODEL"
                    description="新建节点的默认模型"
                  />
                  <ConfigField
                    label="超时时间 (ms)"
                    configKey="LLM_TIMEOUT"
                    type="number"
                    description="请求超时时间"
                  />
                  <ConfigField
                    label="Temperature"
                    configKey="LLM_TEMPERATURE"
                    type="number"
                    description="生成温度 0-1"
                  />
                </div>

                {/* Ollama Settings */}
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700 flex items-center gap-2">
                    <Server className="w-4 h-4" />
                    Ollama (本地)
                  </h4>
                  <ConfigField
                    label="Ollama 地址"
                    configKey="OLLAMA_BASE_URL"
                    description="Ollama 服务地址"
                  />
                  <ModelSelectField
                    label="Ollama 模型"
                    configKey="OLLAMA_MODEL"
                    description="本地使用的模型"
                  />
                  <ConfigField
                    label="Ollama 超时 (ms)"
                    configKey="OLLAMA_TIMEOUT"
                    type="number"
                    description="Ollama 请求超时"
                  />
                </div>

                {/* DeepSeek Settings */}
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700 flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    DeepSeek (云端)
                  </h4>
                  <ConfigField
                    label="API Key"
                    configKey="DEEPSEEK_API_KEY"
                    type="password"
                    description="DeepSeek API 密钥"
                  />
                  <ConfigField
                    label="API 地址"
                    configKey="DEEPSEEK_BASE_URL"
                    description="DeepSeek API 端点"
                  />
                  <ModelSelectField
                    label="模型"
                    configKey="DEEPSEEK_MODEL"
                    description="选择 DeepSeek 模型"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ziwei Model & Ollama Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ziwei Model Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-orange-500" />
                  命理模型状态
                </CardTitle>
              </CardHeader>
              <CardContent>
                {status?.ziweiModel ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {status.ziweiModel.registered ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <span className="text-green-700 font-medium">已注册</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-red-500" />
                          <span className="text-red-700 font-medium">未注册</span>
                        </>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>模型名称: {status.ziweiModel.name}</p>
                      {status.ziweiModel.size && (
                        <p>模型大小: {formatSize(status.ziweiModel.size)}</p>
                      )}
                    </div>
                    <div className="pt-2 border-t space-y-1">
                      <ModelSelectField
                        label="命理模型"
                        configKey="ZIWEI_MODEL"
                      />
                      <ConfigField
                        label="超时时间 (ms)"
                        configKey="ZIWEI_TIMEOUT"
                        type="number"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">无法获取状态</p>
                )}
              </CardContent>
            </Card>

            {/* GGUF Files */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Box className="w-5 h-5" />
                  GGUF 模型文件
                </CardTitle>
                <CardDescription>可用的 GGUF 模型文件</CardDescription>
              </CardHeader>
              <CardContent>
                {status?.ggufFiles && status.ggufFiles.length > 0 ? (
                  <ul className="space-y-1 text-sm max-h-48 overflow-y-auto">
                    {status.ggufFiles.map((file) => (
                      <li key={file} className="flex items-center gap-2 text-gray-700">
                        <Box className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="truncate" title={file}>{file}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm">无 GGUF 文件</p>
                )}
              </CardContent>
            </Card>

            {/* Registered Models */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  已注册模型
                </CardTitle>
                <CardDescription>Ollama 中已注册的模型 ({status?.ollama.models.length || 0})</CardDescription>
              </CardHeader>
              <CardContent>
                {status?.ollama.models && status.ollama.models.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {status.ollama.models.map((model) => (
                      <div
                        key={model.name}
                        className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{model.name}</span>
                            {model.name.includes('ziwei') && (
                              <Badge variant="outline" className="text-xs flex-shrink-0">命理</Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatSize(model.size)}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteModel(model.name)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">无已注册模型</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Modelfiles Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Modelfile 管理
              </CardTitle>
              <CardDescription>编辑 Modelfile 并创建新模型</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Modelfile List */}
                <div className="md:col-span-2">
                  <Label className="text-sm font-medium mb-2 block">可用 Modelfile</Label>
                  {status?.modelfiles && status.modelfiles.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {status.modelfiles.map((file) => (
                        <div
                          key={file}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => handleLoadModelfile(file)}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-orange-500" />
                            <span className="font-medium text-sm">{file}</span>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Maximize2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">无 Modelfile</p>
                  )}
                </div>

                {/* Create Model Section */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">创建新模型</Label>
                  <div className="space-y-2 p-4 border rounded-lg bg-gray-50">
                    <Input
                      placeholder="输入模型名称 (如: ziwei-8b)"
                      value={newModelName}
                      onChange={(e) => setNewModelName(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                      基于 {selectedModelfile || 'Modelfile.ziwei'} 创建
                    </p>
                    <Button
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600"
                      onClick={handleCreateModel}
                      disabled={creating || !newModelName}
                    >
                      {creating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          创建中...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          创建模型
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modelfile Editor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-6xl w-[95vw] sm:w-[95vw] h-[95vh] sm:h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              <span className="truncate">{selectedModelfile || 'Modelfile 编辑器'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              编辑 Modelfile 内容并保存更改
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0 px-3 sm:px-6 py-3 sm:py-4 overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4 pb-3 sm:pb-4 border-b shrink-0">
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <Badge variant="default" className="bg-orange-500 text-xs">编辑模式</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">只读模式</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 justify-end">
                {isEditing ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false)
                        setEditingContent(modelfileContent)
                      }}
                      className="text-xs sm:text-sm"
                    >
                      <X className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                      <span className="hidden sm:inline">取消</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveModelfile}
                      disabled={saving}
                      className="bg-gradient-to-r from-orange-500 to-orange-600 text-xs sm:text-sm"
                    >
                      {saving ? (
                        <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                      )}
                      <span className="hidden sm:inline">保存</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="text-xs sm:text-sm"
                  >
                    <Edit className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                    <span className="hidden sm:inline">编辑</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <Textarea
                value={isEditing ? editingContent : modelfileContent}
                onChange={(e) => setEditingContent(e.target.value)}
                readOnly={!isEditing}
                className="font-mono text-xs sm:text-sm h-full w-full resize-none border-2 focus:border-orange-500 rounded-md"
                placeholder="Modelfile 内容将显示在这里..."
              />
            </div>
          </div>

          <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t bg-gray-50 shrink-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="text-sm">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
