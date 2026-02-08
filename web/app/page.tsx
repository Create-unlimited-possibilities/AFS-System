'use client'

import Link from 'next/link'
import { FileText, Users, Lock, Sparkles, ArrowRight, Heart, BookOpen, Shield } from 'lucide-react'
import CloudPattern from '@/components/decorations/CloudPattern'

export default function Home() {
  return (
    <div className="min-h-screen gradient-bg overflow-hidden">
      <div className="container mx-auto px-4 py-16 relative">
        <div className="absolute top-20 left-10 opacity-10 animate-float">
          <CloudPattern className="w-32 h-16 text-orange-500" />
        </div>
        <div className="absolute top-40 right-20 opacity-10 animate-float" style={{ animationDelay: '1s' }}>
          <CloudPattern className="w-24 h-12 text-orange-600" />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-full text-sm font-medium mb-6 animate-scale-in">
              <Sparkles className="w-4 h-4" />
              传承家族记忆，记录人生故事
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              传家之宝
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500 mt-2">
                家族记忆传承系统
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              用心记录，让珍贵的回忆永远流传，成为家族的精神财富
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up">
              <Link
                href="/login"
                className="group relative px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 w-full sm:w-auto text-lg font-medium ripple-effect"
              >
                立即开始
                <ArrowRight className="inline-block ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/dashboard"
                className="group px-8 py-4 bg-white text-orange-600 border-2 border-orange-200 rounded-2xl hover:border-orange-400 hover:bg-orange-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 w-full sm:w-auto text-lg font-medium"
              >
                查看演示
              </Link>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
            {[
              {
                icon: FileText,
                title: '问卷收集',
                description: '精心设计的人生问题，收集珍贵的生活记忆',
                color: 'from-blue-500 to-blue-600',
                delay: 0
              },
              {
                icon: Users,
                title: '家人协作',
                description: '邀请家人朋友共同参与，丰富记忆内容',
                color: 'from-purple-500 to-purple-600',
                delay: 1
              },
              {
                icon: BookOpen,
                title: '记忆档案',
                description: '构建完整的家族记忆库，永远保存珍贵故事',
                color: 'from-pink-500 to-pink-600',
                delay: 2
              },
              {
                icon: Lock,
                title: '隐私保护',
                description: '安全加密存储，只在授权范围内分享',
                color: 'from-green-500 to-green-600',
                delay: 3
              }
            ].map((feature, index) => {
              const Icon = feature.icon
              return (
                <div
                  key={index}
                  className="card-traditional p-6 animate-slide-up relative group"
                  style={{ animationDelay: `${feature.delay * 0.15}s` }}
                >
                  <div className="absolute top-0 right-0 w-16 h-16 opacity-5">
                    <CloudPattern className="w-full h-full" />
                  </div>
                  <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="mt-20 bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-12 border border-orange-100 animate-scale-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center gap-3">
                <Heart className="w-8 h-8 text-red-500 animate-pulse-slow" />
                <h2 className="text-3xl font-bold text-gray-900">核心功能</h2>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Sparkles,
                  title: '人生记忆收集',
                  description: '通过精心设计的问题体系，收集人生各个阶段的重要记忆和故事',
                  delay: 0
                },
                {
                  icon: Users,
                  title: '家人协作参与',
                  description: '邀请家人朋友共同参与回答，从不同视角丰富人生故事',
                  delay: 1
                },
                {
                  icon: BookOpen,
                  title: '数字化传承',
                  description: '将珍贵的家族记忆数字化保存，构建永不过时的精神财富',
                  delay: 2
                }
              ].map((item, index) => {
                const Icon = item.icon
                return (
                  <div
                    key={index}
                    className="text-center group animate-slide-up"
                    style={{ animationDelay: `${item.delay * 0.1}s` }}
                  >
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-md">
                      <Icon className="w-8 h-8 text-orange-600" />
                    </div>
                    <h3 className="text-lg font-bold mb-3 text-gray-900 flex items-center justify-center gap-2">
                      <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                      {item.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-16 grid md:grid-cols-2 gap-6">
            {[
              {
                icon: Shield,
                title: '安全可靠',
                description: '采用银行级加密技术，确保您的隐私安全',
                bg: 'from-blue-50 to-indigo-50',
                borderColor: 'border-blue-200'
              },
              {
                icon: BookOpen,
                title: '永久保存',
                description: '云端存储，随时随地访问，永不丢失',
                bg: 'from-amber-50 to-orange-50',
                borderColor: 'border-amber-200'
              }
            ].map((item, index) => {
              const Icon = item.icon
              return (
                <div
                  key={index}
                  className={`bg-gradient-to-br ${item.bg} rounded-2xl p-6 border ${item.borderColor} hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-slide-up`}
                  style={{ animationDelay: `${0.4 + index * 0.1}s` }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                      <Icon className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold mb-2 text-gray-900">{item.title}</h3>
                      <p className="text-gray-600 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
