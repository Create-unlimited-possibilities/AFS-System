'use client'

import { useState, useEffect, useRef } from 'react'
import { HelpCircle, X, Shield, ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react'

export default function SafetyGuardrailsHelpPopover() {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      window.addEventListener('keydown', handleEscape)
    }
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger Button - 最小 44x44px 触摸区域 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 rounded-full hover:bg-red-50 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
        title="查看安全护栏说明"
      >
        <HelpCircle className="h-5 w-5 text-red-500" />
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 animate-in fade-in-0 zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-xl">
            <h3 className="font-semibold text-gray-900 text-sm">安全护栏说明</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-white/50 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3 space-y-4 max-h-80 overflow-y-auto">
            {/* 什么是安全护栏 */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">什么是安全护栏？</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                安全护栏是一套隐私保护机制，用于在群组对话中自动过滤或模糊处理敏感话题，确保用户的隐私信息不会被不当披露。
              </p>
            </div>

            {/* 规则类型 */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">规则类型</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
                  <ShieldAlert className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-red-700 text-sm">硬性规则</span>
                    <p className="text-xs text-red-600 mt-0.5">严格禁止，触及时将直接拒绝或重定向话题</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                  <Shield className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-gray-700 text-sm">软性规则</span>
                    <p className="text-xs text-gray-500 mt-0.5">温和处理，触及时将模糊化回答或转移话题</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 保护范围 */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">保护范围</h4>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">财务信息</span>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">健康状况</span>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">家庭纠纷</span>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">敏感回忆</span>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">个人隐私</span>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">安全相关</span>
              </div>
            </div>

            {/* 处理方式 */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">处理方式</h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-600 rounded text-xs font-medium">1</span>
                  <span>直接拒绝回答敏感问题</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-600 rounded text-xs font-medium">2</span>
                  <span>模糊化处理敏感细节</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-600 rounded text-xs font-medium">3</span>
                  <span>巧妙转移话题方向</span>
                </div>
              </div>
            </div>

            {/* 底部说明 */}
            <div className="pt-2 border-t text-xs text-gray-400">
              安全护栏规则由系统预设，旨在保护用户隐私安全
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
