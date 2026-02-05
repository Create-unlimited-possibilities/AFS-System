'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'
import { User, FileText, MessageSquare, Users, Copy, Check } from 'lucide-react'

interface Stats {
  totalQuestions: number
  answeredQuestions: number
  totalAnswers: number
  assistRelations: number
  totalContributors: number
  basicAnswers: number
  emotionalAnswers: number
  basicProgress: { total: number; answered: number }
  emotionalProgress: { total: number; answered: number }
}

export default function DashboardPage() {
  const { user, setUser, hasHydrated } = useAuthStore()
  const [stats, setStats] = useState<Stats>({
    totalQuestions: 0,
    answeredQuestions: 0,
    totalAnswers: 0,
    assistRelations: 0,
    totalContributors: 0,
    basicAnswers: 0,
    emotionalAnswers: 0,
    basicProgress: { total: 0, answered: 0 },
    emotionalProgress: { total: 0, answered: 0 },
  })
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    console.log('[Dashboard] useEffect triggered, hasHydrated:', hasHydrated)
    // 等待 zustand persist 水合完成后再获取数据
    if (hasHydrated) {
      console.log('[Dashboard] Hydration complete, fetching stats')
      fetchStats()
      if (user && !user.uniqueCode) {
        fetchUser()
      }
    } else {
      console.log('[Dashboard] Waiting for hydration...')
    }
  }, [hasHydrated, user])

  const fetchUser = async () => {
    try {
      const res = await api.get('/auth/me')
      if (res.data) {
        setUser(res.data)
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
    }
  }

  const fetchStats = async () => {
    try {
      setLoading(true)
      // Fetch both basic and emotional layer questions
      const [basicRes, emotionalRes, answersRes, othersAnswersRes, assistRes] = await Promise.all([
        api.get('/questions?layer=basic&role=elder'),
        api.get('/questions?layer=emotional&role=elder'),
        api.get('/answers/self'),
        api.get('/answers/from-others'),
        api.get('/auth/assist/helpers')
      ])

      const basicTotal = basicRes.data?.questions?.length || 0
      const basicAnswered = basicRes.data?.answered || 0
      const emotionalTotal = emotionalRes.data?.questions?.length || 0
      const emotionalAnswered = emotionalRes.data?.answered || 0
      const totalQuestions = basicTotal + emotionalTotal
      const answeredQuestions = basicAnswered + emotionalAnswered
      const selfAnswers = answersRes.data?.length || 0
      // 使用后端返回的分组数据统计收到回答
      const othersData = othersAnswersRes.data || {}
      const totalAnswers = othersData.totalAnswers || 0
      const totalContributors = othersData.totalContributors || 0
      const basicAnswers = othersData.basicAnswers || 0
      const emotionalAnswers = othersData.emotionalAnswers || 0
      const assistRelations = assistRes.data?.length || 0

      setStats({
        totalQuestions,
        answeredQuestions,
        totalAnswers,
        assistRelations,
        totalContributors,
        basicAnswers,
        emotionalAnswers,
        basicProgress: { total: basicTotal, answered: basicAnswered },
        emotionalProgress: { total: emotionalTotal, answered: emotionalAnswered },
      })
    } catch (error) {
      console.error('获取统计数据失败:', error)
    } finally {
      setLoading(false)
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">个人中心</h1>
          <p className="text-muted-foreground mt-2">
            欢迎回来，{user?.name}
          </p>
        </div>

        {user?.uniqueCode && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>您的专属编号</CardTitle>
              <CardDescription>家人或朋友可以凭此编号和您的邮箱协助您填写问卷</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-mono text-2xl tracking-wider bg-muted p-4 rounded-lg border text-center">
                    {user.uniqueCode}
                  </div>
                </div>
                <Button
                  onClick={handleCopyCode}
                  size="lg"
                  className="gap-2"
                >
                  {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  {copied ? '已复制' : '复制编号'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                总问题数
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '...' : stats.totalQuestions}
              </div>
              <p className="text-xs text-muted-foreground">
                基础 {stats.basicProgress.total} · 情感 {stats.emotionalProgress.total}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                已回答
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '...' : stats.answeredQuestions}
              </div>
              <p className="text-xs text-muted-foreground">
                完成度 {stats.totalQuestions > 0 ? Math.round((stats.answeredQuestions / stats.totalQuestions) * 100) : 0}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                收到回答
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '...' : stats.totalAnswers}
              </div>
              <p className="text-xs text-muted-foreground">
                来自 {loading ? '...' : stats.totalContributors} 位协助者
                {loading ? '' : ` · 基础 ${stats.basicAnswers} · 情感 ${stats.emotionalAnswers}`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                协助者
              </CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '...' : stats.assistRelations}
              </div>
              <p className="text-xs text-muted-foreground">
                协助您回答问题的用户
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Layer Progress Details */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基础层次进度</CardTitle>
              <CardDescription>日常基本信息相关问题</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>已完成</span>
                  <span className="font-medium">{stats.basicProgress.answered} / {stats.basicProgress.total}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{
                      width: stats.basicProgress.total > 0
                        ? `${(stats.basicProgress.answered / stats.basicProgress.total) * 100}%`
                        : '0%'
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">情感层次进度</CardTitle>
              <CardDescription>深层次情感交流相关问题</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>已完成</span>
                  <span className="font-medium">{stats.emotionalProgress.answered} / {stats.emotionalProgress.total}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{
                      width: stats.emotionalProgress.total > 0
                        ? `${(stats.emotionalProgress.answered / stats.emotionalProgress.total) * 100}%`
                        : '0%'
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>账户信息</CardTitle>
              <CardDescription>您的基本账户详情</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">姓名</label>
                <p className="text-muted-foreground">{user?.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium">邮箱</label>
                <p className="text-muted-foreground">{user?.email}</p>
              </div>
              {user?.uniqueCode && (
                <div>
                  <label className="text-sm font-medium">专属编号</label>
                  <p className="text-muted-foreground font-mono">{user.uniqueCode}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>快速操作</CardTitle>
              <CardDescription>常用功能快捷入口</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <a href="/questions" className="block p-3 rounded-lg border hover:bg-accent transition-colors">
                <div className="font-medium">回答问题</div>
                <div className="text-sm text-muted-foreground">填写和更新您的问题回答</div>
              </a>
              <a href="/answers" className="block p-3 rounded-lg border hover:bg-accent transition-colors">
                <div className="font-medium">查看回答</div>
                <div className="text-sm text-muted-foreground">查看您收到的所有回答</div>
              </a>
              <a href="/assist" className="block p-3 rounded-lg border hover:bg-accent transition-colors">
                <div className="font-medium">协助关系</div>
                <div className="text-sm text-muted-foreground">管理家庭协助关系</div>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
