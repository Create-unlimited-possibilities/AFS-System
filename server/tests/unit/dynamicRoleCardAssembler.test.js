/**
 * DynamicRoleCardAssembler 单元测试
 * 测试动态角色卡组装器的核心功能
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/models/User.js', () => ({
  default: class MockUser {
    static findById(id) {
      if (id.toString() === '507f1f77bcf86cd799439011') {
        return Promise.resolve({
          _id: '507f1f77bcf86cd799439011',
          name: '测试用户',
          companionChat: {
            roleCard: {
              personality: '开朗友善',
              background: '普通生活经历',
              interests: ['阅读', '旅行'],
              communicationStyle: '友好耐心',
              values: ['诚实', '尊重'],
              emotionalNeeds: ['被理解'],
              lifeMilestones: ['大学毕业'],
              preferences: ['安静'],
              strangerInitialSentiment: 60,
              generatedAt: new Date('2026-01-01'),
              updatedAt: new Date('2026-01-01')
            },
            assistantsGuidelines: []
          }
        });
      }
      if (id.toString() === '507f1f77bcf86cd799439012') {
        return Promise.resolve({
          _id: '507f1f77bcf86cd799439012',
          name: '对话者用户'
        });
      }
      if (id.toString() === '507f1f77bcf86cd799439013') {
        return Promise.resolve({
          _id: '507f1f77bcf86cd799439013',
          name: '协助者用户'
        });
      }
      return Promise.resolve(null);
    }
  },
  __esModule: true
}));

vi.mock('../../src/models/ChatSession.js', () => ({
  default: class MockChatSession {
    static findOne(query) {
      return Promise.resolve({
        sessionId: 'test_session_001',
        targetUserId: '507f1f77bcf86cd799439011',
        interlocutorUserId: '507f1f77bcf86cd799439012',
        relation: 'stranger',
        sentimentScore: 65,
        isActive: true
      });
    }
  },
  __esModule: true
}));

vi.mock('../../src/services/dualStorage.js', () => ({
  default: class MockDualStorage {
    loadAssistantsGuidelines() {
      return Promise.resolve([
        {
          assistantId: '507f1f77bcf86cd799439013',
          assistantName: '协助者用户',
          assistantUniqueCode: 'ASSIST001',
          conversationGuidelines: '请保持耐心和友善的语气，避免敏感话题',
          compressedAnswers: [],
          generatedAt: new Date('2026-01-01'),
          isValid: true
        }
      ]);
    }
  },
  __esModule: true
}));

vi.mock('../../src/services/langchain/sentimentManager.js', () => ({
  default: class MockSentimentManager {
    constructor() {}
    async getStrangerSentiment() {
      return Promise.resolve({
        currentScore: 65,
        totalConversations: 5,
        totalMessages: 20
      });
    }
    async generateSentimentGuidelines(score) {
      if (score > 70) {
        return Promise.resolve('对方对你好感度很高，可以适当拉近关系');
      } else if (score > 50) {
        return Promise.resolve('对方对你有一定好感，保持礼貌和友好');
      } else {
        return Promise.resolve('对方对你不太熟悉，需要保持适当距离');
      }
    }
  },
  __esModule: true
}));

// Import the module under test
import DynamicRoleCardAssembler from '../../src/services/chat/DynamicRoleCardAssembler.js';

describe('DynamicRoleCardAssembler', () => {
  let assembler;
  const targetUserId = '507f1f77bcf86cd799439011';
  const interlocutorUserId = '507f1f77bcf86cd799439012';
  const assistantUserId = '507f1f77bcf86cd799439013';
  const sessionId = 'test_session_001';

  beforeEach(() => {
    vi.clearAllMocks();
    assembler = new DynamicRoleCardAssembler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with correct configuration', () => {
      expect(assembler).toBeDefined();
    });
  });

  describe('assembleDynamicRoleCard', () => {
    test('should successfully assemble dynamic role card', async () => {
      const result = await assembler.assembleDynamicRoleCard({
        targetUserId,
        interlocutorUserId,
        sessionId
      });

      expect(result).toBeDefined();
      expect(result.targetUser).toBeDefined();
      expect(result.interlocutorUser).toBeDefined();
      expect(result.personaProfile).toBeDefined();
      expect(result.conversationGuidelines).toBeDefined();
      expect(result.systemPrompt).toBeDefined();
      expect(result.sentimentGuidelines).toBeDefined();
    });

    test('should load persona profile from User.companionChat.roleCard', async () => {
      const result = await assembler.assembleDynamicRoleCard({
        targetUserId,
        interlocutorUserId,
        sessionId
      });

      expect(result.personaProfile).toEqual({
        personality: '开朗友善',
        background: '普通生活经历',
        interests: ['阅读', '旅行'],
        communicationStyle: '友好耐心',
        values: ['诚实', '尊重'],
        emotionalNeeds: ['被理解'],
        lifeMilestones: ['大学毕业'],
        preferences: ['安静']
      });
    });

    test('should load interlocutor information', async () => {
      const result = await assembler.assembleDynamicRoleCard({
        targetUserId,
        interlocutorUserId,
        sessionId
      });

      expect(result.interlocutorUser).toEqual({
        _id: '507f1f77bcf86cd799439012',
        name: '对话者用户'
      });
    });

    test('should load conversation session information', async () => {
      const result = await assembler.assembleDynamicRoleCard({
        targetUserId,
        interlocutorUserId,
        sessionId
      });

      expect(result.session).toBeDefined();
      expect(result.session.sessionId).toBe('test_session_001');
      expect(result.session.relation).toBe('stranger');
      expect(result.session.sentimentScore).toBe(65);
    });

    test('should load assistants guidelines', async () => {
      const result = await assembler.assembleDynamicRoleCard({
        targetUserId,
        interlocutorUserId,
        sessionId,
        assistantId: assistantUserId
      });

      expect(result.conversationGuidelines).toBeDefined();
      expect(result.conversationGuidelines).toContain('请保持耐心和友善的语气');
    });

    test('should generate sentiment guidelines based on sentiment score', async () => {
      const result = await assembler.assembleDynamicRoleCard({
        targetUserId,
        interlocutorUserId,
        sessionId
      });

      expect(result.sentimentGuidelines).toBeDefined();
      expect(result.sentimentGuidelines).toContain('保持礼貌和友好');
    });

    test('should build system prompt with all components', async () => {
      const result = await assembler.assembleDynamicRoleCard({
        targetUserId,
        interlocutorUserId,
        sessionId
      });

      expect(result.systemPrompt).toBeDefined();
      expect(result.systemPrompt).toContain('个人画像');
      expect(result.systemPrompt).toContain('对话准则');
      expect(result.systemPrompt).toContain('好感度');
    });

    test.skip('should handle missing role card gracefully - TODO: ES module mock issue', async () => {
      vi.doMock('../../src/models/User.js', () => ({
        default: class MockUser {
          static findById(id) {
            return Promise.resolve({
              _id: '507f1f77bcf86cd799439011',
              name: '测试用户',
              companionChat: {}
            });
          }
        },
        __esModule: true
      }));

      await expect(
        assembler.assembleDynamicRoleCard({
          targetUserId,
          interlocutorUserId,
          sessionId
        })
      ).rejects.toThrow();
    });

    test.skip('should handle non-existent session gracefully - TODO: ES module mock issue', async () => {
      vi.doMock('../../src/models/ChatSession.js', () => ({
        default: class MockChatSession {
          static findOne(query) {
            return Promise.resolve(null);
          }
        },
        __esModule: true
      }));

      await expect(
        assembler.assembleDynamicRoleCard({
          targetUserId,
          interlocutorUserId,
          sessionId
        })
      ).rejects.toThrow();
    });
  });

  describe('buildSystemPrompt', () => {
    test('should build system prompt with persona profile', async () => {
      const personaProfile = {
        personality: '开朗友善',
        background: '普通生活经历',
        interests: ['阅读', '旅行'],
        communicationStyle: '友好耐心'
      };

      const prompt = await assembler.buildSystemPrompt({
        personaProfile
      });

      expect(prompt).toBeDefined();
      expect(prompt).toContain('开朗友善');
      expect(prompt).toContain('友好耐心');
    });

    test('should build system prompt with conversation guidelines', async () => {
      const conversationGuidelines = '请保持耐心和友善的语气';

      const prompt = await assembler.buildSystemPrompt({
        conversationGuidelines
      });

      expect(prompt).toBeDefined();
      expect(prompt).toContain('请保持耐心和友善的语气');
    });

    test('should build system prompt with sentiment guidelines', async () => {
      const sentimentGuidelines = '对方对你有一定好感，保持礼貌和友好';

      const prompt = await assembler.buildSystemPrompt({
        sentimentGuidelines
      });

      expect(prompt).toBeDefined();
      expect(prompt).toContain('保持礼貌和友好');
    });

    test('should format system prompt correctly', async () => {
      const personaProfile = {
        personality: '开朗友善',
        communicationStyle: '友好耐心'
      };
      const conversationGuidelines = '请保持友善';
      const sentimentGuidelines = '保持礼貌';

      const prompt = await assembler.buildSystemPrompt({
        personaProfile,
        conversationGuidelines,
        sentimentGuidelines
      });

      expect(prompt).toMatch(/你是一个AI助手/);
      expect(prompt).toMatch(/个人画像/);
      expect(prompt).toMatch(/对话准则/);
      expect(prompt).toMatch(/好感度提示/);
    });
  });

  describe('generateSentimentGuidelines', () => {
    test('should generate guidelines for high sentiment (>70)', async () => {
      const guidelines = await assembler.generateSentimentGuidelines(75);

      expect(guidelines).toBeDefined();
      expect(guidelines).toContain('好感度很高');
    });

    test('should generate guidelines for medium sentiment (50-70)', async () => {
      const guidelines = await assembler.generateSentimentGuidelines(60);

      expect(guidelines).toBeDefined();
      expect(guidelines).toContain('一定好感');
    });

    test('should generate guidelines for low sentiment (<50)', async () => {
      const guidelines = await assembler.generateSentimentGuidelines(25);

      expect(guidelines).toBeDefined();
      expect(guidelines).toContain('不太熟悉');
    });

    test('should handle boundary value 50', async () => {
      const guidelines = await assembler.generateSentimentGuidelines(50);

      expect(guidelines).toBeDefined();
    });

    test('should handle boundary value 70', async () => {
      const guidelines = await assembler.generateSentimentGuidelines(70);

      expect(guidelines).toBeDefined();
    });
  });

  describe('error handling', () => {
    test('should throw error when target user not found', async () => {
      vi.doMock('../../src/models/User.js', () => ({
        default: class MockUser {
          static findById(id) {
            return Promise.resolve(null);
          }
        },
        __esModule: true
      }));

      await expect(
        assembler.assembleDynamicRoleCard({
          targetUserId: 'nonexistent',
          interlocutorUserId,
          sessionId
        })
      ).rejects.toThrow('目标用户不存在');
    });

    test.skip('should throw error when session not found - TODO: ES module mock issue', async () => {
      vi.doMock('../../src/models/ChatSession.js', () => ({
        default: class MockChatSession {
          static findOne(query) {
            return Promise.resolve(null);
          }
        },
        __esModule: true
      }));

      await expect(
        assembler.assembleDynamicRoleCard({
          targetUserId,
          interlocutorUserId,
          sessionId: 'nonexistent'
        })
      ).rejects.toThrow('对话会话不存在');
    });

    test.skip('should handle database errors gracefully - TODO: ES module mock issue', async () => {
      vi.doMock('../../src/models/User.js', () => ({
        default: class MockUser {
          static findById(id) {
            return Promise.reject(new Error('Database connection failed'));
          }
        },
        __esModule: true
      }));

      await expect(
        assembler.assembleDynamicRoleCard({
          targetUserId,
          interlocutorUserId,
          sessionId
        })
      ).rejects.toThrow('Database connection failed');
    });
  });
});
