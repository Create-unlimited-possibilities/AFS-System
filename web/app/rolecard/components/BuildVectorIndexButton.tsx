'use client'

import { Button } from '@/components/ui/button'
import { Database, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface BuildVectorIndexButtonProps {
  isBuilding: boolean
  isDisabled: boolean
  progress?: {
    current: number
    total: number
    message: string
  }
  status?: {
    exists: boolean
    memoryCount: number
    canBuild: boolean
  }
  onClick: () => void
}

export default function BuildVectorIndexButton({
  isBuilding,
  isDisabled,
  progress,
  status,
  onClick
}: BuildVectorIndexButtonProps) {
  const canBuild = status?.canBuild && !status?.exists;
  const isReady = status?.exists;

  return (
    <Button
      onClick={onClick}
      disabled={isDisabled || isBuilding || !canBuild}
      size="lg"
      className={`gap-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 ${isReady ? 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' : ''}`}
    >
      {isBuilding ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>
            {progress ? `${progress.message} (${progress.current}/${progress.total})` : '构建中...'}
          </span>
        </>
      ) : isReady ? (
        <>
          <CheckCircle className="h-5 w-5" />
          <span>记忆库已构建</span>
        </>
      ) : (
        <>
          <Database className="h-5 w-5" />
          <span>
            {status?.memoryCount === 0 ? '暂无记忆' : '构建记忆库'}
          </span>
        </>
      )}
    </Button>
  )
}
