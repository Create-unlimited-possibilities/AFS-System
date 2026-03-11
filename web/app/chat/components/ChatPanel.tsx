'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Send, Loader2, AlertCircle, Lightbulb } from 'lucide-react'
import Link from 'next/link'

interface Contact {
  targetUserId: string
  targetUserName: string
  targetUniqueCode: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  pending?: boolean
  streaming?: boolean
  failed?: boolean
  error?: string
}

interface ChatPanelProps {
  contact: Contact | null
  messages: Message[]
  isLoading: boolean
  onSend: (message: string) => void
  onBack?: () => void
  isMobile?: boolean
  hasCompleteBirthInfo?: boolean
}

/**
 * Format message content, styling parenthetical actions/descriptions
 * Example: (微笑着说)你好啊
 */
function formatMessageContent(content: string) {
  // Guard against undefined/null content
  if (!content || typeof content !== 'string') {
    return <span></span>
  }

  const parts = content.split(/([（(][^）)]*[）)])/g)

  return parts.map((part, index) => {
    if (/^[（(][^）)]*[）)]$/.test(part)) {
      return (
        <span key={index} className="text-gray-400 italic text-xs">
          {part}
        </span>
      )
    }
    return <span key={index}>{part}</span>
  })
}

export function ChatPanel({
  contact,
  messages,
  isLoading,
  onSend,
  onBack,
  isMobile,
  hasCompleteBirthInfo = true
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    onSend(input)
    setInput('')
  }

  // Check if this is XiaoShuDong
  const isXiaoShuDong = contact?.targetUserId === 'xiaoshudong'

  // Get username from localStorage for welcome message
  const getUsername = () => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        try {
          const user = JSON.parse(userStr)
          return user.username || '朋友'
        } catch {
          return '朋友'
        }
      }
    }
    return '朋友'
  }

  // Generate welcome message for XiaoShuDong
  const getWelcomeMessage = () => {
    return `HI，${getUsername()}，今天有什么心事要和我分享吗？`
  }

  // No contact selected
  if (!contact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Please select a contact to start chatting</p>
      </div>
    )
  }

  return (
    <div className="flex-1 w-full md:w-auto flex flex-col bg-gray-50">
      {/* Header */}
      <header className={`px-4 py-3 flex items-center shrink-0 ${
        isXiaoShuDong
          ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200'
          : 'bg-white border-b border-gray-200'
      }`}>
        {isMobile && onBack && (
          <button onClick={onBack} className="mr-3 p-1">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div>
          <h1 className={`font-bold ${isXiaoShuDong ? 'text-purple-900' : 'text-gray-900'}`}>
            {contact.targetUserName}
          </h1>
          <p className={`text-xs ${isXiaoShuDong ? 'text-purple-600' : 'text-gray-500'}`}>
            #{contact.targetUniqueCode}
          </p>
        </div>
      </header>

      {/* Birth Info Reminder for XiaoShuDong */}
      {isXiaoShuDong && !hasCompleteBirthInfo && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 shrink-0">
          <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 flex-1">
            Complete your birth info for personalized advice
          </p>
          <Link
            href="/profile"
            className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-2 py-1 rounded-full transition-colors"
          >
            Complete
          </Link>
        </div>
      )}

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${
        isXiaoShuDong ? 'bg-gradient-to-b from-purple-50/30 to-pink-50/30' : ''
      }`}>
        {/* XiaoShuDong welcome message */}
        {isXiaoShuDong && messages.length === 0 && (
          <div className="flex justify-start">
            <div className="bg-gradient-to-br from-purple-100 to-pink-100 border border-purple-200 rounded-2xl px-4 py-3 max-w-[80%]">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {getWelcomeMessage()}
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-1`}
          >
            {/* Failed warning icon - user message left */}
            {msg.role === 'user' && msg.failed && (
              <div className="flex-shrink-0 mb-1" title={msg.error || 'Send failed'}>
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
            )}

            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                msg.role === 'user'
                  ? msg.failed
                    ? 'bg-gray-300 text-gray-600'
                    : 'bg-gradient-to-r from-orange-500 to-orange-600 text-black'
                  : 'bg-white border border-gray-200 text-black'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{formatMessageContent(msg.content)}</p>
              <span className="text-xs text-gray-500 mt-1 block">
                {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                {msg.failed && <span className="text-red-500 ml-1">· Failed</span>}
              </span>
            </div>

            {/* Failed warning icon - assistant message right */}
            {msg.role === 'assistant' && msg.failed && (
              <div className="flex-shrink-0 mb-1" title={msg.error || 'Send failed'}>
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className={`rounded-2xl px-4 py-2 flex items-center gap-2 ${
              isXiaoShuDong
                ? 'bg-purple-100 border border-purple-200'
                : 'bg-white border border-gray-200'
            }`}>
              <Loader2 className={`w-4 h-4 animate-spin ${
                isXiaoShuDong ? 'text-purple-500' : 'text-orange-500'
              }`} />
              <span className={`text-sm ${
                isXiaoShuDong ? 'text-purple-700' : 'text-gray-500'
              }`}>
                {isXiaoShuDong ? '正在思考...' : '正在输入中...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-3 shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            className="flex-1 px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full disabled:opacity-50"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
