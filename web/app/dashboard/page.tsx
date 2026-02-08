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
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">个人中心</h1>
              <p className="text-gray-600 mt-1">
                欢迎回来，{user?.name}
              </p>
            </div>
          </div>
        </div>

        {user?.uniqueCode && (
          <Card className="mb-8 bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 animate-slide-up">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">您的专属编号</CardTitle>
                  <CardDescription>家人或朋友可以凭此编号和您的邮箱协助您填写问卷</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-mono text-3xl tracking-wider bg-white p-6 rounded-2xl border-2 border-orange-300 text-center shadow-md">
                    {user.uniqueCode}
                  </div>
                </div>
                <Button
                  onClick={handleCopyCode}
                  size="lg"
                  className="gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
                >
                  {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  {copied ? '已复制' : '复制编号'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-gray-700">
                总问题数
              </CardTitle>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {loading ? '...' : stats.totalQuestions}
              </div>
              <p className="text-sm text-gray-500">
                基础 {stats.basicProgress.total} · 情感 {stats.emotionalProgress.total}
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-gray-700">
                已回答
              </CardTitle>
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {loading ? '...' : stats.answeredQuestions}
              </div>
              <p className="text-sm text-gray-500">
                完成度 {stats.totalQuestions > 0 ? Math.round((stats.answeredQuestions / stats.totalQuestions) * 100) : 0}%
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-gray-700">
                收到回答
              </CardTitle>
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {loading ? '...' : stats.totalAnswers}
              </div>
              <p className="text-sm text-gray-500">
                来自 {loading ? '...' : stats.totalContributors} 位协助者
                {loading ? '' : ` · 基础 ${stats.basicAnswers} · 情感 ${stats.emotionalAnswers}`}
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-gray-700">
                协助者
              </CardTitle>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <User className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {loading ? '...' : stats.assistRelations}
              </div>
              <p className="text-sm text-gray-500">
                协助您回答问题的用户
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Layer Progress Details */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base text-gray-900">基础层次进度</CardTitle>
                  <CardDescription>日常基本信息相关问题</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">已完成</span>
                  <span className="font-bold text-blue-600">{stats.basicProgress.answered} / {stats.basicProgress.total}</span>
                </div>
                <div className="w-full bg-white rounded-full h-3 border-2 border-blue-200">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
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

          <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base text-gray-900">情感层次进度</CardTitle>
                  <CardDescription>深层次情感交流相关问题</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">已完成</span>
                  <span className="font-bold text-pink-600">{stats.emotionalProgress.answered} / {stats.emotionalProgress.total}</span>
                </div>
                <div className="w-full bg-white rounded-full h-3 border-2 border-pink-200">
                  <div
                    className="bg-gradient-to-r from-pink-500 to-pink-600 h-3 rounded-full transition-all duration-500"
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

        <div className="grid gap-6 md:grid-cols-2 animate-slide-up" style={{ animationDelay: '0.5s' }}>
          <Card className="hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <CardTitle className="text-xl">账户信息</CardTitle>
              </div>
              <CardDescription>您的基本账户详情</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 block">姓名</label>
                  <p className="text-gray-900 font-medium">{user?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 block">邮箱</label>
                  <p className="text-gray-900 font-medium">{user?.email}</p>
                </div>
              </div>
              {user?.uniqueCode && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-500 block">专属编号</label>
                    <p className="text-gray-900 font-medium font-mono">{user.uniqueCode}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <Copy className="w-4 h-4 text-white" />
                </div>
                <CardTitle className="text-xl">快速操作</CardTitle>
              </div>
              <CardDescription>常用功能快捷入口</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <a href="/questions" className="block p-4 rounded-xl border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition-all duration-300 group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">回答问题</div>
                    <div className="text-sm text-gray-500">填写和更新您的问题回答</div>
                  </div>
                </div>
              </a>
              <a href="/answers" className="block p-4 rounded-xl border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition-all duration-300 group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">查看回答</div>
                    <div className="text-sm text-gray-500">查看您收到的所有回答</div>
                  </div>
                </div>
              </a>
              <a href="/assist" className="block p-4 rounded-xl border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition-all duration-300 group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">协助关系</div>
                    <div className="text-sm text-gray-500">管理家庭协助关系</div>
                  </div>
                </div>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
