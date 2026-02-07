'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Answer, Question } from '@/types'
import { FileText, ChevronDown, ChevronUp } from 'lucide-react'

interface MemoryPreviewProps {
  answers?: Answer[]
  basicProgress: { total: number; answered: number }
  emotionalProgress: { total: number; answered: number }
}

export default function MemoryPreview({ answers, basicProgress, emotionalProgress }: MemoryPreviewProps) {
  const [expanded, setExpanded] = useState(true)

  // 计算token数量（估算：中文字符数/2 + 英文单词数）
  const calculateTokens = (text: string): number => {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
    return Math.floor(chineseChars / 2) + englishWords
  }

  // 计算总token数
  const totalTokens = answers?.reduce((sum, answer) => sum + calculateTokens(answer.answer), 0) || 0

  // 按层次分组
  const basicAnswers = answers?.filter(a => a.questionLayer === 'basic') || []
  const emotionalAnswers = answers?.filter(a => a.questionLayer === 'emotional') || []

  return (
    <Card className="hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.2s' }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-600" />
            <CardTitle>记忆预览</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="gap-2"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? '收起' : '展开'}
          </Button>
        </div>
        <CardDescription>
          基于A套问题生成的个人记忆数据
        </CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-6">
          {/* 总体统计 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-100">
              <div className="text-sm text-gray-600 mb-1">总Token数</div>
              <div className="text-2xl font-bold text-orange-600">{totalTokens}</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="text-sm text-gray-600 mb-1">基础层进度</div>
              <div className="text-2xl font-bold text-blue-600">
                {basicProgress.answered}/{basicProgress.total}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {Math.round((basicProgress.answered / basicProgress.total) * 100)}%
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl border border-pink-100">
              <div className="text-sm text-gray-600 mb-1">情感层进度</div>
              <div className="text-2xl font-bold text-pink-600">
                {emotionalProgress.answered}/{emotionalProgress.total}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {Math.round((emotionalProgress.answered / emotionalProgress.total) * 100)}%
              </div>
            </div>
          </div>

          {/* 基础层答案 */}
          {basicAnswers.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-blue-700">基础层答案</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {basicAnswers.map((answer, index) => (
                  <div
                    key={answer._id}
                    className="p-3 bg-white rounded-lg border border-blue-100 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-700 mb-1">
                          问题 {index + 1}
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-2">
                          {answer.question?.question || '无问题内容'}
                        </div>
                      </div>
                      <div className="text-xs text-blue-600 whitespace-nowrap">
                        ~{calculateTokens(answer.answer)} tokens
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 情感层答案 */}
          {emotionalAnswers.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-pink-700">情感层答案</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {emotionalAnswers.map((answer, index) => (
                  <div
                    key={answer._id}
                    className="p-3 bg-white rounded-lg border border-pink-100 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-700 mb-1">
                          问题 {index + 1}
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-2">
                          {answer.question?.question || '无问题内容'}
                        </div>
                      </div>
                      <div className="text-xs text-pink-600 whitespace-nowrap">
                        ~{calculateTokens(answer.answer)} tokens
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 提示信息 */}
          {basicAnswers.length === 0 && emotionalAnswers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>暂无记忆数据</p>
              <p className="text-sm mt-1">请先完成A套问题</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
