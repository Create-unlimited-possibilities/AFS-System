'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Send, Mic, Save, MessageSquare, FileText, Sparkles } from 'lucide-react'

type Layer = 'basic' | 'emotional'

interface Question {
  _id: string
  category: string
  questionText: string
  questionType: 'text' | 'textarea' | 'choice'
  options?: string[]
  order: number
}

interface Answer {
  questionId: string
  answer: string
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

export default function QuestionsPage() {
  const { user } = useAuthStore()
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<{ [key: string]: string }>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentLayer, setCurrentLayer] = useState<Layer>('basic')
  const [currentCategory, setCurrentCategory] = useState('all')

  useEffect(() => {
    fetchQuestions()
  }, [currentLayer])

  const fetchQuestions = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/questions?layer=${currentLayer}&role=elder`)

      if (res && res.success && res.questions) {
        setQuestions(res.questions || [])

        // 直接从 res.questions 中提取答案
        const answersMap: { [key: string]: string } = {}
        res.questions.forEach((q: any) => {
          if (q.answer && q._id) {
            answersMap[q._id] = q.answer
          }
        })
        setAnswers(answersMap)
      } else {
        console.error('获取问题失败: 响应格式不正确', res)
        setQuestions([])
        setAnswers({})
      }
    } catch (error) {
      console.error('获取问题失败:', error)
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

  const handleSave = async () => {
    try {
      setSaving(true)
      await api.post('/answers/batch-self', {
        answers: Object.entries(answers).map(([questionId, answer]) => ({
          questionId,
          answer
        }))
      })
      alert('保存成功！')
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const categories = ['all', ...Array.from(new Set(questions.map(q => q.category)))]
  const filteredQuestions = currentCategory === 'all'
    ? questions
    : questions.filter(q => q.category === currentCategory)

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

  const currentLayerConfig = LAYERS[currentLayer]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-12 h-12 bg-gradient-to-br ${currentLayerConfig.color} rounded-xl flex items-center justify-center shadow-lg`}>
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">回答问题</h1>
              <p className="text-gray-600 mt-1">
                请填写以下问题，保存您珍贵的记忆和经历
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
                    onClick={() => {
                      setCurrentLayer(layer)
                      setCurrentCategory('all')
                    }}
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

        <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex gap-2 flex-wrap">
            {categories.map(category => {
              const isActive = currentCategory === category
              return (
                <Button
                  key={category}
                  onClick={() => setCurrentCategory(category)}
                  size="sm"
                  className={`transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md hover:shadow-lg'
                      : 'bg-white text-gray-600 hover:bg-orange-50 hover:text-orange-600 border border-gray-200'
                  }`}
                >
                  {category === 'all' ? '全部' : category}
                </Button>
              )
            })}
          </div>
        </div>

        <div className="space-y-6">
          {filteredQuestions.map((question, index) => (
            <Card
              key={question._id}
              className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-slide-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 bg-gradient-to-br ${currentLayerConfig.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg text-gray-900">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br ${currentLayerConfig.color} text-white text-sm mr-2`}>
                        {question.order}
                      </span>
                      {question.questionText}
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-500 mt-1">{question.category}</CardDescription>
                  </div>
                </div>
              </CardHeader>
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

        {filteredQuestions.length > 0 && (
          <div className="mt-8 flex gap-4 animate-slide-up">
            <Button
              onClick={handleSave}
              disabled={saving}
              size="lg"
              className="gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  保存中...
                </div>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  保存回答
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
