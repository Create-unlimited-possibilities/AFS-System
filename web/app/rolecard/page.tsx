'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { RoleCardExtended, AssistantGuideline, User, VectorIndexStatus, VectorIndexStatusResponse } from '@/types'
import { Sparkles, Copy, CheckCircle, AlertCircle, User as UserIcon, Loader2, RefreshCw } from 'lucide-react'
import CloudPattern from '@/components/decorations/CloudPattern'
import GenerateButton from './components/GenerateButton'
import BuildVectorIndexButton from './components/BuildVectorIndexButton'
import RoleCardViewerV2 from './components/RoleCardViewerV2'
import GuidelinesViewer from './components/GuidelinesViewer'
import { buildVectorIndex } from '@/lib/api'
import type { VectorIndexBuildProgress } from '@/types'

interface Stats {
  basicProgress: { total: number; answered: number }
  emotionalProgress: { total: number; answered: number }
  totalAnswers: number
  memoryTokenCount: number
}

export default function RolecardPage() {
  const { user, hasHydrated, setUser } = useAuthStore()
  const [roleCard, setRoleCard] = useState<RoleCardExtended | undefined>(undefined)
  const [guidelines, setGuidelines] = useState<AssistantGuideline[] | undefined>(undefined)
  const [stats, setStats] = useState<Stats | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [generateProgress, setGenerateProgress] = useState<{ current: number; total: number; message: string } | undefined>(undefined)
  const [buildingIndex, setBuildingIndex] = useState(false)
  const [buildProgress, setBuildProgress] = useState<VectorIndexBuildProgress | undefined>(undefined)
  const [vectorIndexStatus, setVectorIndexStatus] = useState<VectorIndexStatus | undefined>(undefined)
  const [relationStats, setRelationStats] = useState<{ success: number; skipped: number; failed: number } | undefined>(undefined)

  useEffect(() => {
    if (hasHydrated && user) {
      fetchData()
    }
  }, [hasHydrated, user])

  useEffect(() => {
    console.log('[RolecardPage] stats状态变化:', JSON.stringify(stats, null, 2))
  }, [stats])

  const fetchData = async () => {
    try {
      setLoading(true)

      console.log('[RolecardPage] fetchData 开始执行')
      console.log('[RolecardPage] 当前user对象:', JSON.stringify(user, null, 2))

      // 使用与 dashboard 相同的统计方法
      const [roleCardRes, guidelinesRes, basicRes, emotionalRes] = await Promise.all([
        api.get<{ roleCard: RoleCardExtended }>('/rolecard'),
        api.get<{ user: { companionChat: { assistantsGuidelines: AssistantGuideline[] } } }>('/auth/me'),
        api.get('/questions?layer=basic&role=elder'),
        api.get('/questions?layer=emotional&role=elder'),
      ])

      console.log('[RolecardPage] API响应 basicRes:', JSON.stringify(basicRes, null, 2))
      console.log('[RolecardPage] API响应 emotionalRes:', JSON.stringify(emotionalRes, null, 2))
      console.log('[RolecardPage] API响应 guidelinesRes:', JSON.stringify(guidelinesRes, null, 2))

      // 更新用户数据（确保companionChat字段存在）
      if (guidelinesRes.success && guidelinesRes.data?.user && user) {
        const updatedUser: User = {
          ...user,
          ...guidelinesRes.data.user,
          _id: user._id,
          id: user.id,
          uniqueCode: user.uniqueCode,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        }
        setUser(updatedUser)
        console.log('[RolecardPage] Updated user with companionChat data')
      }

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

      console.log('[RolecardPage] 计算后的basic:', { total: basicTotal, answered: basicAnswered })
      console.log('[RolecardPage] 计算后的emotional:', { total: emotionalTotal, answered: emotionalAnswered })

      // 从user对象获取memoryTokenCount
      const memoryTokenCount = user?.companionChat?.roleCard?.memoryTokenCount || 0

      console.log('[RolecardPage] memoryTokenCount:', memoryTokenCount)

      setStats({
        basicProgress: { total: basicTotal, answered: basicAnswered },
        emotionalProgress: { total: emotionalTotal, answered: emotionalAnswered },
        totalAnswers: basicAnswered + emotionalAnswered,
        memoryTokenCount,
      })

      console.log('[RolecardPage] 设置stats:', JSON.stringify({
        basicProgress: { total: basicTotal, answered: basicAnswered },
        emotionalProgress: { total: emotionalTotal, answered: emotionalAnswered },
        totalAnswers: basicAnswered + emotionalAnswered,
        memoryTokenCount,
      }, null, 2))

      await fetchVectorIndexStatus()
    } catch (error) {
      console.error('[RolecardPage] 获取角色卡数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateRoleCard = async () => {
    if (!user?._id) return

    try {
      setGenerating(true)
      setRelationStats(undefined)
      setGenerateProgress({
        current: 0,
        total: 7,
        message: '开始生成角色卡...'
      })

      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('未登录')
      }

      // 使用 SSE 接口
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/rolecard/generate/stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      if (!response.ok) {
        throw new Error('请求失败')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应流')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let currentEventType = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()

          if (trimmedLine.startsWith('event: ')) {
            currentEventType = trimmedLine.substring(7).trim()
          } else if (trimmedLine.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmedLine.substring(6).trim())

              if (currentEventType === 'progress') {
                setGenerateProgress({
                  current: data.step || 0,
                  total: data.total || 7,
                  message: data.message || '处理中...'
                })
              } else if (currentEventType === 'done') {
                if (data.success && data.data?.roleCard) {
                  setRoleCard(data.data.roleCard)
                  if (data.data.relationStats) {
                    setRelationStats(data.data.relationStats)
                  }
                  setGenerateProgress({
                    current: 7,
                    total: 7,
                    message: '生成完成！'
                  })

                  setTimeout(() => {
                    setGenerateProgress(undefined)
                    fetchData()
                  }, 2000)
                }
              } else if (currentEventType === 'error') {
                throw new Error(data.error || '生成失败')
              }
            } catch (parseError) {
              console.error('[RolecardPage] JSON 解析失败:', parseError)
            }

            currentEventType = ''
          }
        }
      }

    } catch (error) {
      console.error('生成角色卡失败:', error)
      const errorMessage = error instanceof Error ? error.message : '生成角色卡失败，请重试'
      alert(errorMessage)
      setGenerateProgress(undefined)
    } finally {
      setGenerating(false)
    }
  }

  const fetchVectorIndexStatus = async () => {
    try {
      console.log('[DEBUG] 开始获取向量索引状态')
      const res = await api.get<VectorIndexStatusResponse>('/rolecard/vector-index/status')
      console.log('[DEBUG] API响应:', res)
      if (res.success && res.data?.status) {
        setVectorIndexStatus(res.data.status)
        console.log('[DEBUG] vectorIndexStatus已更新:', res.data.status)
      }
    } catch (error) {
      console.error('[DEBUG] 获取向量索引状态失败:', error)
    }
  }

  const handleBuildVectorIndex = async () => {
    if (!user?._id) return

    try {
      setBuildingIndex(true)
      setBuildProgress({ current: 0, total: 1, message: '正在初始化...' })

      let buildCompleted = false
      let buildError: Error | null = null

      await buildVectorIndex(
        (data) => {
          if (data.message) {
            setBuildProgress({
              current: data.current || 0,
              total: data.total || 1,
              message: data.message
            })
          }
        },
        () => {
          buildCompleted = true
          setBuildProgress({ current: 1, total: 1, message: '构建完成！' })
        },
        (error) => {
          buildError = error
        }
      )

      if (buildError) {
        throw buildError
      }

      if (buildCompleted) {
        setTimeout(() => {
          setBuildProgress(undefined)
          fetchVectorIndexStatus()
        }, 2000)
      }
    } catch (error) {
      console.error('构建向量索引失败:', error)
      const errorMessage = error instanceof Error ? error.message : '构建失败，请重试'
      alert(errorMessage)
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
                    <UserIcon className="h-5 w-5 text-orange-600" />
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
                      ✓ 已生成 (V2)
                    </span>
                  )}
                </div>
                <CardDescription>
                  {roleCard ? '您的角色卡已生成，可以查看详情或重新生成' : '角色卡尚未生成，请先完成A套问题后生成'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 flex-wrap">
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
                      onClick={handleGenerateRoleCard}
                      disabled={generating}
                      className="gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                      重新生成
                    </Button>
                  )}
                </div>

                {/* 关系层统计 */}
                {relationStats && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
                    <span className="font-medium">关系层生成结果：</span>
                    <span className="text-green-600 ml-2">成功 {relationStats.success}</span>
                    {relationStats.skipped > 0 && (
                      <span className="text-yellow-600 ml-2">跳过 {relationStats.skipped}</span>
                    )}
                    {relationStats.failed > 0 && (
                      <span className="text-red-600 ml-2">失败 {relationStats.failed}</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 角色卡详情 (V2) */}
            {roleCard && (
              <Card className="hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserIcon className="h-5 w-5 text-orange-600" />
                    角色卡详情
                  </CardTitle>
                  <CardDescription>基于分层架构的 V2 角色卡</CardDescription>
                </CardHeader>
                <CardContent>
                  <RoleCardViewerV2 roleCard={roleCard as any} />
                </CardContent>
              </Card>
            )}

            {/* 对话准则 */}
            <GuidelinesViewer guidelines={guidelines} isLoading={loading} />
          </div>
        </div>
      </main>
    </div>
  )
}
