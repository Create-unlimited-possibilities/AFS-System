'use client'

import { useState } from 'react'
import { ArrowRight, FileText, Sparkles, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

export default function NewChatPage() {
  const [step, setStep] = useState(1)
  const [targetUniqueCode, setTargetUniqueCode] = useState('')
  const [roleCardMode, setRoleCardMode] = useState<'dynamic' | 'static'>('dynamic')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!targetUniqueCode.trim()) {
      setError('请输入目标用户的唯一编码')
      return
    }

    if (roleCardMode === 'static' && !systemPrompt.trim()) {
      setError('方法B模式需要提供角色卡system prompt')
      return
    }

    setIsCreating(true)
    setError('')

    setTimeout(() => {
      const sessionId = `chat_${Date.now()}`

      window.location.href = `/chat/${sessionId}`

      setIsCreating(false)
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-16 bg-white border-r border-gray-200 flex flex-col">
        <Link href="/" className="p-4 hover:bg-gray-50 border-b border-gray-200">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
            <path d="M19 12H5m0 0H5a5 5 0 0 0 5-5v11h11a5 5 0 0 0 5-5 5-5h11a5 5 0 0 0 5-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <Link href="/chat/new" className="p-4 bg-orange-50 text-primary font-medium border-b-2 border-orange-200">
          创建会话
        </Link>
        <Link href="/dashboard" className="p-4 hover:bg-gray-50 border-b border-gray-200">
          个人中心
        </Link>
      </aside>

      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-2">
              {[1, 2, 3].map((stepNum) => (
                <div
                  key={stepNum}
                  className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${
                    stepNum < step
                      ? 'bg-orange-500 text-white'
                      : stepNum === step
                      ? 'bg-orange-600 text-white ring-4 ring-orange-300 animate-pulse'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {stepNum}
                </div>
              ))}
            </div>
            <div className="h-1 w-24 bg-gray-200 rounded">
              <div
                className={`h-full bg-orange-500 transition-all duration-500 ${
                  step === 1 ? 'w-1/3' : step === 2 ? 'w-2/3' : step === 3 ? 'w-full' : 'w-0'
                }`}
              ></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-200">
            <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">
              创建AI对话
            </h1>

            {step === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                    1
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">
                    输入目标用户的唯一编码
                  </h2>
                </div>
                <Input
                  type="text"
                  placeholder="请输入唯一编码（例如：ABC123）"
                  value={targetUniqueCode}
                  onChange={e => setTargetUniqueCode(e.target.value)}
                  className="w-full px-4 py-4 text-lg border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                  disabled={step !== 1}
                />
                <div className="flex justify-end">
                  <Button
                    onClick={() => setStep(2)}
                    disabled={!targetUniqueCode.trim()}
                    size="lg"
                    className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                  >
                    下一步
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                    2
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">
                    选择角色卡生成模式
                  </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div
                    className={`p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg ${
                      roleCardMode === 'dynamic'
                        ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-300'
                        : 'border-gray-200 hover:border-orange-300 bg-gray-50'
                    }`}
                    onClick={() => setRoleCardMode('dynamic')}
                  >
                    <div className="flex flex-col items-center mb-3">
                      <Sparkles className="w-12 h-12 text-orange-600" />
                      <h3 className="text-xl font-bold text-gray-900">
                        方法 A：动态生成
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      每次对话时根据上下文动态生成角色卡，支持家人/朋友/陌生人三种关系，包含好感度系统。
                    </p>
                    <div className="mt-auto">
                      <span className="inline-flex items-center text-xs font-medium text-gray-500">
                        <FileText className="w-4 h-4 mr-1" />
                        适合：复杂场景、多样化对话
                      </span>
                    </div>
                  </div>

                  <div
                    className={`p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg ${
                      roleCardMode === 'static'
                        ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-300'
                        : 'border-gray-200 hover:border-orange-300 bg-gray-50'
                    }`}
                    onClick={() => setRoleCardMode('static')}
                  >
                    <div className="flex flex-col items-center mb-3">
                      <Shield className="w-12 h-12 text-orange-600" />
                      <h3 className="text-xl font-bold text-gray-900">
                        方法 B：静态角色卡
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      使用预生成的完整角色卡（Markdown格式），仅支持家人/朋友关系，对话风格固定。
                    </p>
                    <div className="mt-auto">
                      <span className="inline-flex items-center text-xs font-medium text-gray-500">
                        <FileText className="w-4 h-4 mr-1" />
                        适合：快速演示、稳定对话
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-start">
                  <Button
                    onClick={() => {
                      if (roleCardMode === 'static') {
                        setStep(2)
                      } else {
                        setStep(1)
                      }
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <path d="M19 12H5m0 0H5a5 5 0 0 0 5-5v11h11a5 5 0 0 0 5-5 5-5h11a5 5 0 0 0 5-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    返回上一步
                  </Button>
                </div>

                {roleCardMode === 'static' && (
                  <div className="mt-6 pt-6 border-t border-gray-200 animate-fade-in">
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      输入角色卡System Prompt（可选）
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      留空则从文件加载预生成的角色卡
                    </p>
                    <textarea
                      value={systemPrompt}
                      onChange={e => setSystemPrompt(e.target.value)}
                      placeholder="请输入完整的Markdown格式角色卡system prompt..."
                      rows={6}
                      className="w-full px-4 py-3 text-sm border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-50 resize-none"
                      disabled={step !== 2}
                    />
                    <p className="text-xs text-gray-400 mt-2">
                      支持Markdown格式：# 标题 ## 子标题 - 列表项
                    </p>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={handleSubmit}
                    disabled={isCreating || (roleCardMode === 'static' && !systemPrompt.trim())}
                    size="lg"
                    className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                  >
                    {isCreating ? (
                      <>
                        <span className="animate-spin mr-2">⟳</span>
                        创建中...
                      </>
                    ) : (
                      <>
                        创建会话
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="text-center py-12 animate-fade-in">
                <div className="inline-block bg-green-100 text-green-600 p-6 rounded-full mb-4 animate-bounce">
                  <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5l12-12-5c0-10a8 8 0 0 8-8-8 8c0 0 0 8-8zM5 13l4 4L9 9l-8-8-4-4c0-10a8 8 0 0 8-8z" fill="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  会话创建成功！
                </h2>
                <p className="text-gray-600 mb-6">
                  正在跳转到对话页面...
                </p>
              </div>
            )}

            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <path d="M12 8v4m0 6h16M7.8 12L12 12H4M4 12h16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p className="font-medium text-red-700">{error}</p>
                </div>
                <Button
                  onClick={() => setError('')}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  关闭
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      <aside className="w-72 bg-white border-l border-gray-200 p-4 hidden lg:block">
        <h2 className="text-lg font-bold mb-4 text-gray-900">已添加用户</h2>
        <div className="text-sm text-gray-500 mb-4">
          （功能开发中）
        </div>
        <div className="space-y-2">
          {['👨 张三', '👩 李四', '👫 王五'].map((name, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                {name[0]}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{name}</div>
                <div className="text-xs text-gray-500">最近消息示例</div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
