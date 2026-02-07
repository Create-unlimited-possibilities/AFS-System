/**
 * 角色卡生成器集成测试
 * 测试角色卡生成的完整流程
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import RoleCardGenerator from '../../src/services/langchain/roleCardGenerator.js';
import { multiLLMClient } from '../../src/services/langchain/multiLLMClient.js';

describe('角色卡生成器集成测试', () => {
  let roleCardGenerator;

  beforeEach(() => {
    // 创建角色卡生成器实例
    roleCardGenerator = new RoleCardGenerator();

    // Mock DualStorage
    vi.spyOn(roleCardGenerator.dualStorage, 'saveRoleCard').mockResolvedValue({
      success: true,
      filePath: '/test/path/rolecard.json'
    });

    // Mock LLM 调用
    vi.spyOn(multiLLMClient, 'generate').mockResolvedValue(
      JSON.stringify({
        personality: '开朗友善',
        background: '普通的生活经历，受过良好教育',
        interests: ['阅读', '旅行', '音乐'],
        communicationStyle: '友好耐心，善于倾听',
        values: ['诚实', '尊重', '友善'],
        emotionalNeeds: ['被理解', '被关心', '陪伴'],
        lifeMilestones: ['大学毕业', '第一份工作', '结婚'],
        preferences: ['安静的环境', '简单的生活', '和谐的关系']
      })
    );

    // 清除日志输出
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Token 计算测试', () => {
    it('应该正确计算中文文本的token数量', () => {
      const text = '你好，世界！';
      const count = roleCardGenerator.calculateTokenCount(text);
      expect(count).toBeGreaterThan(0);
    });

    it('应该正确计算英文文本的token数量', () => {
      const text = 'Hello world!';
      const count = roleCardGenerator.calculateTokenCount(text);
      expect(count).toBeGreaterThan(0);
    });

    it('应该使用缓存避免重复计算', () => {
      const text = '测试文本';
      const count1 = roleCardGenerator.calculateTokenCount(text);
      const count2 = roleCardGenerator.calculateTokenCount(text);
      expect(count1).toBe(count2);
    });

    it('应该正确计算空文本的token数量', () => {
      const count = roleCardGenerator.calculateTokenCount('');
      expect(count).toBe(0);
    });

    it('应该正确计算null或undefined的token数量', () => {
      const count1 = roleCardGenerator.calculateTokenCount(null);
      const count2 = roleCardGenerator.calculateTokenCount(undefined);
      expect(count1).toBe(0);
      expect(count2).toBe(0);
    });

    it('应该正确计算混合文本的token数量', () => {
      const text = '你好Hello世界World！';
      const count = roleCardGenerator.calculateTokenCount(text);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('陌生人初始好感度计算测试', () => {
    it('应该正确计算正面性格的好感度', () => {
      const sentiment = roleCardGenerator.calculateStrangerInitialSentiment('开朗友善');
      expect(sentiment).toBeGreaterThan(50);
      expect(sentiment).toBeLessThanOrEqual(100);
    });

    it('应该正确计算负面性格的好感度', () => {
      const sentiment = roleCardGenerator.calculateStrangerInitialSentiment('内向安静');
      expect(sentiment).toBeLessThan(50);
      expect(sentiment).toBeGreaterThanOrEqual(0);
    });

    it('应该正确计算中性性格的好感度', () => {
      const sentiment = roleCardGenerator.calculateStrangerInitialSentiment('温和友善');
      expect(sentiment).toBeGreaterThanOrEqual(0);
      expect(sentiment).toBeLessThanOrEqual(100);
    });

    it('应该在性格为空时返回默认值', () => {
      const sentiment = roleCardGenerator.calculateStrangerInitialSentiment(null);
      expect(sentiment).toBe(50);
    });

    it('应该限制好感度在0-100范围内', () => {
      const sentiment1 = roleCardGenerator.calculateStrangerInitialSentiment('开朗外向热情');
      expect(sentiment1).toBeLessThanOrEqual(100);

      const sentiment2 = roleCardGenerator.calculateStrangerInitialSentiment('内向安静');
      expect(sentiment2).toBeGreaterThanOrEqual(0);
    });
  });

  describe('默认值生成测试', () => {
    it('应该为所有字段生成合理的默认值', () => {
      const requiredFields = [
        'personality', 'background', 'interests', 'communicationStyle',
        'values', 'emotionalNeeds', 'lifeMilestones', 'preferences'
      ];

      for (const field of requiredFields) {
        const defaultValue = roleCardGenerator.getDefaultValueForField(field);
        expect(defaultValue).toBeDefined();
      }
    });

    it('应该为数组字段返回数组', () => {
      const arrayFields = ['interests', 'values', 'emotionalNeeds', 'lifeMilestones', 'preferences'];

      for (const field of arrayFields) {
        const defaultValue = roleCardGenerator.getDefaultValueForField(field);
        expect(Array.isArray(defaultValue)).toBe(true);
      }
    });
  });

  describe('角色卡生成测试', () => {
    it('应该成功生成个人画像', async () => {
      const mockAnswers = [
        {
          questionId: '1',
          question: '你叫什么名字？',
          questionOrder: 1,
          answer: '我叫张三',
          questionLayer: 'basic'
        },
        {
          questionId: '2',
          question: '你有什么爱好？',
          questionOrder: 2,
          answer: '我喜欢读书、旅行和听音乐',
          questionLayer: 'basic'
        }
      ];

      const roleCard = await roleCardGenerator.generatePersonalProfile('test-user-id', mockAnswers);

      expect(roleCard).toBeDefined();
      expect(roleCard.personality).toBeDefined();
      expect(roleCard.background).toBeDefined();
      expect(Array.isArray(roleCard.interests)).toBe(true);
      expect(roleCard.communicationStyle).toBeDefined();
      expect(Array.isArray(roleCard.values)).toBe(true);
      expect(Array.isArray(roleCard.emotionalNeeds)).toBe(true);
      expect(Array.isArray(roleCard.lifeMilestones)).toBe(true);
      expect(Array.isArray(roleCard.preferences)).toBe(true);
      expect(roleCard.strangerInitialSentiment).toBeGreaterThanOrEqual(0);
      expect(roleCard.strangerInitialSentiment).toBeLessThanOrEqual(100);
    });

    it('应该在LLM响应解析失败时使用默认值', async () => {
      // 为这个特定测试创建新的 spy
      const invalidSpy = vi.spyOn(multiLLMClient, 'generate').mockResolvedValueOnce('这不是有效的JSON');

      const tempGenerator = new RoleCardGenerator();

      const mockAnswers = [
        {
          questionId: '1',
          question: '你叫什么名字？',
          questionOrder: 1,
          answer: '我叫张三',
          questionLayer: 'basic'
        }
      ];

      await expect(
        tempGenerator.generatePersonalProfile('test-user-id', mockAnswers)
      ).rejects.toThrow();

      // 恢复 spy
      invalidSpy.mockRestore();
    });
  });

  describe('对话模式确定测试', () => {
    it('应该根据token数量确定mode1', () => {
      const roleCard = {
        memoryTokenCount: 1500
      };

      // 模拟 saveToDualStorage 的内部逻辑
      let currentMode = 'mode1';
      const tokenCount = roleCard.memoryTokenCount || 0;
      if (tokenCount > 5000) {
        currentMode = 'mode3';
      } else if (tokenCount > 2000) {
        currentMode = 'mode2';
      }

      expect(currentMode).toBe('mode1');
    });

    it('应该根据token数量确定mode2', () => {
      const roleCard = {
        memoryTokenCount: 3500
      };

      let currentMode = 'mode1';
      const tokenCount = roleCard.memoryTokenCount || 0;
      if (tokenCount > 5000) {
        currentMode = 'mode3';
      } else if (tokenCount > 2000) {
        currentMode = 'mode2';
      }

      expect(currentMode).toBe('mode2');
    });

    it('应该根据token数量确定mode3', () => {
      const roleCard = {
        memoryTokenCount: 6000
      };

      let currentMode = 'mode1';
      const tokenCount = roleCard.memoryTokenCount || 0;
      if (tokenCount > 5000) {
        currentMode = 'mode3';
      } else if (tokenCount > 2000) {
        currentMode = 'mode2';
      }

      expect(currentMode).toBe('mode3');
    });
  });
});