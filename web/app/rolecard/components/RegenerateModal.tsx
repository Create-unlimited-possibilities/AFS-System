'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { getLayersStatus } from '@/lib/api'
import { Loader2 } from 'lucide-react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface LayersStatus {
  coreLayer: { exists: boolean; generatedAt?: string }
  calibrationLayer: { exists: boolean }
  safetyGuardrails: { loaded: boolean }
  relations: Array<{
    relationId: string
    assistantId: string
    assistantName: string
    specificRelation: string
    relationshipType: 'family' | 'friend'
    status: 'generated' | 'not_generated' | 'insufficient_answers'
    answerCount: number
    generatedAt?: string
  }>
}

interface RegenerateModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

interface GeneratingState {
  type: 'core' | 'relation' | 'batch' | null
  targetId?: string
  progress: number
  message: string
  current?: number
  total?: number
}

// Helper function to get token
const getToken = (): string | undefined => {
  if (typeof window === 'undefined') return undefined
  try {
    return localStorage.getItem('token') || undefined
  } catch {
    return undefined
  }
}

// Status badge component
function StatusBadge({ status, answerCount }: { status: string; answerCount?: number }) {
  switch (status) {
    case 'generated':
      return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">已生成</span>
    case 'not_generated':
      return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">待生成</span>
    case 'insufficient_answers':
      return <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">答案不足 ({answerCount || 0}/3)</span>
    default:
      return null
  }
}

export default function RegenerateModal({ isOpen, onClose, onComplete }: RegenerateModalProps) {
  const [status, setStatus] = useState<LayersStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState<GeneratingState | null>(null)

  // Load layers status
  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getLayersStatus()
      if (res.success && res.data) {
        setStatus(res.data)
      }
    } catch (error) {
      console.error('Failed to load status:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadStatus()
    }
  }, [isOpen, loadStatus])

  // SSE reader helper
  const readSSE = async (
    response: Response,
    onProgress: (data: any) => void,
    onComplete: () => void,
    onError: (error: string) => void
  ) => {
    const reader = response.body?.getReader()
    if (!reader) {
      onError('Unable to read response stream')
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let currentEventType = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()

          if (trimmedLine.startsWith('event: ')) {
            currentEventType = trimmedLine.substring(7).trim()
          } else if (trimmedLine.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmedLine.substring(6).trim())

              if (currentEventType === 'progress') {
                onProgress(data)
              } else if (currentEventType === 'done') {
                if (data.success) {
                  onComplete()
                } else {
                  onError(data.error || 'Generation failed')
                }
                return
              } else if (currentEventType === 'error') {
                onError(data.error || 'Generation failed')
                return
              }
            } catch (parseError) {
              console.error('[RegenerateModal] JSON parse error:', parseError)
            }

            currentEventType = ''
          }
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Stream read error')
    }
  }

  // Generate core layer
  const generateCore = () => {
    setGenerating({ type: 'core', progress: 0, message: '开始生成...' })

    const token = getToken()
    fetch(`${API_BASE_URL}/api/rolecard/layers/core/stream`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      readSSE(
        response,
        (data) => {
          setGenerating(prev => prev ? {
            ...prev,
            progress: data.percentage || 0,
            message: data.message || 'Processing...'
          } : null)
        },
        () => {
          setGenerating(null)
          loadStatus()
          onComplete()
        },
        (error) => {
          console.error('Core layer generation failed:', error)
          setGenerating(null)
        }
      )
    }).catch(error => {
      console.error('Core layer generation failed:', error)
      setGenerating(null)
    })
  }

  // Generate single relation layer
  const generateRelation = (relationId: string, assistantName: string) => {
    setGenerating({
      type: 'relation',
      targetId: relationId,
      progress: 0,
      message: `开始生成 ${assistantName} 的关系层...`
    })

    const token = getToken()
    fetch(`${API_BASE_URL}/api/rolecard/layers/relation/${relationId}/stream`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      readSSE(
        response,
        (data) => {
          setGenerating(prev => prev ? {
            ...prev,
            progress: data.percentage || 0,
            message: data.message || 'Processing...'
          } : null)
        },
        () => {
          setGenerating(null)
          loadStatus()
          onComplete()
        },
        (error) => {
          console.error('Relation layer generation failed:', error)
          setGenerating(null)
        }
      )
    }).catch(error => {
      console.error('Relation layer generation failed:', error)
      setGenerating(null)
    })
  }

  // Batch generate all pending relation layers
  const generateBatch = () => {
    if (!status) return

    const pendingRelations = status.relations
      .filter(r => r.status === 'not_generated')
      .map(r => `relation:${r.relationId}`)

    if (pendingRelations.length === 0) return

    setGenerating({
      type: 'batch',
      progress: 0,
      message: '开始批量生成...',
      total: pendingRelations.length,
      current: 0
    })

    const token = getToken()
    fetch(`${API_BASE_URL}/api/rolecard/layers/batch/stream`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ layers: pendingRelations })
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      readSSE(
        response,
        (data) => {
          setGenerating(prev => prev ? {
            ...prev,
            progress: data.percentage || 0,
            message: data.message || 'Processing...',
            current: data.current,
            total: data.total
          } : null)
        },
        () => {
          setGenerating(null)
          loadStatus()
          onComplete()
        },
        (error) => {
          console.error('Batch generation failed:', error)
          setGenerating(null)
        }
      )
    }).catch(error => {
      console.error('Batch generation failed:', error)
      setGenerating(null)
    })
  }

  // Regenerate all (starts with core layer)
  const regenerateAll = () => {
    generateCore()
  }

  // Handle backdrop click
  const handleBackdropClick = () => {
    if (!generating) {
      onClose()
    }
  }

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

  if (!isOpen) return null

  const pendingRelations = status?.relations.filter(r => r.status !== 'generated') || []
  const generatedRelations = status?.relations.filter(r => r.status === 'generated') || []
  const hasPending = pendingRelations.some(r => r.status === 'not_generated')

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />

      {/* Modal content */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[480px] mx-4 max-h-[70vh] sm:max-h-[80vh] flex flex-col animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">管理角色卡</h2>
          <button
            onClick={generating ? undefined : onClose}
            disabled={!!generating}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          ) : status ? (
            <>
              {/* Core layer section */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-500">核心层</h3>

                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">核心层</span>
                    <StatusBadge status={status.coreLayer.exists ? 'generated' : 'not_generated'} />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={generateCore}
                    disabled={!!generating}
                  >
                    {generating?.type === 'core' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      status.coreLayer.exists ? '重新生成' : '生成'
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">校准层</span>
                    <StatusBadge status={status.calibrationLayer.exists ? 'generated' : 'not_generated'} />
                  </div>
                  <span className="text-xs text-gray-400">自动跟随核心层</span>
                </div>

                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">安全护栏</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">已加载</span>
                  </div>
                  <span className="text-xs text-gray-400">全局配置</span>
                </div>
              </div>

              <div className="border-t" />

              {/* Pending relation layers */}
              {pendingRelations.length > 0 && (
                <>
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-500">关系层 - 待生成</h3>

                    {pendingRelations.map((relation) => (
                      <div key={relation.relationId} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">{relation.assistantName}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">({relation.specificRelation || '关系'})</span>
                          <StatusBadge
                            status={relation.status}
                            answerCount={relation.answerCount}
                          />
                        </div>
                        {relation.status === 'insufficient_answers' ? (
                          <Button size="sm" variant="outline" disabled className="opacity-50 flex-shrink-0">
                            --
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 flex-shrink-0"
                            onClick={() => generateRelation(relation.relationId, relation.assistantName)}
                            disabled={!!generating}
                          >
                            {generating?.type === 'relation' && generating?.targetId === relation.relationId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              '生成'
                            )}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {hasPending && (
                    <Button
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                      onClick={generateBatch}
                      disabled={!!generating}
                    >
                      {generating?.type === 'batch' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          生成中...
                        </>
                      ) : (
                        '生成全部未生成的关系层'
                      )}
                    </Button>
                  )}

                  <div className="border-t" />
                </>
              )}

              {/* Generated relation layers */}
              {generatedRelations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-500">关系层 - 已生成</h3>

                  {generatedRelations.map((relation) => (
                    <div key={relation.relationId} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{relation.assistantName}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">({relation.specificRelation || '关系'})</span>
                        <StatusBadge status="generated" />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateRelation(relation.relationId, relation.assistantName)}
                        disabled={!!generating}
                        className="flex-shrink-0"
                      >
                        {generating?.type === 'relation' && generating?.targetId === relation.relationId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          '重新生成'
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state for relations */}
              {status.relations.length === 0 && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  暂无协助关系
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">
              加载失败，请重试
            </div>
          )}
        </div>

        {/* Progress bar */}
        {generating && (
          <div className="px-4 py-3 border-t bg-gray-50 flex-shrink-0">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-300"
                style={{ width: `${generating.progress}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-500">{generating.message}</p>
              {generating.total !== undefined && generating.current !== undefined && (
                <p className="text-xs text-gray-400">{generating.current}/{generating.total}</p>
              )}
            </div>
          </div>
        )}

        {/* Footer buttons */}
        <div className="p-4 border-t flex-shrink-0">
          <Button
            className="w-full"
            variant="outline"
            onClick={regenerateAll}
            disabled={!!generating}
          >
            {generating?.type === 'core' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                生成中...
              </>
            ) : (
              '全部重新生成'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
