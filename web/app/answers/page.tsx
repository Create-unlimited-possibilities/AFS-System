'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Search, Filter, FileText, User, Calendar } from 'lucide-react'

interface Contributor {
  contributor: {
    id: string
    name: string
    email: string
  }
  relationshipType: string
  answers: {
    id: string
    questionId: string
    question: string
    questionLayer: string
    answer: string
    createdAt: string
  }[]
  basicCount: number
  emotionalCount: number
}

interface Answer {
  _id: string
  userId: string
  questionId: string
  questionText: string
  answer: string
  userName: string
  createdAt: string
}

export default function AnswersPage() {
  const { user } = useAuthStore()
  const [answers, setAnswers] = useState<Answer[]>([])
  const [filteredAnswers, setFilteredAnswers] = useState<Answer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterUser, setFilterUser] = useState('all')

  useEffect(() => {
    fetchAnswers()
  }, [])

  useEffect(() => {
    filterAnswers()
  }, [answers, searchTerm, filterUser])

  const fetchAnswers = async () => {
    try {
      setLoading(true)
      const res = await api.get('/answers/from-others')
      const responseData = res.data || {}
      const contributors = responseData.contributors || []
      
      // 将分组数据转换为扁平数组
      const flattenedAnswers = (contributors as Contributor[]).flatMap((contributor: Contributor) =>
        contributor.answers.map(answer => ({
          _id: answer.id,
          userId: contributor.contributor.id,
          questionId: answer.questionId,
          questionText: answer.question,
          answer: answer.answer,
          userName: contributor.contributor.name,
          createdAt: answer.createdAt
        }))
      )
      
      setAnswers(flattenedAnswers)
    } catch (error) {
      console.error('获取回答失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterAnswers = () => {
    let filtered = answers

    if (filterUser !== 'all') {
      filtered = filtered.filter(a => a.userId === filterUser)
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(a =>
        a.questionText.toLowerCase().includes(term) ||
        a.answer.toLowerCase().includes(term) ||
        a.userName.toLowerCase().includes(term)
      )
    }

    setFilteredAnswers(filtered)
  }

  const uniqueUsers = Array.from(new Set(answers.map(a => a.userId)))
    .map(userId => {
      const userAnswer = answers.find(a => a.userId === userId)
      return {
        id: userId,
        name: userAnswer?.userName || '未知用户'
      }
    })

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">加载中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">查看回答</h1>
          <p className="text-muted-foreground">
            浏览家庭成员的回答和珍贵的记忆记录
          </p>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索问题、回答或用户..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">所有用户</option>
                  {uniqueUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredAnswers.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">暂无回答</p>
                <p className="text-sm">
                  {searchTerm || filterUser !== 'all'
                    ? '没有找到匹配的回答'
                    : '还没有收到任何回答记录'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredAnswers.map((answer) => (
              <Card key={answer._id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">
                        {answer.questionText}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {answer.userName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(answer.createdAt).toLocaleDateString('zh-CN')}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    <p className="text-base leading-relaxed whitespace-pre-wrap">
                      {answer.answer}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {filteredAnswers.length > 0 && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            共显示 {filteredAnswers.length} 条回答
          </div>
        )}
      </div>
    </div>
  )
}
