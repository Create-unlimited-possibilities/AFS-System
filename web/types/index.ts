export interface User {
  id?: string;  // 支持后端注册接口返回的id
  _id?: string; // 支持后端登录接口返回的_id
  uniqueCode: string;
  email: string;
  name: string;
  role?: Role;
  isActive?: boolean;
  createdAt: string;
  lastLogin?: string;
  chatBeta?: {
    memoryTokenCount: number;
    currentMode: string;
    relationships: Relationship[];
    roleCard?: RoleCard;
    modelStatus?: ModelStatus;
  };
  companionChat?: {
    roleCard?: RoleCardExtended;
    assistantsGuidelines?: AssistantGuideline[];
    currentMode?: string;
    modelStatus?: {
      hasBaseModel?: boolean;
      hasSFTModel?: boolean;
      hasFullModel?: boolean;
      lastTrainedAt?: string;
      trainingInProgress?: boolean;
    };
    strangerSentiments?: StrangerSentiment[];
    conversationsAsTarget?: ChatSessionSummary[];
    memoryTokenCount?: number;
  };
}

// 统一获取用户ID的辅助函数，优先使用 _id，如果没有则使用 id
export const getUserId = (user: User | null | undefined): string | undefined => {
  if (!user) return undefined;
  return user._id || user.id;
};

export interface Relationship {
  userId: string;
  relationType: 'family' | 'friend';
  affinityScore: number;
  specificRelation?: string;
  friendLevel?: 'casual' | 'close' | 'intimate';
  lastInteractionDate?: string;
  isAssisted: boolean;
}

export interface RoleCard {
  selfCognition?: {
    summary?: string;
    traits?: string[];
    vulnerabilities?: string[];
  };
  familyScripts?: {
    children?: string;
    spouse?: string;
  };
  friendScripts?: {
    casual?: string;
    close?: string;
    intimate?: string;
  };
}

export interface RoleCardExtended {
  personality?: string;
  background?: string;
  interests?: string[];
  communicationStyle?: string;
  values?: string[];
  emotionalNeeds?: string[];
  lifeMilestones?: string[];
  preferences?: string[];
  memories?: string[];
  strangerInitialSentiment?: number;
  generatedAt?: string;
  updatedAt?: string;
  memoryTokenCount?: number;
}

export interface ModelStatus {
  hasCustomModel: boolean;
  modelPath?: string;
  trainingStatus: 'none' | 'training' | 'completed';
}

export interface Question {
  _id: string;
  role: 'elder' | 'family' | 'friend';
  layer: 'basic' | 'emotional';
  order: number;
  question: string;
  placeholder?: string;
  type: 'text' | 'textarea' | 'voice';
  active: boolean;
}

export interface Answer {
  _id: string;
  userId: string;
  targetUserId: string;
  questionId: string;
  question?: Question;
  questionLayer: 'basic' | 'emotional';
  answer: string;
  isSelfAnswer: boolean;
  relationshipType: 'self' | 'family' | 'friend';
  createdAt: string;
  updatedAt: string;
}

export interface AssistRelation {
  _id: string;
  assistantId: string;
  targetId: string;
  targetUser: {
    id: string;
    name: string;
    uniqueCode: string;
    email: string;
  };
  relationshipType: 'family' | 'friend';
  specificRelation?: string;
  friendLevel?: 'casual' | 'close' | 'intimate';
  createdAt: string;
  isActive: boolean;
}

export interface Progress {
  total: number;
  answered: number;
  percentage: number;
}

export interface LayerProgress {
  basic: Progress;
  emotional: Progress;
  overall: {
    total: number;
    answered: number;
    percentage: number;
  };
}

export interface Permission {
  _id: string;
  name: string;
  description: string;
  category: 'user' | 'role' | 'system' | 'content' | 'other';
  createdAt: string;
}

export interface Role {
  _id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettings {
  site: {
    name: string;
    description: string;
    logo: string;
  };
  system: {
    version: string;
    environment: string;
    timezone: string;
  };
  features: {
    registrationEnabled: boolean;
    emailVerificationRequired: boolean;
    maxUploadSize: number;
    allowedFileTypes: string[];
  };
  limits: {
    maxQuestionsPerUser: number;
    maxAnswersPerUser: number;
    maxRelationshipsPerUser: number;
  };
  model: {
    defaultModel: string;
    maxTokens: number;
    temperature: number;
  };
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
}

export interface SystemInfo {
  users: number;
  questions: number;
  answers: number;
  uptime: number;
  memory: {
    used: number;
    total: number;
    rss: number;
  };
  platform: string;
  nodeVersion: string;
  diskUsage: number;
}

export interface AssistantGuideline {
  assistantId: string;
  assistantName: string;
  assistantUniqueCode: string;
  assistRelationId: string;
  relationType: 'family' | 'friend';
  specificRelation: string;
  conversationGuidelines: string;
  compressedAnswers: CompressedAnswer[];
  generatedAt: string;
  updatedAt: string;
  isValid: boolean;
}

export interface CompressedAnswer {
  questionId: string;
  question: string;
  originalAnswer: string;
  compressed: string;
  questionLayer: 'basic' | 'emotional';
  compressedAt: string;
}

export interface ChatSession {
  sessionId: string;
  targetUser: {
    id: string;
    name: string;
    uniqueCode: string;
  };
  relation: {
    type: 'family' | 'friend' | 'stranger';
    assistRelationId?: string;
    specificRelation?: string;
    assistantName?: string;
  };
  messages: Message[];
  isActive: boolean;
  startedAt: string;
  endedAt?: string;
  lastMessageAt?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    ragUsed?: boolean;
    retrievedMemories?: any[];
    modelUsed?: string;
    tokenCount?: number;
    sentimentSnapshot?: number;
  };
}

export interface StrangerSentiment {
  strangerId: string;
  currentScore: number;
  initialScore?: number;
  history: SentimentHistoryItem[];
  totalConversations?: number;
  totalMessages?: number;
  lastConversationAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SentimentHistoryItem {
  score: number;
  change: number;
  reason: string;
  factors?: {
    sentiment: number;
    frequency: number;
    quality: number;
    decay: number;
  };
  timestamp: string;
}

export interface SentimentRecord {
  currentScore: number;
  change: number;
  reason: string;
  factors: {
    sentiment: number;
    frequency: number;
    quality: number;
    decay: number;
  };
  history: SentimentHistoryItem[];
}

export interface ChatSessionSummary {
  sessionId: string;
  interlocutorId: string;
  interlocutorName?: string;
  relationType: 'family' | 'friend' | 'stranger';
  assistRelationId?: string;
  specificRelation?: string;
  sentimentSnapshot?: number;
  startedAt: string;
  endedAt?: string;
  lastMessageAt?: string;
  isActive: boolean;
}

