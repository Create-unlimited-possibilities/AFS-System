'use client'

import { useState, useEffect, useRef } from 'react'
import { HelpCircle, X } from 'lucide-react'

interface HelpItem {
  level: string
  label: string
  description: string
  color: string
}

const intimacyLevels: HelpItem[] = [
  { level: 'distant', label: '疏远', description: '很少交流，关系较淡', color: 'bg-gray-100 text-gray-700' },
  { level: 'casual', label: '普通', description: '偶尔交流，关系一般', color: 'bg-blue-100 text-blue-700' },
  { level: 'close', label: '亲密', description: '经常交流，关系密切', color: 'bg-green-100 text-green-700' },
  { level: 'intimate', label: '非常亲密', description: '无话不谈，关系极深', color: 'bg-pink-100 text-pink-700' },
]

const trustLevels: HelpItem[] = [
  { level: 'tier3_general', label: 'T3 普通信任', description: '基础信任，适合一般话题', color: 'bg-gray-100 text-gray-700' },
  { level: 'tier2_close', label: 'T2 较高信任', description: '较高信任，可分享私人话题', color: 'bg-blue-100 text-blue-700' },
  { level: 'tier1_core', label: 'T1 核心信任', description: '最高信任，可分享敏感信息', color: 'bg-orange-100 text-orange-700' },
]

const relationTypes = [
  { type: 'family', label: '家人', description: '有血缘或婚姻关系的人', icon: '🏠' },
  { type: 'friend', label: '朋友', description: '社交关系中的友人', icon: '👋' },
]

export default function RelationHelpPopover() {
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
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-full hover:bg-red-50 transition-colors cursor-pointer"
        title="查看关系层说明"
      >
        <HelpCircle className="h-4 w-4 text-red-500" />
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 animate-in fade-in-0 zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-xl">
            <h3 className="font-semibold text-gray-900 text-sm">关系层说明</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-white/50 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3 space-y-4 max-h-80 overflow-y-auto">
            {/* 关系类型 */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">关系类型</h4>
              <div className="space-y-1.5">
                {relationTypes.map((item) => (
                  <div key={item.type} className="flex items-start gap-2 text-sm">
                    <span className="text-base">{item.icon}</span>
                    <div>
                      <span className="font-medium text-gray-800">{item.label}</span>
                      <span className="text-gray-500 ml-1">- {item.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 亲密程度 */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">亲密程度</h4>
              <div className="space-y-1.5">
                {intimacyLevels.map((item) => (
                  <div key={item.level} className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.color}`}>
                      {item.label}
                    </span>
                    <span className="text-xs text-gray-600">{item.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 信任等级 */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">信任等级</h4>
              <div className="space-y-1.5">
                {trustLevels.map((item) => (
                  <div key={item.level} className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.color}`}>
                      {item.label}
                    </span>
                    <span className="text-xs text-gray-600">{item.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 底部说明 */}
            <div className="pt-2 border-t text-xs text-gray-400">
              信任等级由系统根据答案内容自动分析得出
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
