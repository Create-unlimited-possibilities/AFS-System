'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { UserPlus, UserMinus, Mail, Search, Plus } from 'lucide-react'

interface AssistRelation {
  _id: string
  assistedUser: {
    _id: string
    name: string
    email: string
  }
  assistantUser: {
    _id: string
    name: string
    email: string
  }
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
}

export default function AssistPage() {
  const { user } = useAuthStore()
  const [relations, setRelations] = useState<AssistRelation[]>([])
  const [email, setEmail] = useState('')
  const [searchEmail, setSearchEmail] = useState('')
  const [foundUser, setFoundUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchRelations()
  }, [])

  const fetchRelations = async () => {
    try {
      setLoading(true)
      const res = await api.get('/auth/assist/relations')
      setRelations(res.data || [])
    } catch (error) {
      console.error('获取协助关系失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchUser = async () => {
    if (!searchEmail) return

    try {
      const res = await api.get<{ user: any }>(`/auth/assist/search?email=${searchEmail}`)
      if (res.success && res.data?.user) {
        setFoundUser(res.data.user)
      } else {
        alert('未找到该用户')
        setFoundUser(null)
      }
    } catch (error) {
      console.error('搜索用户失败:', error)
      alert('搜索失败，请检查邮箱是否正确')
    }
  }

  const handleSendRequest = async () => {
    if (!foundUser) return

    try {
      setSubmitting(true)
      await api.post('/auth/assist/verify', {
        targetEmail: foundUser.email,
        targetCode: foundUser.uniqueCode
      })
      alert('协助请求已发送！')
      setSearchEmail('')
      setFoundUser(null)
      fetchRelations()
    } catch (error) {
      console.error('发送请求失败:', error)
      alert('发送请求失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveRelation = async (relationId: string) => {
    if (!confirm('确定要删除这个协助关系吗？')) return

    try {
      await api.del(`/auth/assist/relations/${relationId}`)
      fetchRelations()
    } catch (error) {
      console.error('删除关系失败:', error)
      alert('操作失败')
    }
  }

  const myAssisted = relations.filter(
    r => r.assistantUser._id === user?._id
  )
  const myAssistants = relations.filter(
    r => r.assistedUser._id === user?._id
  )

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
          <h1 className="text-3xl font-bold mb-4">协助关系</h1>
          <p className="text-muted-foreground">
            管理您与家人的协助关系，帮助收集和整理记忆
          </p>
        </div>

        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                添加新的协助关系
              </CardTitle>
              <CardDescription>
                输入对方的邮箱地址，发送协助请求
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!foundUser ? (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="email"
                      placeholder="输入对方邮箱地址"
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
                    />
                  </div>
                  <Button onClick={handleSearchUser}>
                    <Search className="h-4 w-4 mr-2" />
                    搜索
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{foundUser.name}</div>
                      <div className="text-sm text-muted-foreground">{foundUser.email}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFoundUser(null)
                          setSearchEmail('')
                        }}
                      >
                        取消
                      </Button>
                      <Button
                        onClick={handleSendRequest}
                        disabled={submitting}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        {submitting ? '发送中...' : '发送请求'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold mb-4">
              我协助的人 ({myAssisted.length})
            </h2>
            <div className="space-y-4">
              {myAssisted.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">
                      暂无协助记录
                    </p>
                  </CardContent>
                </Card>
              ) : (
                myAssisted.map((relation) => (
                  <Card key={relation._id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">
                            {relation.assistedUser.name}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {relation.assistedUser.email}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {relation.status === 'accepted' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveRelation(relation._id)}
                            >
                              <UserMinus className="h-4 w-4 mr-1" />
                              移除
                            </Button>
                          )}
                          {relation.status === 'pending' && (
                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                              待确认
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">
              协助我的人 ({myAssistants.length})
            </h2>
            <div className="space-y-4">
              {myAssistants.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">
                      暂无协助记录
                    </p>
                  </CardContent>
                </Card>
              ) : (
                myAssistants.map((relation) => (
                  <Card key={relation._id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">
                            {relation.assistantUser.name}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {relation.assistantUser.email}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {relation.status === 'pending' && (
                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                              待对方确认
                            </span>
                          )}
                          {relation.status === 'accepted' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveRelation(relation._id)}
                            >
                              <UserMinus className="h-4 w-4 mr-1" />
                              移除
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
