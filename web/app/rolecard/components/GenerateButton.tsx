'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2 } from 'lucide-react'

interface GenerateButtonProps {
  isGenerating: boolean
  isDisabled: boolean
  hasRoleCard?: boolean  // 是否已有角色卡
  progress?: {
    current: number
    total: number
    message: string
  }
  onClick: () => void
}

export default function GenerateButton({ isGenerating, isDisabled, hasRoleCard, progress, onClick }: GenerateButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  // 如果已有角色卡，禁用按钮
  const isButtonDisabled = isDisabled || isGenerating || hasRoleCard

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => hasRoleCard && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Button
        onClick={onClick}
        disabled={isButtonDisabled}
        size="lg"
        className={`gap-3 shadow-lg transition-all duration-300 ${
          hasRoleCard
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 hover:shadow-xl transform hover:-translate-y-0.5'
        }`}
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
            <span>{hasRoleCard ? '已生成角色卡' : '生成角色卡'}</span>
          </>
        )}
      </Button>

      {/* Tooltip 提示 */}
      {showTooltip && hasRoleCard && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap z-50 animate-in fade-in-0 zoom-in-95 duration-200">
          已生成角色卡，请使用「管理角色卡」功能
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  )
}
