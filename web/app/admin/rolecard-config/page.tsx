'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePermissionStore } from '@/stores/permission'
import { adminApiRequest } from '@/lib/admin-api'
import { Save, RotateCcw, Loader2, Settings2 } from 'lucide-react'

interface OperationConfig {
  source: 'ollama' | 'api'
  model: string
  apiProvider?: 'deepseek' | 'openai' | null
  temperature: number
  maxTokens: number
}

interface LLMConfig {
  coreExtraction: OperationConfig
  coreCompression: OperationConfig
  relationExtraction: OperationConfig
  relationCompression: OperationConfig
  trustAnalysis: OperationConfig
  updatedAt?: string
}

interface AvailableModels {
  ollama: Array<{ name: string; size?: number }>
  api: {
    deepseek: Array<{ name: string; description: string }>
    openai: Array<{ name: string; description: string }>
  }
}

const defaultConfig: LLMConfig = {
  coreExtraction: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.3, maxTokens: 1000 },
  coreCompression: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.3, maxTokens: 400 },
  relationExtraction: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.3, maxTokens: 1000 },
  relationCompression: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.3, maxTokens: 400 },
  trustAnalysis: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.2, maxTokens: 300 }
}

export default function RoleCardConfigPage() {
  const { can } = usePermissionStore()
  const [config, setConfig] = useState<LLMConfig>(defaultConfig)
  const [models, setModels] = useState<AvailableModels | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (can('rolecard-config:view') || can('langgraph:edit')) {
      loadConfig()
      loadModels()
    }
  }, [can])

  const loadConfig = async () => {
    try {
      const result = await adminApiRequest<{ success: boolean; config: LLMConfig }>('/admin/rolecard/config')
      if (result.success && result.config) {
        setConfig(result.config)
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadModels = async () => {
    try {
      const result = await adminApiRequest<{ success: boolean; models: AvailableModels }>('/admin/rolecard/config/models')
      if (result.success && result.models) {
        setModels(result.models)
      }
    } catch (error) {
      console.error('加载模型列表失败:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const result = await adminApiRequest<{ success: boolean; message: string }>('/admin/rolecard/config', {
        method: 'PUT',
        body: JSON.stringify(config)
      })
      if (result.success) {
        setMessage({ type: 'success', text: '配置已保存' })
      } else {
        setMessage({ type: 'error', text: '保存失败' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '保存失败: ' + (error as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setConfig(defaultConfig)
    setMessage(null)
  }

  const updateOperation = (
    key: keyof LLMConfig,
    field: keyof OperationConfig,
    value: string | number
  ) => {
    setConfig(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }))
  }

  if (!can('rolecard-config:view') && !can('langgraph:edit')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">您没有权限访问此页面</p>
      </div>
    )
  }

  const OperationConfigCard = ({
    title,
    configKey,
    description
  }: {
    title: string
    configKey: keyof LLMConfig
    description: string
  }) => {
    const op = config[configKey]
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">来源</Label>
              <Select
                value={op.source}
                onValueChange={(v) => updateOperation(configKey, 'source', v)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ollama">Ollama (本地)</SelectItem>
                  <SelectItem value="api">API (云端)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">模型</Label>
              <Select
                value={op.model}
                onValueChange={(v) => updateOperation(configKey, 'model', v)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {op.source === 'ollama' ? (
                    models?.ollama?.map(m => (
                      <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>
                    )) || <SelectItem value="deepseek-r1:14b">deepseek-r1:14b</SelectItem>
                  ) : (
                    models?.api?.deepseek?.map(m => (
                      <SelectItem key={m.name} value={m.name}>{m.description}</SelectItem>
                    )) || <SelectItem value="deepseek-chat">DeepSeek Chat</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">温度</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={op.temperature}
                onChange={(e) => updateOperation(configKey, 'temperature', parseFloat(e.target.value))}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">最大Token</Label>
              <Input
                type="number"
                value={op.maxTokens}
                onChange={(e) => updateOperation(configKey, 'maxTokens', parseInt(e.target.value))}
                className="h-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings2 className="w-6 h-6" />
            角色卡生成管理
          </h1>
          <p className="text-gray-600">配置角色卡生成各阶段使用的LLM模型（5个阶段独立配置）</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={saving}>
            <RotateCcw className="w-4 h-4 mr-2" />
            重置默认
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            保存配置
          </Button>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">核心层配置</CardTitle>
            <CardDescription>从A套答案提取人格特质</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <OperationConfigCard
                title="提取 (Extraction)"
                configKey="coreExtraction"
                description="从每个答案中提取人格片段"
              />
              <OperationConfigCard
                title="压缩 (Compression)"
                configKey="coreCompression"
                description="将多个片段压缩为字段摘要"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">关系层配置</CardTitle>
            <CardDescription>从B/C套答案提取关系信息</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <OperationConfigCard
                title="提取 (Extraction)"
                configKey="relationExtraction"
                description="从协助者答案中提取关系片段"
              />
              <OperationConfigCard
                title="压缩 (Compression)"
                configKey="relationCompression"
                description="将关系片段压缩为字段摘要"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">信任分析配置</CardTitle>
            <CardDescription>分析用户与协助者之间的信任等级</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <OperationConfigCard
                title="信任等级分析"
                configKey="trustAnalysis"
                description="根据压缩后的数据判断信任等级"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {config.updatedAt && (
        <p className="text-sm text-gray-500">
          上次更新: {new Date(config.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  )
}
