'use client'

import { useEffect } from 'react'
import { X, Users, Heart, MessageCircle, Calendar, Sparkles, Shield } from 'lucide-react'

interface RelationLayer {
  id?: string
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
    sourceCount?: number
  }
  sharedMemories?: {
    summary?: string
    keyPoints?: string[]
    sourceCount?: number
  }
  emotionalBond?: {
    summary?: string
    keyPoints?: string[]
    sourceCount?: number
  }
  supportDynamics?: {
    summary?: string
    keyPoints?: string[]
    sourceCount?: number
  }
}

interface RelationLayerDetailModalProps {
  isOpen: boolean
  onClose: () => void
  relation: RelationLayer | null
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}

function SectionCard({
  icon: Icon,
  title,
  colorClass,
  summary,
  keyPoints
}: {
  icon: React.ElementType
  title: string
  colorClass: string
  summary?: string
  keyPoints?: string[]
}) {
  if (!summary && (!keyPoints || keyPoints.length === 0)) return null

  const colorMap: Record<string, { bg: string; text: string; border: string; badge: string }> = {
    green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100', badge: 'bg-green-100 text-green-700 border border-green-200' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', badge: 'bg-blue-100 text-blue-700 border border-blue-200' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100', badge: 'bg-purple-100 text-purple-700 border border-purple-200' },
    pink: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-100', badge: 'bg-pink-100 text-pink-700 border border-pink-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', badge: 'bg-amber-100 text-amber-700 border border-amber-200' },
  }

  const colors = colorMap[colorClass] || colorMap.green

  return (
    <div className={`p-4 rounded-xl ${colors.bg} ${colors.border} border`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${colors.text}`} />
        <h4 className={`font-medium ${colors.text}`}>{title}</h4>
      </div>
      {summary && (
        <p className="text-sm text-gray-700 leading-relaxed mb-3">{summary}</p>
      )}
      {keyPoints && keyPoints.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keyPoints.map((point, i) => (
            <Badge key={i} className={colors.badge}>
              {point}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RelationLayerDetailModal({ isOpen, onClose, relation }: RelationLayerDetailModalProps) {
  // Prevent scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleEscape)
    }
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen || !relation) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {relation.assistantName || '协助者'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-white text-gray-700 border border-gray-200">
                  {relation.relationMeta?.specificRelation || '关系'}
                </Badge>
                {relation.relationMeta?.relationType && (
                  <Badge className={
                    relation.relationMeta.relationType === 'family'
                      ? 'bg-orange-100 text-orange-700 border border-orange-200'
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }>
                    {relation.relationMeta.relationType === 'family' ? '家人' : '朋友'}
                  </Badge>
                )}
                {relation.relationMeta?.trustLevel && (
                  <Badge className="bg-purple-100 text-purple-700 border border-purple-200">
                    {relation.relationMeta.trustLevel.replace('tier', 'T').replace('_', ' ')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="关闭"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Meta info */}
          {relation.relationMeta?.intimacyLevel && (
            <div className="flex items-center gap-2 text-sm text-gray-600 px-1">
              <Heart className="h-4 w-4 text-pink-500" />
              <span>亲密程度: <span className="font-medium text-gray-700">{relation.relationMeta.intimacyLevel}</span></span>
            </div>
          )}

          {/* Relationship Basis */}
          <SectionCard
            icon={Users}
            title="关系基础"
            colorClass="green"
            summary={relation.relationshipBasis?.summary}
            keyPoints={relation.relationshipBasis?.keyPoints}
          />

          {/* Shared Memories */}
          <SectionCard
            icon={Calendar}
            title="共同回忆"
            colorClass="amber"
            summary={relation.sharedMemories?.summary}
            keyPoints={relation.sharedMemories?.keyPoints}
          />

          {/* Emotional Bond */}
          <SectionCard
            icon={Heart}
            title="情感纽带"
            colorClass="pink"
            summary={relation.emotionalBond?.summary}
            keyPoints={relation.emotionalBond?.keyPoints}
          />

          {/* Support Dynamics */}
          <SectionCard
            icon={Shield}
            title="支持动态"
            colorClass="blue"
            summary={relation.supportDynamics?.summary}
            keyPoints={relation.supportDynamics?.keyPoints}
          />

          {/* Metadata */}
          {relation.generatedAt && (
            <div className="text-xs text-gray-400 text-right pt-2 border-t">
              生成时间: {new Date(relation.generatedAt).toLocaleString('zh-CN')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
