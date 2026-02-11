const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

/**
 * 获取token
 */
function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token')
  }
  return null
}

/**
 * API请求基础函数
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data: T; error?: string }> {
  const token = getAuthToken()

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    }
  })

  const data = await response.json()

  if (!response.ok) {
    return {
      success: false,
      error: data.message || '请求失败',
      data: data as T
    }
  }

  return data
}

/**
 * 创建会话
 */
export async function createSession(params: {
  targetUniqueCode: string
  roleCardMode: 'dynamic' | 'static'
  systemPrompt?: string
}) {
  return apiRequest('/chat/sessions/by-code', {
    method: 'POST',
    body: JSON.stringify(params)
  })
}

/**
 * 发送消息
 */
export async function sendMessage(sessionId: string, message: string) {
  return apiRequest(`/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message })
  })
}

/**
 * 获取消息历史
 */
export async function getMessages(sessionId: string) {
  return apiRequest(`/chat/sessions/${sessionId}/messages`)
}

/**
 * 结束会话
 */
export async function endSession(sessionId: string) {
  return apiRequest(`/chat/sessions/${sessionId}/end`, {
    method: 'POST'
  })
}

/**
 * 获取会话统计
 */
export async function getChatStats() {
  return apiRequest('/chat/stats')
}

/**
 * 获取陌生人好感度
 */
export async function getStrangerSentiment(strangerId: string) {
  return apiRequest(`/chat/sentiment/${strangerId}`)
}
