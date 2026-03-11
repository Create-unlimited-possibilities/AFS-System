'use client'

import { Trees } from 'lucide-react'

interface XiaoShuDongEntryProps {
  isSelected: boolean
  onClick: () => void
}

export function XiaoShuDongEntry({ isSelected, onClick }: XiaoShuDongEntryProps) {
  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer border-b border-gray-200 transition-colors ${
        isSelected
          ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-l-purple-500'
          : 'hover:bg-purple-50/50'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Special icon for XiaoShuDong - no avatar */}
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0 shadow-md">
          <Trees className="w-6 h-6 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 text-base">小树洞</span>
            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">AI倾听者</span>
          </div>
          <div className="text-sm text-gray-500 truncate mt-0.5">
            在这里，你可以安心倾诉...
          </div>
        </div>
      </div>
    </div>
  )
}
