'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Send, Mic, Save } from 'lucide-react'

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
  basic: { label: '基础层次', description: '日常基本信息相关问题' },
  emotional: { label: '情感层次', description: '深层次情感交流相关问题' }
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
      if (res.data) {
        setQuestions(res.data.questions || [])
        const answersMap: { [key: string]: string } = {}
        res.data.questions.forEach((q: any) => {
          if (q.answer) {
            answersMap[q._id] = q.answer
          }
        })
        setAnswers(answersMap)
      }
    } catch (error) {
      console.error('获取问题失败:', error)
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
        <div className="text-center py-12">加载中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">回答问题</h1>
          <p className="text-muted-foreground">
            请填写以下问题，保存您珍贵的记忆和经历
          </p>
        </div>

        {/* Layer Switcher */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(LAYERS) as Layer[]).map(layer => (
                <Button
                  key={layer}
                  variant={currentLayer === layer ? 'default' : 'outline'}
                  onClick={() => {
                    setCurrentLayer(layer)
                    setCurrentCategory('all')
                  }}
                  className="gap-2"
                >
                  <span>{LAYERS[layer].label}</span>
                  <span className="text-xs text-muted-foreground">
                    {LAYERS[layer].description}
                  </span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Filter */}
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            {categories.map(category => (
              <Button
                key={category}
                variant={currentCategory === category ? 'default' : 'outline'}
                onClick={() => setCurrentCategory(category)}
                size="sm"
              >
                {category === 'all' ? '全部' : category}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {filteredQuestions.map((question) => (
            <Card key={question._id}>
              <CardHeader>
                <CardTitle className="text-lg">
                  <span className="text-muted-foreground mr-2">
                    {question.order}.
                  </span>
                  {question.questionText}
                </CardTitle>
                <CardDescription>{question.category}</CardDescription>
              </CardHeader>
              <CardContent>
                {question.questionType === 'choice' && question.options ? (
                  <div className="space-y-2">
                    {question.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="radio"
                          id={`${question._id}-${index}`}
                          name={question._id}
                          value={option}
                          checked={answers[question._id] === option}
                          onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                          className="w-4 h-4"
                        />
                        <Label htmlFor={`${question._id}-${index}`}>{option}</Label>
                      </div>
                    ))}
                  </div>
                ) : question.questionType === 'textarea' ? (
                  <textarea
                    value={answers[question._id] || ''}
                    onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                    placeholder="请输入您的回答..."
                    className="w-full min-h-[120px] px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                ) : (
                  <Input
                    type="text"
                    value={answers[question._id] || ''}
                    onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                    placeholder="请输入您的回答..."
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredQuestions.length > 0 && (
          <div className="mt-8 flex gap-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              size="lg"
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? '保存中...' : '保存回答'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
