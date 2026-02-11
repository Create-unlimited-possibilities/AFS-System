'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function ChatPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const [sessionId, setSessionId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '你好！我是AI陪伴助手，请问有什么可以帮您的？', timestamp: new Date() }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    params.then(p => setSessionId(p.sessionId))
  }, [params])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    setIsLoading(true)

    // 添加用户消息
    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])

    try {
      // 调用LangGraph API（临时模拟）
      const response = await fetch(`http://localhost:3001/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ message: input })
      })

      const data = await response.json()

      if (data.success) {
        // 添加AI消息
        const aiMessage: Message = {
          role: 'assistant',
          content: data.message,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, aiMessage])
      } else {
        console.error('API Error:', data.error)
      }
    } catch (error) {
      console.error('Send Error:', error)
    } finally {
      setIsLoading(false)
      setInput('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* 左侧导航栏 */}
      <aside className="w-16 bg-white border-r border-gray-200 flex flex-col">
        <a href="/chat/new" className="p-4 hover:bg-gray-50 border-b border-gray-200">
          <ArrowLeft className="w-5 h-5" />
          创建会话
        </a>
      </aside>

      {/* 中间聊天区域 */}
      <main className="flex-1 flex flex-col">
        {/* 聊天标题 */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">AI对话</h1>
        </header>

        {/* 消息历史区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-6 py-3 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
                    : 'bg-white text-gray-900 border border-gray-200'
                }`}
              >
                <p className="text-sm md:text-base leading-relaxed">
                  {msg.content}
                </p>
                <span
                  className={`text-xs ${
                    msg.role === 'user' ? 'text-orange-100' : 'text-gray-500'
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 输入区域 */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <Input
              type="text"
              placeholder="输入消息..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  handleSend()
                }
              }}
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              size="lg"
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin">⟳</span>
                  发送中...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  发送
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
