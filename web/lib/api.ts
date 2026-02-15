const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const API_URL = `${API_BASE_URL}/api`;

export interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  message?: string;
  status?: number;
  data?: T;
}



// 为了兼容登录/注册等直接返回数据的响应
export interface AuthResponse {
  success: boolean;
  user?: any;
  token?: string;
  error?: string;
  status?: number;
}

// 导入AI陪伴功能所需的类型
import type {
  RoleCardExtended,
  ChatSession,
  Message,
  StrangerSentiment,
  SentimentRecord,
  SentimentHistoryItem
} from '@/types';

// 从 localStorage 获取 token 的辅助函数
const getToken = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    const token = localStorage.getItem('token');
    return token || undefined;
  } catch {
    return undefined;
  }
};

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${endpoint}`;

  // 收集所有 headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // 添加用户传入的 headers
  if (options.headers) {
    const userHeaders = options.headers as Record<string, string>;
    Object.keys(userHeaders).forEach(key => {
      headers[key] = userHeaders[key];
    });
  }

  // 自动添加 Authorization header（如果没有提供）
  if (!headers['Authorization'] && typeof window !== 'undefined') {
    const token = getToken();
    if (token) {
      console.log('[API] Sending request with token:', token.substring(0, 20) + '...');
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.log('[API] No token found in localStorage');
    }
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || '请求失败',
        status: response.status
      };
    }

    return data as ApiResponse<T>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络错误',
    };
  }
}

export async function get<T = any>(endpoint: string, token?: string): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {};

  // 如果传入了 token 参数，使用它；否则让 apiRequest 自动获取
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return apiRequest<T>(endpoint, { method: 'GET', headers });
}

export async function post<T = any>(endpoint: string, body: any, token?: string): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return apiRequest<T>(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// 专用于认证请求的 post 方法，返回 AuthResponse 格式
export async function postAuth(endpoint: string, body: any): Promise<AuthResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const url = `${API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || '请求失败',
        status: response.status
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络错误',
    };
  }
}

export async function put<T = any>(endpoint: string, body: any, token?: string): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return apiRequest<T>(endpoint, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
}

export async function del<T = any>(endpoint: string, token?: string): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return apiRequest<T>(endpoint, { method: 'DELETE', headers });
}

// ============================================
// AI陪伴功能 - 角色卡相关API
// ============================================

export async function getRoleCard(token?: string): Promise<ApiResponse<{ roleCard: RoleCardExtended }>> {
  return get<{ roleCard: RoleCardExtended }>('/rolecard', token);
}

export async function generateRoleCard(token?: string): Promise<ApiResponse<{
  roleCard: RoleCardExtended;
  tokenCount: number;
  assistantsProcessed: number;
  processingTime: number;
}>> {
  return post<{ roleCard: RoleCardExtended; tokenCount: number; assistantsProcessed: number; processingTime: number }>('/rolecard/generate', {}, token);
}

export async function updateRoleCard(roleCard: Partial<RoleCardExtended>, token?: string): Promise<ApiResponse<RoleCardExtended>> {
  return put<RoleCardExtended>('/rolecard', roleCard, token);
}

export async function regenerateAssistantGuidelines(assistantId: string, token?: string): Promise<ApiResponse<{ success: boolean }>> {
  return post<{ success: boolean }>(`/rolecard/assistants/${assistantId}/regenerate`, {}, token);
}

// ============================================
// AI陪伴功能 - 对话相关API
// ============================================

export async function createChatSessionByCode(targetUniqueCode: string, token?: string): Promise<ApiResponse<ChatSession>> {
  return post<ChatSession>('/chat/sessions/by-code', { targetUniqueCode }, token);
}

export async function sendMessage(sessionId: string, message: string, token?: string): Promise<ApiResponse<{
  message: string;
  sessionId: string;
  metadata: {
    retrievedMemoriesCount: number;
    modelUsed: string;
    relationType: string;
    sentimentScore: number;
  };
}>> {
  return post<{ message: string; sessionId: string; metadata: any }>(`/chat/sessions/${sessionId}/messages`, { message }, token);
}

export async function getChatMessages(sessionId: string, token?: string): Promise<ApiResponse<{ messages: Message[] }>> {
  return get<{ messages: Message[] }>(`/chat/sessions/${sessionId}/messages`, token);
}

export async function endChatSession(sessionId: string, token?: string): Promise<ApiResponse<{ success: boolean }>> {
  return post<{ success: boolean }>(`/chat/sessions/${sessionId}/end`, {}, token);
}

export async function getActiveSessions(token?: string): Promise<ApiResponse<{ sessions: ChatSession[] }>> {
  return get<{ sessions: ChatSession[] }>('/chat/sessions/active', token);
}

export async function getChatStats(token?: string): Promise<ApiResponse<{
  totalSessions: number;
  totalMessages: number;
  averageMessagesPerSession: number;
}>> {
  return get<{ totalSessions: number; totalMessages: number; averageMessagesPerSession: number }>('/chat/stats', token);
}

// ============================================
// AI陪伴功能 - 好感度相关API
// ============================================

export async function getSentiment(targetUserId: string, strangerId: string, token?: string): Promise<ApiResponse<StrangerSentiment>> {
  return get<StrangerSentiment>(`/sentiment/${targetUserId}/${strangerId}`, token);
}

export async function updateSentiment(targetUserId: string, strangerId: string, data: {
  message: string;
  conversationHistory?: Message[];
}, token?: string): Promise<ApiResponse<SentimentRecord>> {
  return put<SentimentRecord>(`/sentiment/${targetUserId}/${strangerId}`, data, token);
}

export async function getSentimentStats(targetUserId: string, token?: string): Promise<ApiResponse<{
  totalStrangers: number;
  averageScore: number;
  scoreDistribution: Record<string, number>;
  recentUpdates: Array<{
    strangerId: string;
    timestamp: string;
    score: number;
  }>;
}>> {
  return get(`/sentiment/${targetUserId}/stats`, token);
}

export async function getSentimentHistory(targetUserId: string, strangerId: string, token?: string): Promise<ApiResponse<{ history: SentimentHistoryItem[] }>> {
  return get<{ history: SentimentHistoryItem[] }>(`/sentiment/${targetUserId}/${strangerId}/history`, token);
}

export async function buildVectorIndex(
  onProgress: (data: any) => void,
  onComplete?: () => void,
  onError?: (error: Error) => void
) {
  const token = getToken();
  if (!token) {
    throw new Error('未登录');
  }

  const response = await fetch(`${API_URL}/rolecard/vector-index/build`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('无法读取响应流');
  }

  let buffer = '';
  let currentEventType = '';

  return new Promise<void>(async (resolve, reject) => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();

          if (trimmedLine.startsWith('event: ')) {
            currentEventType = trimmedLine.substring(7).trim();
          } else if (trimmedLine.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmedLine.substring(6).trim());

              if (currentEventType === 'progress') {
                onProgress(data);
              } else if (currentEventType === 'done') {
                if (data.success) {
                  if (onComplete) onComplete();
                  resolve();
                } else {
                  const error = new Error(data.error || '构建失败');
                  if (onError) onError(error);
                  reject(error);
                }
              } else if (currentEventType === 'error') {
                const error = new Error(data.error || '构建失败');
                if (onError) onError(error);
                reject(error);
              }
            } catch (parseError) {
              console.error('[buildVectorIndex] JSON解析失败:', parseError);
            }

            currentEventType = '';
          }
        }
      }
    } catch (error) {
      reject(error as Error);
    }
  });
}

export async function getVectorIndexStatus() {
  return apiRequest<{
    success: boolean;
    status?: {
      exists: boolean;
      memoryCount: number;
      hasRoleCard: boolean;
      canBuild: boolean;
      totalDocuments?: number;
      collectionName?: string;
    }
  }>('/rolecard/vector-index/status');
}

// 导出 api 对象以兼容 import { api } from '@/lib/api'
export const api = {
  get,
  post,
  put,
  del,
  postAuth
};
