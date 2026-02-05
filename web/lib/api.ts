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

    return data;
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

// 导出 api 对象以兼容 import { api } from '@/lib/api'
export const api = {
  get,
  post,
  put,
  del,
  postAuth
};
