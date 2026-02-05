import Link from "next/link"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              传家之宝 - 家族记忆传承系统
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              传承家族记忆，记录人生故事，让珍贵的回忆永远流传
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/login"
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                立即开始
              </Link>
              <Link
                href="/dashboard"
                className="px-8 py-3 bg-white text-green-600 border-2 border-green-600 rounded-lg hover:bg-green-50 transition-colors"
              >
                查看演示
              </Link>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-xl font-semibold mb-2">问卷收集</h3>
              <p className="text-gray-600">
                精心设计的人生问题，收集珍贵的生活记忆
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">👨‍👩‍👧‍👦</div>
              <h3 className="text-xl font-semibold mb-2">家人协作</h3>
              <p className="text-gray-600">
                邀请家人朋友共同参与，丰富记忆内容
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-xl font-semibold mb-2">记忆档案</h3>
              <p className="text-gray-600">
                构建完整的家族记忆库，永远保存珍贵故事
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🔐</div>
              <h3 className="text-xl font-semibold mb-2">隐私保护</h3>
              <p className="text-gray-600">
                安全加密存储，只在授权范围内分享
              </p>
            </div>
          </div>

          <div className="mt-16 bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold mb-6 text-center">核心功能</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  人生记忆收集
                </h3>
                <p className="text-gray-600">
                  通过精心设计的问题体系，收集人生各个阶段的重要记忆和故事
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  家人协作参与
                </h3>
                <p className="text-gray-600">
                  邀请家人朋友共同参与回答，从不同视角丰富人生故事
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  数字化传承
                </h3>
                <p className="text-gray-600">
                  将珍贵的家族记忆数字化保存，构建永不过时的精神财富
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
