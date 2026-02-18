'use client'

import { useState, useEffect, Suspense, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Send, Mic, Save, MessageSquare, Sparkles, ArrowLeft, AlertCircle, CheckCircle, LogOut } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Modal from '@/components/ui/modal'
import { useNavigationGuard } from '@/components/NavigationGuardContext'

type Layer = 'basic' | 'emotional'

interface Question {
  _id: string
  category: string
  questionText: string
  questionType: 'text' | 'textarea' | 'choice'
  options?: string[]
  order: number
}

interface TargetUser {
  _id: string
  name: string
  email: string
}

const LAYERS = {
  basic: {
    label: '基础层次',
    description: '日常基本信息相关问题',
    color: 'from-blue-500 to-blue-600',
    bg: 'from-blue-50 to-indigo-50',
    borderColor: 'border-blue-200'
  },
  emotional: {
    label: '情感层次',
    description: '深层次情感交流相关问题',
    color: 'from-pink-500 to-pink-600',
    bg: 'from-pink-50 to-rose-50',
    borderColor: 'border-pink-200'
  }
}

function AssistQuestionsContent() {
  const { user } = useAuthStore()
  const searchParams = useSearchParams()
  const router = useRouter()
  const targetId = searchParams.get('targetId')
  const { setHasUnsavedChanges, setOnSaveAndLeave } = useNavigationGuard()

  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<{ [key: string]: string }>({})
  const [originalAnswers, setOriginalAnswers] = useState<{ [key: string]: string }>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentLayer, setCurrentLayer] = useState<Layer>('basic')
  const [targetUser, setTargetUser] = useState<TargetUser | null>(null)
  const [relationType, setRelationType] = useState<'family' | 'friend' | null>(null)
  const [specificRelation, setSpecificRelation] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const allowNavigationRef = useRef(false)
  const pendingNavigationRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!targetId) {
      setError('缺少目标用户ID')
      setLoading(false)
      return
    }
    fetchQuestions()
  }, [currentLayer, targetId])

  // 计算 hasChanges（需要在使用前定义）
  const hasChanges = Object.keys(answers).some(questionId => {
    const current = answers[questionId] || ''
    const original = originalAnswers[questionId] || ''
    return current !== original
  })

  // 注册导航守卫状态
  useEffect(() => {
    setHasUnsavedChanges(hasChanges)
  }, [hasChanges, setHasUnsavedChanges])

  // 注册保存回调
  useEffect(() => {
    setOnSaveAndLeave(async () => {
      await performSave()
    })
    return () => setOnSaveAndLeave(null)
  }, [setOnSaveAndLeave])

  // 处理离开页面确认
  useEffect(() => {
    // 浏览器关闭/刷新时的处理
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges && !allowNavigationRef.current) {
        e.preventDefault()
        e.returnValue = ''
        return ''
      }
    }

    // 浏览器后退按钮处理
    const handlePopState = (e: PopStateEvent) => {
      if (hasChanges && !allowNavigationRef.current) {
        e.preventDefault()
        // 阻止导航后，需要恢复历史记录
        window.history.pushState(null, '', window.location.href)
        setShowLeaveModal(true)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [hasChanges])

  // 处理离开确认
  const handleLeaveWithoutSave = useCallback(() => {
    allowNavigationRef.current = true
    setShowLeaveModal(false)
    if (pendingNavigationRef.current) {
      pendingNavigationRef.current()
      pendingNavigationRef.current = null
    } else {
      router.push('/assist')
    }
  }, [router])

  const handleLeaveAndSave = async () => {
    await performSave()
    allowNavigationRef.current = true
    setShowLeaveModal(false)
    if (pendingNavigationRef.current) {
      pendingNavigationRef.current()
      pendingNavigationRef.current = null
    } else {
      router.push('/assist')
    }
  }

  // 点击返回按钮时的处理
  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (hasChanges) {
      pendingNavigationRef.current = () => router.push('/assist')
      setShowLeaveModal(true)
    } else {
      router.push('/assist')
    }
  }

  const fetchQuestions = async () => {
    if (!targetId) return

    try {
      setLoading(true)
      setError('')
      const res = await api.get(`/questions/assist?targetUserId=${targetId}`)

      if (res && res.success && res.data) {
        setQuestions(res.data.questions || [])
        setTargetUser(res.data.targetUser || null)
        setRelationType(res.data.relationType || null)
        setSpecificRelation(res.data.specificRelation || '')

        const answersMap: { [key: string]: string } = {}
        res.data.questions.forEach((q: any) => {
          if (q.answer && q._id) {
            answersMap[q._id] = q.answer
          }
        })
        setAnswers(answersMap)
        setOriginalAnswers(answersMap)
      } else {
        setError(res.error || '获取问题失败')
        setQuestions([])
        setAnswers({})
      }
    } catch (error) {
      console.error('获取问题失败:', error)
      setError('获取问题失败，请稍后重试')
      setQuestions([])
      setAnswers({})
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }))
  }

  const getQuestionStatus = (questionId: string): 'unanswered' | 'answered' | 'modified' => {
    const currentAnswer = answers[questionId] || ''
    const originalAnswer = originalAnswers[questionId] || ''

    if (currentAnswer === '' && originalAnswer === '') {
      return 'unanswered'
    }
    if (currentAnswer === originalAnswer) {
      return 'answered'
    }
    return 'modified'
  }

  const getStatusLabel = (status: 'unanswered' | 'answered' | 'modified') => {
    switch (status) {
      case 'unanswered': return { text: '未回答', className: 'bg-gray-100 text-gray-600' }
      case 'answered': return { text: '已回答', className: 'bg-green-100 text-green-700' }
      case 'modified': return { text: '修改中', className: 'bg-red-100 text-red-700' }
    }
  }

  const changedCount = Object.keys(answers).filter(questionId => {
    const current = answers[questionId] || ''
    const original = originalAnswers[questionId] || ''
    return current !== original
  }).length

  const getModifiedQuestions = () => {
    return questions.filter(q => {
      const current = answers[q._id] || ''
      const original = originalAnswers[q._id] || ''
      return current !== original
    }).map(q => ({
      questionText: q.questionText,
      order: q.order,
      newAnswer: answers[q._id] || ''
    }))
  }

  const handleSave = async () => {
    // 如果有修改，显示确认弹窗
    if (hasChanges) {
      setShowConfirmModal(true)
      return
    }
  }

  const performSave = async () => {
    try {
      setSaving(true)
      setError('')
      setShowConfirmModal(false)

      const answersToSave = Object.entries(answers)
        .filter(([_, answer]) => answer && answer !== '')
        .map(([questionId, answer]) => ({ questionId, answer }))

      if (answersToSave.length === 0) {
        setError('请先回答至少一个问题')
        return
      }

      const res = await api.post('/answers/batch-assist', {
        targetUserId: targetId,
        answers: answersToSave
      })

      if (res.success) {
        // 保存成功后更新原始答案
        setOriginalAnswers({ ...answers })
        alert(`成功保存 ${answersToSave.length} 个回答`)
      } else {
        setError(res.error || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      setError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <Link href="/assist">
                  <Button variant="outline">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    返回协助页面
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const currentLayerConfig = LAYERS[currentLayer]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 animate-fade-in">
          <Button
            variant="ghost"
            className="gap-2 mb-4"
            onClick={handleBackClick}
          >
            <ArrowLeft className="h-4 w-4" />
            返回协助页面
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-12 h-12 bg-gradient-to-br ${currentLayerConfig.color} rounded-xl flex items-center justify-center shadow-lg`}>
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">协助回答问题</h1>
              <p className="text-gray-600 mt-1">
                {targetUser && `为 ${targetUser.name} 回答问题`}
                {relationType && ` (${relationType === 'family' ? '家人' : '朋友'}${specificRelation ? ` - ${specificRelation}` : ''})`}
              </p>
            </div>
          </div>
        </div>

        <Card className={`mb-6 bg-gradient-to-br ${currentLayerConfig.bg} border-2 ${currentLayerConfig.borderColor} animate-slide-up`}>
          <CardContent className="pt-6">
            <div className="flex gap-3 flex-wrap">
              {(Object.keys(LAYERS) as Layer[]).map(layer => {
                const layerConfig = LAYERS[layer]
                const isActive = currentLayer === layer
                return (
                  <Button
                    key={layer}
                    onClick={() => setCurrentLayer(layer)}
                    className={`gap-2 transition-all duration-300 ${
                      isActive
                        ? `bg-gradient-to-r ${layerConfig.color} text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5`
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <div className="text-left">
                      <div className="font-medium">{layerConfig.label}</div>
                      <div className="text-xs opacity-80">{layerConfig.description}</div>
                    </div>
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {questions.map((question, index) => (
            <Card
              key={question._id}
              className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-slide-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <CardHeader>
                <CardTitle className="text-lg text-gray-900">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br ${currentLayerConfig.color} text-white text-sm mr-2`}>
                    {question.order}
                  </span>
                  {question.questionText}
                </CardTitle>
              </CardHeader>
              {/* 状态标签 */}
              <div className="px-6 pb-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusLabel(getQuestionStatus(question._id)).className}`}>
                  {getStatusLabel(getQuestionStatus(question._id)).text}
                </span>
              </div>
              <CardContent>
                {question.questionType === 'choice' && question.options ? (
                  <div className="space-y-3">
                    {question.options.map((option, optionIndex) => (
                      <div
                        key={optionIndex}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 ${
                          answers[question._id] === option
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          id={`${question._id}-${optionIndex}`}
                          name={question._id}
                          value={option}
                          checked={answers[question._id] === option}
                          onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                          className="w-4 h-4 text-orange-600"
                        />
                        <Label htmlFor={`${question._id}-${optionIndex}`} className="flex-1 cursor-pointer">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                ) : question.questionType === 'textarea' ? (
                  <textarea
                    value={answers[question._id] || ''}
                    onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                    placeholder="请输入您的回答..."
                    className="w-full min-h-[120px] px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all duration-300 resize-none"
                  />
                ) : (
                  <Input
                    type="text"
                    value={answers[question._id] || ''}
                    onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                    placeholder="请输入您的回答..."
                    className="h-12 border-2 border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all duration-300"
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 智能定位保存按钮 - 滚动时固定，到达底部时停在页脚上方 */}
        {questions.length > 0 && (
          <div className="sticky bottom-0 left-0 right-0 z-40 mt-8 pb-6">
            <div className="max-w-md mx-auto">
              <Button
                onClick={handleSave}
                disabled={saving}
                size="lg"
                className={`w-full gap-2 h-14 rounded-2xl font-medium transition-all duration-300 ${
                  hasChanges
                    ? 'ripple-waves bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] border-2 border-orange-400'
                    : 'bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-600 shadow-md hover:shadow-lg border-2 border-gray-200'
                }`}
              >
                {saving ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    保存中...
                  </div>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    {hasChanges ? `保存回答 (${changedCount})` : '保存回答'}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {questions.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-gray-500">暂无问题</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 修改确认弹窗 */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="确认修改"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              以下 <span className="font-semibold text-orange-600">{getModifiedQuestions().length}</span> 个问题的答案已修改：
            </p>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-3">
            {getModifiedQuestions().map((q, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">问题 {q.order}</div>
                <div className="text-sm font-medium text-gray-900 mb-2">{q.questionText}</div>
                <div className="text-sm text-gray-600 bg-white p-2 rounded border">
                  {q.newAnswer || '(空)'}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
              className="flex-1"
            >
              重新考虑
            </Button>
            <Button
              onClick={performSave}
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  保存中...
                </div>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  确定；提交修改
                </span>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 离开确认弹窗 */}
      <Modal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        title="离开页面"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              您有 <span className="font-semibold text-amber-600">{changedCount}</span> 个未保存的修改，确定要离开吗？
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleLeaveWithoutSave}
              className="flex-1"
            >
              <LogOut className="w-4 h-4 mr-2" />
              不保存离开
            </Button>
            <Button
              onClick={handleLeaveAndSave}
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  保存中...
                </div>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  保存
                </span>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function AssistQuestionsPage() {
  return (
    <Suspense fallback={<div className="text-center py-8">加载中...</div>}>
      <AssistQuestionsContent />
    </Suspense>
  )
}
