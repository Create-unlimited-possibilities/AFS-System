'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { AssistantGuideline } from '@/types'
import { MessageSquare, ChevronDown, ChevronUp, Calendar, RefreshCw, FileText } from 'lucide-react'

interface GuidelinesViewerProps {
  guidelines?: AssistantGuideline[]
  isLoading?: boolean
}

export default function GuidelinesViewer({ guidelines, isLoading = false }: GuidelinesViewerProps) {
  const [expandedGuidelines, setExpandedGuidelines] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<'family' | 'friend'>>(new Set())

  const toggleGuideline = (assistantId: string) => {
    const newExpanded = new Set(expandedGuidelines)
    if (newExpanded.has(assistantId)) {
      newExpanded.delete(assistantId)
    } else {
      newExpanded.add(assistantId)
    }
    setExpandedGuidelines(newExpanded)
  }

  const toggleGroup = (type: 'family' | 'friend') => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(type)) {
      newExpanded.delete(type)
    } else {
      newExpanded.add(type)
    }
    setExpandedGroups(newExpanded)
  }

  // 按关系类型分组
  const familyGuidelines = guidelines?.filter(g => g.relationType === 'family') || []
  const friendGuidelines = guidelines?.filter(g => g.relationType === 'friend') || []

  const GuidelineCard = ({ guideline, index }: { guideline: AssistantGuideline; index: number }) => {
    const isExpanded = expandedGuidelines.has(guideline.assistantId)
    const relationIcon = guideline.relationType === 'family' ? '👨‍👩‍👧‍👦' : '🤝'

    return (
      <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-orange-500 mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl" role="img" aria-label="关系类型图标">
                {relationIcon}
              </span>
              <div>
                <CardTitle className="text-base font-semibold">
                  {guideline.assistantName}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full font-medium">
                    {guideline.specificRelation}
                  </span>
                  <span className="text-xs text-gray-500">
                    {guideline.assistantUniqueCode}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleGuideline(guideline.assistantId)}
              className="gap-1"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  <span className="hidden sm:inline">收起</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  <span className="hidden sm:inline">展开</span>
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-4">
            {/* 对话准则 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-orange-600" />
                <h4 className="font-semibold text-sm">对话准则</h4>
              </div>
              <div className="p-3 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-100">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {guideline.conversationGuidelines}
                </p>
              </div>
            </div>

            {/* 压缩答案数量 */}
            {guideline.compressedAnswers && guideline.compressedAnswers.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-gray-700">
                    压缩答案: <span className="font-semibold text-blue-600">{guideline.compressedAnswers.length}</span> 条
                  </span>
                </div>
              </div>
            )}

            {/* 时间信息 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Calendar className="h-3 w-3" />
                <div>
                  <div>生成于</div>
                  <div className="font-medium text-gray-700">
                    {new Date(guideline.generatedAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              </div>
              {guideline.updatedAt !== guideline.generatedAt && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <RefreshCw className="h-3 w-3" />
                  <div>
                    <div>更新于</div>
                    <div className="font-medium text-gray-700">
                      {new Date(guideline.updatedAt).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 状态标签 */}
            <div className="flex items-center gap-2">
              {guideline.isValid ? (
                <span className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                  ✓ 有效
                </span>
              ) : (
                <span className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                  ✗ 无效
                </span>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  const GroupSection = ({ type, guidelines, title, icon }: {
    type: 'family' | 'friend'
    guidelines: AssistantGuideline[]
    title: string
    icon: string
  }) => {
    const isExpanded = expandedGroups.has(type)

    return (
      <div className="mb-6">
        <div
          className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 cursor-pointer hover:shadow-md transition-all duration-300"
          onClick={() => toggleGroup(type)}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label="组图标">
              {icon}
            </span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <div className="text-sm text-gray-600 mt-1">
                {guidelines.length} 位协助者
              </div>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-600" />
          )}
        </div>

        {isExpanded && (
          <div className="mt-4 space-y-4">
            {guidelines.length > 0 ? (
              guidelines.map((guideline, index) => (
                <GuidelineCard key={guideline.assistantId} guideline={guideline} index={index} />
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>暂无{title}协助者</p>
                <p className="text-sm mt-1">请先添加协助关系</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.3s' }}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-orange-600" />
          <CardTitle className="flex items-center gap-2">
            协助者对话准则
            {guidelines && guidelines.length > 0 && (
              <span className="text-sm font-normal text-gray-600">
                （{guidelines.length} 位协助者）
              </span>
            )}
          </CardTitle>
        </div>
        <CardDescription>
          查看所有协助者为您的角色卡生成的对话准则
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 mx-auto mb-3 text-orange-600 animate-spin" />
            <p className="text-gray-600">加载中...</p>
          </div>
        ) : guidelines && guidelines.length > 0 ? (
          <div className="space-y-6">
            <GroupSection
              type="family"
              guidelines={familyGuidelines}
              title="家人"
              icon="👨‍👩‍👧‍👦"
            />
            <GroupSection
              type="friend"
              guidelines={friendGuidelines}
              title="朋友"
              icon="🤝"
            />
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">暂无对话准则</p>
            <p className="text-sm mb-4">请先生成角色卡，对话准则将自动生成</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
