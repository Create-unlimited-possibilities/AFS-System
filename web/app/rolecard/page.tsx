'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { RoleCardExtended, AssistantGuideline } from '@/types'
import { Sparkles, Copy, CheckCircle, AlertCircle, User, Loader2 } from 'lucide-react'
import CloudPattern from '@/components/decorations/CloudPattern'
import GenerateButton from './components/GenerateButton'
import BuildVectorIndexButton from './components/BuildVectorIndexButton'
import RoleCardEditor from './components/RoleCardEditor'
import GuidelinesViewer from './components/GuidelinesViewer'
import { buildVectorIndex } from '@/lib/api'
import type { VectorIndexStatus, VectorIndexBuildProgress } from '@/types'

interface Stats {
  basicProgress: { total: number; answered: number }
  emotionalProgress: { total: number; answered: number }
  totalAnswers: number
  memoryTokenCount: number
}

export default function RolecardPage() {
  const { user, hasHydrated } = useAuthStore()
  const [roleCard, setRoleCard] = useState<RoleCardExtended | undefined>(undefined)
  const [guidelines, setGuidelines] = useState<AssistantGuideline[] | undefined>(undefined)
  const [stats, setStats] = useState<Stats | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [generateProgress, setGenerateProgress] = useState<{ current: number; total: number; message: string } | undefined>(undefined)
  const [buildingIndex, setBuildingIndex] = useState(false)
  const [buildProgress, setBuildProgress] = useState<VectorIndexBuildProgress | undefined>(undefined)
  const [vectorIndexStatus, setVectorIndexStatus] = useState<VectorIndexStatus | undefined>(undefined)

  useEffect(() => {
    if (hasHydrated && user) {
      fetchData()
    }
  }, [hasHydrated, user])

  const fetchData = async () => {
    try {
      setLoading(true)

      // 使用与 dashboard 相同的统计方法
      const [roleCardRes, guidelinesRes, basicRes, emotionalRes] = await Promise.all([
        api.get<{ roleCard: RoleCardExtended }>('/rolecard'),
        api.get<{ user: { companionChat: { assistantsGuidelines: AssistantGuideline[] } } }>('/auth/me'),
        api.get('/questions?layer=basic&role=elder'),
        api.get('/questions?layer=emotional&role=elder'),
      ])

      if (roleCardRes.success && roleCardRes.data?.roleCard) {
        setRoleCard(roleCardRes.data.roleCard)
      }

      if (guidelinesRes.success && guidelinesRes.data?.user?.companionChat?.assistantsGuidelines) {
        setGuidelines(guidelinesRes.data.user.companionChat.assistantsGuidelines)
      }

      // 使用后端返回的准确数据
      const basicTotal = basicRes.data?.questions?.length || 0
      const basicAnswered = basicRes.data?.answered || 0
      const emotionalTotal = emotionalRes.data?.questions?.length || 0
      const emotionalAnswered = emotionalRes.data?.answered || 0
      const memoryTokenCount = user?.companionChat?.roleCard?.memoryTokenCount || 0

      setStats({
        basicProgress: { total: basicTotal, answered: basicAnswered },
        emotionalProgress: { total: emotionalTotal, answered: emotionalAnswered },
        totalAnswers: basicAnswered + emotionalAnswered,
        memoryTokenCount,
      })

      await fetchVectorIndexStatus()
    } catch (error) {
      console.error('获取角色卡数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateRoleCard = async () => {
    if (!user?._id) return

    try {
      setGenerating(true)
      setGenerateProgress({ current: 0, total: 5, message: '正在收集答案...' })

      const res = await api.post<{ roleCard: RoleCardExtended; tokenCount: number; assistantsProcessed: number; processingTime: number }>('/rolecard/generate', {})

      if (res.success && res.data) {
        setRoleCard(res.data.roleCard)
        setGenerateProgress({ current: 5, total: 5, message: '完成！' })

        setTimeout(() => {
          setGenerateProgress(undefined)
          fetchData() // 重新获取对话准则
        }, 2000)
      }
    } catch (error) {
      console.error('生成角色卡失败:', error)
      alert('生成角色卡失败，请重试')
      setGenerateProgress(undefined)
    } finally {
      setGenerating(false)
    }
  }

  const fetchVectorIndexStatus = async () => {
    try {
      const res = await api.get('/rolecard/vector-index/status')
      if (res.success && res.data?.status) {
        setVectorIndexStatus(res.data.status)
      }
    } catch (error) {
      console.error('获取向量索引状态失败:', error)
    }
  }

  const handleBuildVectorIndex = async () => {
    if (!user?._id) return

    try {
      setBuildingIndex(true)
      setBuildProgress({ current: 0, total: 1, message: '正在初始化...' })

      await buildVectorIndex((data) => {
        if (data.message) {
          setBuildProgress({
            current: data.current || 0,
            total: data.total || 1,
            message: data.message
          })
        }
      })

      setTimeout(() => {
        setBuildProgress(undefined)
        fetchVectorIndexStatus()
      }, 2000)
    } catch (error) {
      console.error('构建向量索引失败:', error)
      alert(error.message || '构建失败，请重试')
      setBuildProgress(undefined)
    } finally {
      setBuildingIndex(false)
    }
  }

  const handleCopyCode = async () => {
    if (user?.uniqueCode) {
      try {
        await navigator.clipboard.writeText(user.uniqueCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('复制失败:', error)
      }
    }
  }

  const handleSaveRoleCard = async (updatedData: Partial<RoleCardExtended>) => {
    try {
      const res = await api.put<RoleCardExtended>('/rolecard', updatedData)
      if (res.success && res.data) {
        setRoleCard(res.data)
        setEditMode(false)
        alert('保存成功！')
      }
    } catch (error) {
      console.error('保存角色卡失败:', error)
      alert('保存失败，请重试')
    }
  }

  const isFullyAnswered = () => {
    if (!stats) return false
    const basicComplete = stats.basicProgress.answered >= stats.basicProgress.total
    const emotionalComplete = stats.emotionalProgress.answered >= stats.emotionalProgress.total
    return basicComplete && emotionalComplete
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 text-orange-600 animate-spin" />
            <p className="text-gray-600 mt-4">加载中...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto relative">
          {/* 背景装饰 */}
          <div className="absolute top-10 right-10 opacity-10 animate-float pointer-events-none">
            <CloudPattern className="w-32 h-16 text-orange-500" />
          </div>

          <div className="space-y-6 animate-fade-in">
            {/* 页面头部 */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">角色卡管理</h1>
                <p className="text-gray-600 mt-1">查看、生成和编辑您的AI角色卡</p>
              </div>
            </div>

            {/* 专属编号卡片 */}
            {user?.uniqueCode && (
              <Card className="hover:shadow-xl transition-all duration-300 animate-slide-up">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-orange-600" />
                    您的专属编号
                  </CardTitle>
                  <CardDescription>家人或朋友可以凭此编号和您的邮箱与您的角色卡对话</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="font-mono text-2xl tracking-wider bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl border-2 border-orange-200 text-center">
                        {user.uniqueCode}
                      </div>
                    </div>
                    <Button
                      onClick={handleCopyCode}
                      size="lg"
                      className="gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
                    >
                      {copied ? <CheckCircle className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                      {copied ? '已复制' : '复制编号'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* A套问题进度 */}
            {stats && (
              <Card className="hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <CardHeader>
                  <CardTitle>A套问题进度</CardTitle>
                  <CardDescription>完成A套问题是生成角色卡的前提</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                      <div className="text-sm text-gray-600 mb-1">基础层</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {stats.basicProgress.answered} / {stats.basicProgress.total}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {stats.basicProgress.total > 0 ? Math.round((stats.basicProgress.answered / stats.basicProgress.total) * 100) : 0}%
                      </div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl border border-pink-100">
                      <div className="text-sm text-gray-600 mb-1">情感层</div>
                      <div className="text-2xl font-bold text-pink-600">
                        {stats.emotionalProgress.answered} / {stats.emotionalProgress.total}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {stats.emotionalProgress.total > 0 ? Math.round((stats.emotionalProgress.answered / stats.emotionalProgress.total) * 100) : 0}%
                      </div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-100">
                      <div className="text-sm text-gray-600 mb-1">记忆Token数</div>
                      <div className="text-2xl font-bold text-orange-600">
                        {stats.memoryTokenCount}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        累计记忆量
                      </div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                      <div className="text-sm text-gray-600 mb-1">总体进度</div>
                      <div className="flex items-center gap-2">
                        {isFullyAnswered() ? (
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        ) : (
                          <AlertCircle className="h-6 w-6 text-orange-600" />
                        )}
                        <div className="text-2xl font-bold text-gray-900">
                          {Math.round(
                            ((stats.basicProgress.answered + stats.emotionalProgress.answered) /
                              (stats.basicProgress.total + stats.emotionalProgress.total)) * 100
                          )}%
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 角色卡状态 */}
            <Card className="hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-orange-600" />
                    <CardTitle>角色卡状态</CardTitle>
                  </div>
                  {roleCard && (
                    <span className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                      ✓ 已生成
                    </span>
                  )}
                </div>
                <CardDescription>
                  {roleCard ? '您的角色卡已生成，可以查看详情或重新生成' : '角色卡尚未生成，请先完成A套问题后生成'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <GenerateButton
                    isGenerating={generating}
                    isDisabled={!isFullyAnswered()}
                    progress={generateProgress}
                    onClick={handleGenerateRoleCard}
                  />
                  <BuildVectorIndexButton
                    isBuilding={buildingIndex}
                    isDisabled={buildingIndex}
                    progress={buildProgress}
                    status={vectorIndexStatus}
                    onClick={handleBuildVectorIndex}
                  />
                  {roleCard && (
                    <Button
                      variant="outline"
                      onClick={() => setEditMode(!editMode)}
                      className="flex-1"
                    >
                      {editMode ? '完成编辑' : '编辑角色卡'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 编辑模式：显示编辑器 */}
            {editMode && roleCard && (
              <RoleCardEditor
                roleCard={roleCard}
                onSave={handleSaveRoleCard}
                onCancel={() => setEditMode(false)}
                readOnly={false}
              />
            )}

            {/* 非编辑模式：显示详情 */}
            {!editMode && (
              <>
                {/* 角色卡详情 */}
                {roleCard && (
                  <RoleCardEditor
                    roleCard={roleCard}
                    onSave={() => {}}
                    onCancel={() => {}}
                    readOnly={true}
                  />
                )}

                {/* 对话准则 */}
                <GuidelinesViewer guidelines={guidelines} isLoading={loading} />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
