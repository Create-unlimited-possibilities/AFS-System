'use client'

import { Button } from '@/components/ui/button'
import { Sparkles, Loader2 } from 'lucide-react'

interface GenerateButtonProps {
  isGenerating: boolean
  isDisabled: boolean
  progress?: {
    current: number
    total: number
    message: string
  }
  onClick: () => void
}

export default function GenerateButton({ isGenerating, isDisabled, progress, onClick }: GenerateButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={isDisabled || isGenerating}
      size="lg"
      className="gap-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>
            {progress ? `${progress.message} (${progress.current}/${progress.total})` : '生成中...'}
          </span>
        </>
      ) : (
        <>
          <Sparkles className="h-5 w-5" />
          <span>生成角色卡</span>
        </>
      )}
    </Button>
  )
}
