'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Send, Loader2, AlertCircle } from 'lucide-react'

interface Contact {
  targetUserName: string
  targetUniqueCode: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  pending?: boolean
  streaming?: boolean  // 正在流式输出中
  failed?: boolean     // 发送失败
  error?: string       // 错误信息
}

interface ChatPanelProps {
  contact: Contact | null
  messages: Message[]
  isLoading: boolean
  onSend: (message: string) => void
  onBack?: () => void
  isMobile?: boolean
}

/**
 * 格式化消息内容，将括号内的动作/状态描述用特殊样式显示
 * 例如：(微笑着说)你好啊 → <span class="action">(微笑着说)</span>你好啊
 */
function formatMessageContent(content: string) {
  // 匹配中文括号和英文括号
  const parts = content.split(/([（(][^）)]*[）)])/g)

  return parts.map((part, index) => {
    // 检查是否是括号内容
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
  isMobile
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

  // 未选择用户
  if (!contact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">请选择左侧用户开始对话</p>
      </div>
    )
  }

  return (
    <div className="flex-1 w-full md:w-auto flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center shrink-0">
        {isMobile && onBack && (
          <button onClick={onBack} className="mr-3 p-1">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div>
          <h1 className="font-bold text-gray-900">{contact.targetUserName}</h1>
          <p className="text-xs text-gray-500">#{contact.targetUniqueCode}</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-1`}
          >
            {/* 失败警告图标 - 用户消息左侧 */}
            {msg.role === 'user' && msg.failed && (
              <div className="flex-shrink-0 mb-1" title={msg.error || '发送失败'}>
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
            )}

            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                msg.role === 'user'
                  ? msg.failed
                    ? 'bg-gray-300 text-gray-600'  // 失败消息灰色显示
                    : 'bg-gradient-to-r from-orange-500 to-orange-600 text-black'
                  : 'bg-white border border-gray-200 text-black'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{formatMessageContent(msg.content)}</p>
              <span className="text-xs text-gray-500 mt-1 block">
                {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                {msg.failed && <span className="text-red-500 ml-1">· 发送失败</span>}
              </span>
            </div>

            {/* 失败警告图标 - 助手消息右侧（一般不会出现，但保留） */}
            {msg.role === 'assistant' && msg.failed && (
              <div className="flex-shrink-0 mb-1" title={msg.error || '发送失败'}>
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-2 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
              <span className="text-sm text-gray-500">正在输入中...</span>
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
            placeholder="输入消息..."
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
