'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Heart, Shield, Settings, Users, Brain, BookOpen, MessageCircle, Quote, Calendar, MapPin, Briefcase, Sparkles, Eye } from 'lucide-react'
import RelationLayerDetailModal from './RelationLayerDetailModal'

// V2 角色卡类型定义 - 与后端实际数据结构一致
interface RoleCardV2 {
  version: string
  userId: string
  coreLayer?: {
    version?: string
    generatedAt?: string
    basicIdentity?: {
      raw?: {
        name?: string
        gender?: string
        birthDate?: string
        age?: number
        birthPlace?: {
          provinceName?: string
          cityName?: string
        }
        residence?: {
          provinceName?: string
          cityName?: string
        }
        occupation?: string
        education?: string
        maritalStatus?: string
        children?: {
          sons?: number
          daughters?: number
        }
        appearanceFeatures?: string
      }
      summary?: string
    }
    personality?: {
      keyPoints?: string[]
      summary?: string
      sourceCount?: number
    }
    communicationStyle?: {
      keyPoints?: string[]
      summary?: string
      sourceCount?: number
    }
    backgroundStory?: {
      keyPoints?: string[]
      summary?: string
      sourceCount?: number
    }
    lifeMilestones?: {
      keyPoints?: string[]
      summary?: string
      sourceCount?: number
    }
    interests?: {
      keyPoints?: string[]
      summary?: string
      sourceCount?: number
    }
    preferences?: {
      keyPoints?: string[]
      summary?: string
      sourceCount?: number
    }
    values?: {
      keyPoints?: string[]
      summary?: string
      sourceCount?: number
    }
    emotionalNeeds?: {
      keyPoints?: string[]
      summary?: string
      sourceCount?: number
    }
    memories?: {
      keyPoints?: string[]
      summary?: string
      sourceCount?: number
    }
    selfPerception?: {
      keyPoints?: string[]
      summary?: string
      sourceCount?: number
    }
    metadata?: {
      sourceAnswerCount?: number
      extractionModel?: string
      compressionModel?: string
    }
  }
  relationLayers?: Record<string, {
    version?: string
    generatedAt?: string
    assistantId?: string
    assistantName?: string
    relationMeta?: {
      specificRelation?: string
      relationType?: string
      isFamily?: boolean
      intimacyLevel?: string
      trustLevel?: string
    }
    relationshipBasis?: {
      summary?: string
      keyPoints?: string[]
    }
    sharedMemories?: {
      summary?: string
      keyPoints?: string[]
    }
    emotionalBond?: {
      summary?: string
      keyPoints?: string[]
    }
    supportDynamics?: {
      summary?: string
      keyPoints?: string[]
    }
  }>
  safetyGuardrails?: {
    rules?: Array<{
      id: string
      type: string
      topic?: {
        category?: string
        description?: string
        keywords?: string[]
      }
      action?: {
        type?: string
        redirectHint?: string
        vagueTemplate?: string
      }
      priority?: number
      enabled?: boolean
    }>
    defaultRuleSet?: string
  }
  calibration?: {
    currentState?: {
      totalConversations?: number
      totalTokens?: number
    }
  }
  generatedAt?: string
  updatedAt?: string
}

interface RoleCardViewerV2Props {
  roleCard: RoleCardV2
}

// 简单的 Badge 替代组件
function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}

export default function RoleCardViewerV2({ roleCard }: RoleCardViewerV2Props) {
  const { coreLayer, relationLayers, safetyGuardrails, calibration, generatedAt } = roleCard

  const relationList = relationLayers ? Object.entries(relationLayers).map(([id, layer]) => ({ id, ...layer })) : []

  // Modal state for relation detail
  const [selectedRelation, setSelectedRelation] = useState<typeof relationList[0] | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleViewDetail = (relation: typeof relationList[0]) => {
    setSelectedRelation(relation)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedRelation(null)
  }

  return (
    <div className="space-y-6">
      {/* 版本信息 */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <Badge className="bg-orange-50 text-orange-700 border border-orange-200">
            V2.0
          </Badge>
          {coreLayer?.version && (
            <Badge className="bg-blue-50 text-blue-700 border border-blue-200">
              Core: {coreLayer.version}
            </Badge>
          )}
        </div>
        {generatedAt && (
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            生成时间: {new Date(generatedAt).toLocaleString('zh-CN')}
          </span>
        )}
      </div>

      {/* 基本身份 */}
      {coreLayer?.basicIdentity?.raw && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-blue-600" />
              基本身份
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {coreLayer.basicIdentity.raw.name && (
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">姓名</div>
                  <div className="font-medium text-blue-700">{coreLayer.basicIdentity.raw.name}</div>
                </div>
              )}
              {coreLayer.basicIdentity.raw.gender && (
                <div className="text-center p-3 bg-pink-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">性别</div>
                  <div className="font-medium text-pink-700">{coreLayer.basicIdentity.raw.gender}</div>
                </div>
              )}
              {coreLayer.basicIdentity.raw.age && (
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">年龄</div>
                  <div className="font-medium text-green-700">{coreLayer.basicIdentity.raw.age}岁</div>
                </div>
              )}
              {coreLayer.basicIdentity.raw.occupation && (
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">职业</div>
                  <div className="font-medium text-amber-700">{coreLayer.basicIdentity.raw.occupation}</div>
                </div>
              )}
            </div>
            {coreLayer.basicIdentity.raw.birthPlace && (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>出生地: {coreLayer.basicIdentity.raw.birthPlace.provinceName} {coreLayer.basicIdentity.raw.birthPlace.cityName}</span>
              </div>
            )}
            {coreLayer.basicIdentity.raw.residence && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>现居地: {coreLayer.basicIdentity.raw.residence.provinceName} {coreLayer.basicIdentity.raw.residence.cityName}</span>
              </div>
            )}
            {coreLayer.basicIdentity.raw.children && (
              <div className="mt-2 text-sm text-gray-600">
                子女: {coreLayer.basicIdentity.raw.children.sons || 0}子 {coreLayer.basicIdentity.raw.children.daughters || 0}女
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 人格特质 */}
      {coreLayer?.personality && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-purple-600" />
              人格特质
            </CardTitle>
            <CardDescription>基于A套问答提取的内在人格特征</CardDescription>
          </CardHeader>
          <CardContent>
            {coreLayer.personality.summary && (
              <p className="text-gray-700 leading-relaxed mb-4">
                {coreLayer.personality.summary}
              </p>
            )}
            {coreLayer.personality.keyPoints && coreLayer.personality.keyPoints.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {coreLayer.personality.keyPoints.map((point, i) => (
                  <Badge key={i} className="bg-purple-50 text-purple-700 border border-purple-200">
                    {point}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 沟通风格 */}
      {coreLayer?.communicationStyle && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="h-5 w-5 text-teal-600" />
              沟通风格
            </CardTitle>
          </CardHeader>
          <CardContent>
            {coreLayer.communicationStyle.summary && (
              <p className="text-gray-700 leading-relaxed mb-4">
                {coreLayer.communicationStyle.summary}
              </p>
            )}
            {coreLayer.communicationStyle.keyPoints && coreLayer.communicationStyle.keyPoints.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {coreLayer.communicationStyle.keyPoints.map((point, i) => (
                  <Badge key={i} className="bg-teal-50 text-teal-700 border border-teal-200">
                    {point}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 价值观 */}
      {coreLayer?.values && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Heart className="h-5 w-5 text-red-600" />
              价值观
            </CardTitle>
          </CardHeader>
          <CardContent>
            {coreLayer.values.summary && (
              <p className="text-gray-700 leading-relaxed mb-4">
                {coreLayer.values.summary}
              </p>
            )}
            {coreLayer.values.keyPoints && coreLayer.values.keyPoints.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {coreLayer.values.keyPoints.map((point, i) => (
                  <Badge key={i} className="bg-red-50 text-red-700 border border-red-200">
                    {point}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 个人背景故事 */}
      {coreLayer?.backgroundStory && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-cyan-600" />
              个人背景
            </CardTitle>
            <CardDescription>从问卷答案中提取的人生经历</CardDescription>
          </CardHeader>
          <CardContent>
            {coreLayer.backgroundStory.summary && (
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">
                {coreLayer.backgroundStory.summary}
              </p>
            )}
            {coreLayer.backgroundStory.keyPoints && coreLayer.backgroundStory.keyPoints.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-gray-500 font-medium">关键要点</div>
                <ul className="list-disc list-inside space-y-1">
                  {coreLayer.backgroundStory.keyPoints.map((point, i) => (
                    <li key={i} className="text-sm text-gray-700">{point}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 人生里程碑 */}
      {coreLayer?.lifeMilestones && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-indigo-600" />
              人生里程碑
            </CardTitle>
          </CardHeader>
          <CardContent>
            {coreLayer.lifeMilestones.summary && (
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">
                {coreLayer.lifeMilestones.summary}
              </p>
            )}
            {coreLayer.lifeMilestones.keyPoints && coreLayer.lifeMilestones.keyPoints.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {coreLayer.lifeMilestones.keyPoints.map((point, i) => (
                  <Badge key={i} className="bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {point}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 兴趣爱好 */}
      {coreLayer?.interests && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-yellow-600" />
              兴趣爱好
            </CardTitle>
          </CardHeader>
          <CardContent>
            {coreLayer.interests.summary && (
              <p className="text-gray-700 leading-relaxed mb-4">
                {coreLayer.interests.summary}
              </p>
            )}
            {coreLayer.interests.keyPoints && coreLayer.interests.keyPoints.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {coreLayer.interests.keyPoints.map((point, i) => (
                  <Badge key={i} className="bg-yellow-50 text-yellow-700 border border-yellow-200">
                    {point}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 偏好 */}
      {coreLayer?.preferences && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-gray-600" />
              个人偏好
            </CardTitle>
          </CardHeader>
          <CardContent>
            {coreLayer.preferences.summary && (
              <p className="text-gray-700 leading-relaxed mb-4">
                {coreLayer.preferences.summary}
              </p>
            )}
            {coreLayer.preferences.keyPoints && coreLayer.preferences.keyPoints.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {coreLayer.preferences.keyPoints.map((point, i) => (
                  <Badge key={i} className="bg-gray-50 text-gray-700 border border-gray-200">
                    {point}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 情感需求 */}
      {coreLayer?.emotionalNeeds && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Heart className="h-5 w-5 text-pink-600" />
              情感需求
            </CardTitle>
          </CardHeader>
          <CardContent>
            {coreLayer.emotionalNeeds.summary && (
              <p className="text-gray-700 leading-relaxed mb-4">
                {coreLayer.emotionalNeeds.summary}
              </p>
            )}
            {coreLayer.emotionalNeeds.keyPoints && coreLayer.emotionalNeeds.keyPoints.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {coreLayer.emotionalNeeds.keyPoints.map((point, i) => (
                  <Badge key={i} className="bg-pink-50 text-pink-700 border border-pink-200">
                    {point}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 重要回忆 */}
      {coreLayer?.memories && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-amber-600" />
              重要回忆
            </CardTitle>
          </CardHeader>
          <CardContent>
            {coreLayer.memories.summary && (
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">
                {coreLayer.memories.summary}
              </p>
            )}
            {coreLayer.memories.keyPoints && coreLayer.memories.keyPoints.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {coreLayer.memories.keyPoints.map((point, i) => (
                  <Badge key={i} className="bg-amber-50 text-amber-700 border border-amber-200">
                    {point}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 自我认知 */}
      {coreLayer?.selfPerception && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-violet-600" />
              自我认知
            </CardTitle>
          </CardHeader>
          <CardContent>
            {coreLayer.selfPerception.summary && (
              <p className="text-gray-700 leading-relaxed mb-4">
                {coreLayer.selfPerception.summary}
              </p>
            )}
            {coreLayer.selfPerception.keyPoints && coreLayer.selfPerception.keyPoints.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {coreLayer.selfPerception.keyPoints.map((point, i) => (
                  <Badge key={i} className="bg-violet-50 text-violet-700 border border-violet-200">
                    {point}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 关系层 */}
      {relationList.length > 0 && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-green-600" />
              关系层 ({relationList.length}个)
            </CardTitle>
            <CardDescription>基于B/C套问答提取的关系特定信息</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {relationList.map((relation, i) => (
                <div key={relation.id || i} className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-green-800 text-lg">
                        {relation.assistantName || '未知'}
                      </span>
                      <button
                        onClick={() => handleViewDetail(relation)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-white hover:bg-green-100 rounded-md border border-green-200 transition-colors cursor-pointer"
                        title="查看详细内容"
                      >
                        <Eye className="h-3 w-3" />
                        查看详细内容
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {relation.relationMeta?.trustLevel && (
                        <Badge className="bg-blue-100 text-blue-700">
                          {relation.relationMeta.trustLevel.replace('tier', 'T').replace('_', ' ')}
                        </Badge>
                      )}
                      <Badge className="bg-white text-gray-700 border border-gray-200">
                        {relation.relationMeta?.specificRelation || '关系'}
                      </Badge>
                    </div>
                  </div>
                  {relation.relationMeta?.intimacyLevel && (
                    <div className="text-sm text-gray-600 mb-2">
                      亲密程度: {relation.relationMeta.intimacyLevel}
                    </div>
                  )}
                  {relation.relationshipBasis?.summary && (
                    <div className="text-sm text-gray-700 mb-2 p-2 bg-white/50 rounded-lg">
                      {relation.relationshipBasis.summary}
                    </div>
                  )}
                  {relation.sharedMemories?.keyPoints && relation.sharedMemories.keyPoints.length > 0 && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">共同回忆：</span>
                      {relation.sharedMemories.keyPoints.join('、')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 安全护栏 */}
      {safetyGuardrails?.rules && safetyGuardrails.rules.length > 0 && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-amber-600" />
              安全护栏 ({safetyGuardrails.rules.length}条规则)
            </CardTitle>
            <CardDescription>群组对话中的隐私保护规则</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {safetyGuardrails.rules.slice(0, 5).map((rule, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Badge className={rule.type === 'hard' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}>
                    {rule.type === 'hard' ? '硬性' : '软性'}
                  </Badge>
                  <span className="text-gray-700">{rule.topic?.description || rule.id}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 校准层统计 */}
      {calibration?.currentState && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-gray-600" />
              校准层状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {calibration.currentState.totalConversations || 0}
                </div>
                <div className="text-sm text-gray-500">对话次数</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {calibration.currentState.totalTokens?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-500">累计Token</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 元数据 */}
      {coreLayer?.metadata && (
        <div className="text-xs text-gray-400 text-right">
          基于 {coreLayer.metadata.sourceAnswerCount || 0} 个答案生成 |
          提取模型: {coreLayer.metadata.extractionModel || '未知'}
        </div>
      )}

      {/* 关系层详情弹窗 */}
      <RelationLayerDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        relation={selectedRelation}
      />
    </div>
  )
}
