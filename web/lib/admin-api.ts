import { apiRequest, API_URL } from './api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Get admin token from separate storage key
const getAdminToken = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    const token = localStorage.getItem('admin_token');
    return token || undefined;
  } catch {
    return undefined;
  }
};

// Admin-specific API request function that uses admin_token
export async function adminApiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add user-provided headers
  if (options.headers) {
    const userHeaders = options.headers as Record<string, string>;
    Object.keys(userHeaders).forEach(key => {
      headers[key] = userHeaders[key];
    });
  }

  // Use admin_token for authentication
  if (!headers['Authorization'] && typeof window !== 'undefined') {
    const token = getAdminToken();
    if (token) {
      console.log('[AdminAPI] Sending request with admin token:', token.substring(0, 20) + '...');
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.log('[AdminAPI] No admin token found in localStorage');
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
        error: data.error || 'Request failed',
      } as T;
    }

    // Return the response body directly (which contains success: true, data/vars/etc)
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    } as T;
  }
}

// Admin Authentication Types
export interface AdminRegisterRequest {
  email: string;
  password: string;
  name: string;
  inviteCode: string;
}

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface InviteCode {
  _id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  isValid: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateInviteCodeRequest {
  maxUses: number;
  expiresIn?: number; // hours
}

// Admin Authentication API
export async function adminRegister(data: AdminRegisterRequest): Promise<{
  success: boolean;
  user?: any;
  token?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export async function adminLogin(data: AdminLoginRequest): Promise<{
  success: boolean;
  user?: any;
  token?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// Invite Code Management API
export async function getInviteCodes(): Promise<{
  success: boolean;
  codes?: InviteCode[];
  error?: string;
}> {
  return adminApiRequest('/admin/invite-codes');
}

export async function createInviteCode(data: CreateInviteCodeRequest): Promise<{
  success: boolean;
  code?: InviteCode;
  error?: string;
}> {
  return adminApiRequest('/admin/invite-codes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteInviteCode(codeId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return adminApiRequest(`/admin/invite-codes/${codeId}`, {
    method: 'DELETE',
  });
}

export async function validateInviteCode(code: string): Promise<{
  success: boolean;
  valid?: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin-auth/validate-invite/${code}`, {
      method: 'GET',
    });
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ============================================
// User Management API
// ============================================

export interface UserProfile {
  gender?: string;
  birthDate?: string;
  birthHour?: string;
  birthCalendar?: string;
  birthPlace?: {
    provinceCode?: string;
    provinceName?: string;
    cityCode?: string;
    cityName?: string;
  };
  residence?: {
    provinceCode?: string;
    provinceName?: string;
    cityCode?: string;
    cityName?: string;
  };
  nationality?: string;
  ethnicity?: string;
  occupation?: string;
  education?: string;
  maritalStatus?: string;
  children?: {
    sons?: number;
    daughters?: number;
  };
  height?: string;
  appearanceFeatures?: string;
}

export interface ProfileCompletion {
  isComplete: boolean;
  missingFields: string[];
}

export interface AdminUser {
  _id: string;
  id?: string;
  uniqueCode: string;
  email: string;
  name: string;
  isActive: boolean;
  role?: {
    _id: string;
    name: string;
    permissions: Array<{ name: string }>;
  } | null;
  createdAt: string;
  lastLogin?: string;
  chatBeta?: {
    memoryTokenCount?: number;
  };
  companionChat?: {
    roleCard?: any;
  };
  profile?: UserProfile;
  profileCompletion?: ProfileCompletion;
  hasPassword?: boolean;
}

export interface UserListResponse {
  success: boolean;
  users?: AdminUser[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  activeUserCount?: number;
  error?: string;
}

export interface UserFilters {
  search?: string;
  role?: string;
  isActive?: boolean | null;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getUsers(filters: UserFilters = {}): Promise<UserListResponse> {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.role) params.append('role', filters.role);
  if (filters.isActive !== null && filters.isActive !== undefined) {
    params.append('isActive', String(filters.isActive));
  }
  params.append('page', String(filters.page || 1));
  params.append('limit', String(filters.limit || 10));
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

  return adminApiRequest(`/admin/users?${params.toString()}`);
}

export async function getUser(userId: string): Promise<{
  success: boolean;
  user?: AdminUser;
  error?: string;
}> {
  return adminApiRequest(`/admin/users/${userId}`);
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  isActive?: boolean;
  roleId?: string;
}

export async function updateUser(userId: string, data: UpdateUserData): Promise<{
  success: boolean;
  user?: AdminUser;
  error?: string;
}> {
  return adminApiRequest(`/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteUser(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return adminApiRequest(`/admin/users/${userId}`, {
    method: 'DELETE',
  });
}

export async function toggleUserStatus(userId: string, isActive: boolean): Promise<{
  success: boolean;
  user?: AdminUser;
  error?: string;
}> {
  return adminApiRequest(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

/**
 * Reset user password (admin action)
 */
export async function resetUserPassword(userId: string, newPassword: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  return adminApiRequest(`/admin/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });
}

// ============================================
// Questionnaire Management API
// ============================================

export type QuestionRole = 'elder' | 'family' | 'friend';
export type QuestionLayer = 'basic' | 'emotional';
export type QuestionType = 'text' | 'textarea' | 'voice';

export interface AdminQuestion {
  _id: string;
  role: QuestionRole;
  layer: QuestionLayer;
  order: number;
  question: string;
  placeholder?: string;
  type: QuestionType;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionFormData {
  role: QuestionRole;
  layer: QuestionLayer;
  question: string;
  placeholder?: string;
  type: QuestionType;
  active: boolean;
  order?: number;
}

export interface QuestionFilters {
  role?: QuestionRole | 'all';
  layer?: QuestionLayer | 'all';
  active?: boolean | null;
  search?: string;
}

export async function getQuestions(filters: QuestionFilters = {}): Promise<{
  success: boolean;
  questions?: AdminQuestion[];
  error?: string;
}> {
  const params = new URLSearchParams();
  if (filters.role && filters.role !== 'all') params.append('role', filters.role);
  if (filters.layer && filters.layer !== 'all') params.append('layer', filters.layer);
  if (filters.active !== null && filters.active !== undefined) {
    params.append('active', String(filters.active));
  }
  if (filters.search) params.append('search', filters.search);

  const query = params.toString() ? `?${params.toString()}` : '';
  return adminApiRequest(`/admin/questions${query}`);
}

export async function getQuestion(questionId: string): Promise<{
  success: boolean;
  question?: AdminQuestion;
  error?: string;
}> {
  return adminApiRequest(`/admin/questions/${questionId}`);
}

export async function createQuestion(data: QuestionFormData): Promise<{
  success: boolean;
  question?: AdminQuestion;
  error?: string;
}> {
  return adminApiRequest('/admin/questions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateQuestion(questionId: string, data: Partial<QuestionFormData>): Promise<{
  success: boolean;
  question?: AdminQuestion;
  error?: string;
}> {
  return adminApiRequest(`/admin/questions/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteQuestion(questionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return adminApiRequest(`/admin/questions/${questionId}`, {
    method: 'DELETE',
  });
}

export async function reorderQuestion(questionId: string, newOrder: number): Promise<{
  success: boolean;
  error?: string;
}> {
  return adminApiRequest(`/admin/questions/${questionId}/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ order: newOrder }),
  });
}

export async function toggleQuestionStatus(questionId: string, active: boolean): Promise<{
  success: boolean;
  question?: AdminQuestion;
  error?: string;
}> {
  return adminApiRequest(`/admin/questions/${questionId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  });
}

export async function batchImportQuestions(data: QuestionFormData[]): Promise<{
  success: boolean;
  imported?: number;
  failed?: number;
  errors?: Array<{ question: string; error: string }>;
  error?: string;
}> {
  return adminApiRequest('/admin/questions/batch-import', {
    method: 'POST',
    body: JSON.stringify({ questions: data }),
  });
}

export async function exportQuestions(filters: QuestionFilters = {}): Promise<{
  success: boolean;
  questions?: AdminQuestion[];
  error?: string;
}> {
  const params = new URLSearchParams();
  if (filters.role && filters.role !== 'all') params.append('role', filters.role);
  if (filters.layer && filters.layer !== 'all') params.append('layer', filters.layer);

  const query = params.toString() ? `?${params.toString()}` : '';
  return adminApiRequest(`/admin/questions/export${query}`);
}

// ============================================
// Memory Management API
// ============================================

export interface UserMemorySummary {
  _id: string;
  id?: string;
  name: string;
  uniqueCode: string;
  email: string;
  memoryCount: number;
  vectorIndexExists: boolean;
  lastMemoryUpdate?: string;
  roleCardGenerated?: boolean;
}

export interface UserMemory {
  _id: string;
  userId: string;
  category: 'self' | 'family' | 'friend' | 'rolecard' | 'xiaoshudong';
  content: string;
  sourceType: 'answer' | 'manual' | 'imported' | 'conversation';
  sourceId?: string;
  tags?: string[];
  partnerId?: string; // For conversation memories
  indexed?: boolean; // For conversation memories
  createdAt: string;
  updatedAt: string;
  // New fields for conversation memories
  rawMessages?: Array<{
    role: 'user' | 'assistant';
    content: string;
    isOwner?: boolean;
  }>;
  summary?: string | null;
  keyTopics?: string[];
  facts?: string[];
  messageCount?: number;
}

export interface Partner {
  id: string;
  name: string;
  memoryCount: number;
  category: string;
}

export interface UserMemoryData {
  memories: UserMemory[];
  vectorIndex: VectorIndexStatus;
  partners: Partner[];
}

export interface VectorIndexStatus {
  exists: boolean;
  memoryCount: number;
  hasRoleCard: boolean;
  canBuild: boolean;
  totalDocuments?: number;
  collectionName?: string;
  lastBuildTime?: string;
}

export async function getUserMemories(filters?: {
  search?: string;
  hasVectorIndex?: boolean;
  page?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  users?: UserMemorySummary[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}> {
  const params = new URLSearchParams();
  if (filters?.search) params.append('search', filters.search);
  if (filters?.hasVectorIndex !== undefined) {
    params.append('hasVectorIndex', String(filters.hasVectorIndex));
  }
  params.append('page', String(filters?.page || 1));
  params.append('limit', String(filters?.limit || 20));

  return adminApiRequest(`/admin/memories/user-summaries?${params.toString()}`);
}

export async function getUserMemoryData(userId: string): Promise<{
  success: boolean;
  memories?: UserMemory[];
  vectorIndex?: VectorIndexStatus;
  partners?: Partner[];
  error?: string;
}> {
  return adminApiRequest<UserMemoryData>(`/admin/memories/${userId}`) as any;
}

export async function getVectorIndexStatus(userId: string): Promise<{
  success: boolean;
  status?: VectorIndexStatus;
  error?: string;
}> {
  return adminApiRequest<{ status: VectorIndexStatus }>(`/admin/memories/${userId}/vector-status`) as any;
}

export async function rebuildVectorIndex(userId: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  return adminApiRequest(`/admin/memories/${userId}/rebuild-index`, {
    method: 'POST',
  });
}

export async function exportUserMemories(userId: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  return adminApiRequest(`/admin/memories/${userId}/export`);
}

export async function deleteUserMemory(userId: string, memoryId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return adminApiRequest(`/admin/memories/${userId}/memories/${memoryId}`, {
    method: 'DELETE',
  });
}

// ============================================
// Dashboard & System Status API
// ============================================

export interface DashboardStats {
  totalUsers: number;
  newUsersToday: number;
  activeUsers: number;
  totalMemories: number;
  questionnaireCompletionRate: number;
  totalConversations: number;
  pendingDeleteItems?: number;
}

export interface SystemStatus {
  mongodb: {
    connected: boolean;
    latency?: number;
    containerRunning?: boolean;
  };
  chromadb: {
    connected: boolean;
    latency?: number;
    containerRunning?: boolean;
  };
  llm: {
    connected: boolean;
    provider: 'ollama' | 'openai' | 'other';
    model?: string;
    containerRunning?: boolean;
  };
  vectorStore: {
    status: 'ready' | 'building' | 'error' | 'unknown';
    totalIndexes: number;
  };
  ziweiModel?: {
    registered: boolean;
    name: string;
    size?: number;
  };
  checkMethod?: 'http' | 'docker' | 'api';
}

export interface RecentActivity {
  _id: string;
  type: 'user_registered' | 'memory_created' | 'conversation_started' | 'rolecard_generated';
  userId: string;
  userName: string;
  description: string;
  createdAt: string;
}

export async function getDashboardStats(): Promise<{
  success: boolean;
  stats?: DashboardStats;
  error?: string;
}> {
  return adminApiRequest('/admin/dashboard/stats');
}

export async function getSystemStatus(): Promise<{
  success: boolean;
  status?: SystemStatus;
  error?: string;
}> {
  return adminApiRequest<{ status: SystemStatus }>('/admin/dashboard/system-status') as any;
}

/**
 * Get system status using fast Docker container checks
 * This returns in <1 second vs ~30 seconds for HTTP-based checks
 * Checks if Docker containers are running instead of making HTTP requests
 */
export async function getSystemStatusFast(): Promise<{
  success: boolean;
  status?: SystemStatus;
  error?: string;
}> {
  return adminApiRequest<{ status: SystemStatus }>('/admin/dashboard/system-status-fast') as any;
}

export async function getRecentActivity(limit: number = 10): Promise<{
  success: boolean;
  activities?: RecentActivity[];
  error?: string;
}> {
  return adminApiRequest(`/admin/dashboard/activity?limit=${limit}`);
}

export async function getUserGrowthData(days: number = 30): Promise<{
  success: boolean;
  data?: Array<{ date: string; count: number; cumulative: number }>;
  error?: string;
}> {
  return adminApiRequest(`/admin/dashboard/growth?days=${days}`);
}

// ============================================
// Environment Variables API
// ============================================

export interface EnvVar {
  key: string;
  value: string;
  isSecret: boolean;
  isEditable: boolean;
  description?: string;
}

export async function getEnvVars(): Promise<{
  success: boolean;
  vars?: EnvVar[];
  error?: string;
}> {
  const result = await adminApiRequest<{
    success: boolean;
    editable?: Record<string, { value: string; description?: string; type?: string }>;
    readOnly?: Record<string, { value: string; description?: string; type?: string }>;
    sensitive?: Record<string, { value: string; description?: string; type?: string; isSet?: boolean }>;
    error?: string;
  }>('/admin/settings/env/full');

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Transform the response format to EnvVar[]
  const vars: EnvVar[] = [];

  // Add editable variables
  if (result.editable) {
    for (const [key, config] of Object.entries(result.editable)) {
      vars.push({
        key,
        value: config.value || '',
        isSecret: false,
        isEditable: true,
        description: config.description,
      });
    }
  }

  // Add read-only variables
  if (result.readOnly) {
    for (const [key, config] of Object.entries(result.readOnly)) {
      vars.push({
        key,
        value: config.value || '',
        isSecret: false,
        isEditable: false,
        description: config.description,
      });
    }
  }

  // Add sensitive variables
  if (result.sensitive) {
    for (const [key, config] of Object.entries(result.sensitive)) {
      vars.push({
        key,
        value: config.value || '',
        isSecret: true,
        isEditable: true,
        description: config.description,
      });
    }
  }

  return { success: true, vars };
}

export async function updateEnvVar(key: string, value: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return adminApiRequest('/admin/settings/env', {
    method: 'PUT',
    body: JSON.stringify({
      updates: {
        [key]: { value }
      },
      backup: true
    }),
  });
}

// ============================================
// Roles & Permissions API
// ============================================

export interface RoleWithPermissions {
  _id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: Array<{
    _id: string;
    name: string;
    description: string;
    category: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  _id: string;
  name: string;
  description: string;
  category: 'user' | 'role' | 'system' | 'content' | 'other';
}

export async function getRoles(): Promise<{
  success: boolean;
  roles?: RoleWithPermissions[];
  error?: string;
}> {
  return adminApiRequest('/admin/roles');
}

export async function getRole(roleId: string): Promise<{
  success: boolean;
  role?: RoleWithPermissions;
  error?: string;
}> {
  return adminApiRequest(`/admin/roles/${roleId}`);
}

export async function createRole(data: {
  name: string;
  description: string;
  permissionIds: string[];
}): Promise<{
  success: boolean;
  role?: RoleWithPermissions;
  error?: string;
}> {
  return adminApiRequest('/admin/roles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRole(
  roleId: string,
  data: {
    name?: string;
    description?: string;
    permissionIds?: string[];
  }
): Promise<{
  success: boolean;
  role?: RoleWithPermissions;
  error?: string;
}> {
  return adminApiRequest(`/admin/roles/${roleId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteRole(roleId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return adminApiRequest(`/admin/roles/${roleId}`, {
    method: 'DELETE',
  });
}

export async function getAllPermissions(): Promise<{
  success: boolean;
  permissions?: Permission[];
  error?: string;
}> {
  return adminApiRequest('/admin/permissions');
}

// ============================================
// Ziwei Books (Fortune-telling Knowledge Base) API
// ============================================

export interface ZiweiBookChunk {
  id: string;
  content: string;
  source: string;
  chunk_id: number;
}

export interface ZiweiBooksResult {
  success: boolean;
  chunks?: ZiweiBookChunk[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats?: {
    totalChunks: number;
    sources: string[];
  };
  error?: string;
}

export interface ZiweiBookSource {
  name: string;
  count: number;
}

export interface ZiweiBooksSourcesResult {
  success: boolean;
  sources?: ZiweiBookSource[];
  totalChunks?: number;
  error?: string;
}

export async function getZiweiBooks(filters?: {
  page?: number;
  limit?: number;
  search?: string;
  source?: string;
}): Promise<ZiweiBooksResult> {
  const params = new URLSearchParams();
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));
  if (filters?.search) params.append('search', filters.search);
  if (filters?.source) params.append('source', filters.source);

  const query = params.toString() ? `?${params.toString()}` : '';
  return adminApiRequest(`/admin/ziwei-books${query}`);
}

export async function getZiweiBooksSources(): Promise<ZiweiBooksSourcesResult> {
  return adminApiRequest('/admin/ziwei-books/sources');
}

// ============================================
// XiaoShuDong Statistics API
// ============================================

export interface XiaoshudongStats {
  totalConversations: number;
  totalUsers: number;
  activeSessions: number;
  dailyStats: Array<{
    date: string;
    count: number;
  }>;
  phaseDistribution: {
    listening: number;
    analysis: number;
    transition: number;
  };
  avgTurnCount: number;
  period: {
    start: string;
    end: string;
  };
}

export interface XiaoshudongStatsFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
}

export async function getXiaoshudongStats(
  filters?: XiaoshudongStatsFilters
): Promise<{
  success: boolean;
  stats?: XiaoshudongStats;
  error?: string;
}> {
  const params = new URLSearchParams();
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.userId) params.append('userId', filters.userId);

  const query = params.toString() ? `?${params.toString()}` : '';
  return adminApiRequest(`/admin/xiaoshudong/stats${query}`);
}

export interface XiaoshudongConversation {
  _id: string;
  userId: string;
  sourceType: string;
  conversationPhase?: string;
  messageCount?: number;
  summary?: string;
  keyTopics?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface XiaoshudongConversationsResult {
  success: boolean;
  conversations?: XiaoshudongConversation[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
}

export async function getUserXiaoshudongConversations(
  userId: string,
  page = 1,
  limit = 20
): Promise<XiaoshudongConversationsResult> {
  const params = new URLSearchParams();
  params.append('page', String(page));
  params.append('limit', String(limit));

  return adminApiRequest(`/admin/xiaoshudong/conversations/${userId}?${params.toString()}`);
}

// ============================================
// Memory Deletion API
// ============================================

export interface DeleteMemoryResult {
  success: boolean;
  recycleBinId?: string;
  partnerRecycleBinId?: string;
  error?: string;
}

export interface BatchDeleteResult {
  success: boolean;
  succeeded?: number;
  failed?: number;
  errors?: Array<{ memoryId: string; error: string }>;
  recycleBinIds?: string[];
  error?: string;
}

/**
 * Delete a single conversation memory (soft delete)
 */
export async function deleteMemory(
  userId: string,
  memoryId: string
): Promise<DeleteMemoryResult> {
  return adminApiRequest(`/admin/memories/${userId}/memories/${memoryId}`, {
    method: 'DELETE',
  });
}

/**
 * Batch delete conversation memories
 */
export async function batchDeleteMemories(
  userId: string,
  memoryIds: string[]
): Promise<BatchDeleteResult> {
  return adminApiRequest(`/admin/memories/${userId}/memories/batch-delete`, {
    method: 'POST',
    body: JSON.stringify({ memoryIds }),
  });
}

/**
 * Delete a questionnaire answer (soft delete)
 */
export async function deleteAnswer(
  userId: string,
  answerId: string
): Promise<DeleteMemoryResult> {
  return adminApiRequest(`/admin/memories/${userId}/answers/${answerId}`, {
    method: 'DELETE',
  });
}

// ============================================
// Recycle Bin API
// ============================================

export interface RecycleBinItem {
  _id: string;
  itemType: 'questionnaire_answer' | 'conversation_memory';
  originalId: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    uniqueCode: string;
  };
  targetUserId?: {
    _id: string;
    name: string;
    email: string;
  };
  partnerId?: {
    _id: string;
    name: string;
    email: string;
  };
  deletedBy: {
    _id: string;
    name: string;
    email: string;
  };
  deletedAt: string;
  expiresAt: string;
  status: 'pending_purge' | 'restored' | 'purged';
  snapshot?: any;
  filePaths?: string[];
  relatedEntries?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RecycleBinFilters {
  page?: number;
  limit?: number;
  itemType?: string;
  userId?: string;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface RecycleBinListResult {
  success: boolean;
  items?: RecycleBinItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export interface RecycleBinStats {
  total: number;
  pendingPurge: number;
  restored: number;
  purged: number;
  byType: {
    questionnaire_answer: number;
    conversation_memory: number;
  };
  expiringSoon?: number;
}

/**
 * Get recycle bin items
 */
export async function getRecycleBin(
  filters: RecycleBinFilters = {}
): Promise<RecycleBinListResult> {
  const params = new URLSearchParams();
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));
  if (filters.itemType) params.append('itemType', filters.itemType);
  if (filters.userId) params.append('userId', filters.userId);
  if (filters.status) params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);

  return adminApiRequest(`/admin/recycle-bin?${params.toString()}`);
}

/**
 * Get recycle bin item by ID
 */
export async function getRecycleBinItem(id: string): Promise<{
  success: boolean;
  item?: RecycleBinItem;
  error?: string;
}> {
  return adminApiRequest(`/admin/recycle-bin/${id}`);
}

/**
 * Restore item from recycle bin
 */
export async function restoreRecycleBinItem(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return adminApiRequest(`/admin/recycle-bin/${id}/restore`, {
    method: 'POST',
  });
}

/**
 * Permanently delete item from recycle bin
 */
export async function purgeRecycleBinItem(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return adminApiRequest(`/admin/recycle-bin/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Batch restore items from recycle bin
 */
export async function batchRestoreRecycleBin(ids: string[]): Promise<{
  success: boolean;
  succeeded?: number;
  failed?: number;
  errors?: Array<{ id: string; error: string }>;
  error?: string;
}> {
  return adminApiRequest('/admin/recycle-bin/batch-restore', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

/**
 * Batch permanently delete items from recycle bin
 */
export async function batchPurgeRecycleBin(ids: string[]): Promise<{
  success: boolean;
  succeeded?: number;
  failed?: number;
  errors?: Array<{ id: string; error: string }>;
  error?: string;
}> {
  return adminApiRequest('/admin/recycle-bin/batch-purge', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  });
}

/**
 * Get recycle bin statistics
 */
export async function getRecycleBinStats(): Promise<{
  success: boolean;
  stats?: RecycleBinStats;
  error?: string;
}> {
  return adminApiRequest('/admin/recycle-bin/stats');
}

// ============================================
// Activity Logs API
// ============================================

export interface ActivityLogItem {
  _id: string;
  operation: string;
  category: 'user' | 'memory' | 'questionnaire' | 'system' | 'role';
  actorId?: {
    _id: string;
    name: string;
    email: string;
  };
  actorName?: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  description?: string;
  details?: any;
  ipAddress?: string;
  success: boolean;
  errorMessage?: string;
  createdAt: string;
}

export interface ActivityLogFilters {
  page?: number;
  limit?: number;
  category?: string;
  operation?: string;
  actorId?: string;
  targetId?: string;
  success?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface ActivityLogListResult {
  success: boolean;
  logs?: ActivityLogItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export interface ActivityLogStats {
  total: number;
  byCategory: Record<string, number>;
  byOperation: Record<string, number>;
  bySuccess: {
    succeeded: number;
    failed: number;
  };
}

/**
 * Get activity logs
 */
export async function getActivityLogs(
  filters: ActivityLogFilters = {}
): Promise<ActivityLogListResult> {
  const params = new URLSearchParams();
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));
  if (filters.category) params.append('category', filters.category);
  if (filters.operation) params.append('operation', filters.operation);
  if (filters.actorId) params.append('actorId', filters.actorId);
  if (filters.targetId) params.append('targetId', filters.targetId);
  if (filters.success) params.append('success', filters.success);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.search) params.append('search', filters.search);

  return adminApiRequest(`/admin/activity-logs?${params.toString()}`);
}

/**
 * Get activity log statistics
 */
export async function getActivityLogStats(filters: {
  startDate?: string;
  endDate?: string;
} = {}): Promise<{
  success: boolean;
  stats?: ActivityLogStats;
  error?: string;
}> {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);

  const query = params.toString() ? `?${params.toString()}` : '';
  return adminApiRequest(`/admin/activity-logs/stats${query}`);
}

/**
 * Export activity logs
 */
export async function exportActivityLogs(
  filters: ActivityLogFilters = {},
  format: 'json' | 'csv' = 'json'
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  const params = new URLSearchParams();
  params.append('format', format);
  if (filters.category) params.append('category', filters.category);
  if (filters.operation) params.append('operation', filters.operation);
  if (filters.actorId) params.append('actorId', filters.actorId);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.search) params.append('search', filters.search);

  return adminApiRequest(`/admin/activity-logs/export?${params.toString()}`);
}

// ============================================
// Ziwei Chart API
// ============================================

export interface ZiweiChartPalace {
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  majorStars: Array<{ name: string; brightness: string }>;
  minorStars: Array<{ name: string }>;
}

export interface ZiweiChartHoroscope {
  decadal: { range: [number, number]; heavenlyStem: string; earthlyBranch: string };
  yearly: { heavenlyStem: string; earthlyBranch: string };
}

export interface ZiweiChart {
  solarDate: string;
  lunarDate: string;
  chineseDate: string;
  zodiac: string;
  sign: string;
  soul: string;
  body: string;
  fiveElementsClass: string;
  palaces: ZiweiChartPalace[];
  horoscope: ZiweiChartHoroscope;
}

export interface ZiweiChartData {
  success: boolean;
  chart?: ZiweiChart;
  error?: string;
}

/**
 * Get Ziwei astrology chart for a user
 */
export async function getZiweiChart(userId: string): Promise<ZiweiChartData> {
  return adminApiRequest(`/admin/users/${userId}/ziwei-chart`);
}
