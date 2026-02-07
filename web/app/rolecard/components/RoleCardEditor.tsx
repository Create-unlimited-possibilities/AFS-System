'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { RoleCardExtended } from '@/types'
import { User, Save, X, Plus, Tag } from 'lucide-react'

interface RoleCardEditorProps {
  roleCard?: RoleCardExtended
  onSave: (roleCard: Partial<RoleCardExtended>) => void
  onCancel: () => void
  readOnly?: boolean
}

export default function RoleCardEditor({ roleCard, onSave, onCancel, readOnly = false }: RoleCardEditorProps) {
  const [formData, setFormData] = useState<Partial<RoleCardExtended>>(roleCard || {})
  const [newTag, setNewTag] = useState('')

  const handleSave = () => {
    onSave(formData)
  }

  const handleAddTag = (field: 'interests' | 'values' | 'emotionalNeeds' | 'preferences' | 'memories' | 'lifeMilestones') => {
    if (!newTag.trim()) return
    const currentArray = formData[field] || []
    setFormData({
      ...formData,
      [field]: [...currentArray, newTag.trim()]
    })
    setNewTag('')
  }

  const handleRemoveTag = (field: 'interests' | 'values' | 'emotionalNeeds' | 'preferences' | 'memories' | 'lifeMilestones', index: number) => {
    const currentArray = formData[field] || []
    setFormData({
      ...formData,
      [field]: currentArray.filter((_, i) => i !== index)
    })
  }

  const TagInput = ({ field, label }: { field: 'interests' | 'values' | 'emotionalNeeds' | 'preferences' | 'memories' | 'lifeMilestones'; label: string }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder={`添加${label}...`}
            value={newTag}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTag(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddTag(field)
              }
            }}
            disabled={readOnly}
            className="flex-1"
          />
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddTag(field)}
              disabled={!newTag.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        {formData[field] && formData[field].length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData[field].map((tag, index) => (
              <div key={index} className="flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-700 rounded-lg text-sm">
                <Tag className="h-4 w-4" />
                <span>{tag}</span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(field, index)}
                    className="text-orange-500 hover:text-orange-700 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <Card className="hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.1s' }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-orange-600" />
              个人画像
            </CardTitle>
            <CardDescription>查看和编辑您的角色卡个人画像</CardDescription>
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onCancel}>
                <X className="h-4 w-4 mr-1" />
                取消
              </Button>
              <Button size="sm" onClick={handleSave} className="gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700">
                <Save className="h-4 w-4" />
                保存
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="personality">性格特点</Label>
          <Textarea
            id="personality"
            placeholder="描述您的性格特点..."
            value={formData.personality || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, personality: e.target.value })}
            disabled={readOnly}
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="background">生活背景</Label>
          <Textarea
            id="background"
            placeholder="描述您的生活背景..."
            value={formData.background || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, background: e.target.value })}
            disabled={readOnly}
            rows={3}
          />
        </div>

        <TagInput field="interests" label="兴趣爱好" />

        <div>
          <Label htmlFor="communicationStyle">沟通风格</Label>
          <Textarea
            id="communicationStyle"
            placeholder="描述您的沟通风格..."
            value={formData.communicationStyle || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, communicationStyle: e.target.value })}
            disabled={readOnly}
            rows={3}
          />
        </div>

        <TagInput field="values" label="价值观" />
        <TagInput field="emotionalNeeds" label="情感需求" />
        <TagInput field="preferences" label="偏好" />
        <TagInput field="memories" label="重要记忆" />
        <TagInput field="lifeMilestones" label="人生里程碑" />

        {roleCard?.strangerInitialSentiment !== undefined && (
          <div>
            <Label>陌生人初始好感度</Label>
            <div className="text-2xl font-bold text-orange-600">
              {formData.strangerInitialSentiment ?? roleCard.strangerInitialSentiment} / 100
            </div>
            <p className="text-sm text-gray-600 mt-1">
              这是陌生人第一次与您对话时的初始好感度分数
            </p>
          </div>
        )}

        {formData.memoryTokenCount && (
          <div className="text-sm text-gray-600">
            记忆Token数: <span className="font-semibold">{formData.memoryTokenCount}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
