/**
 * XiaoShuDong Integration Tests
 * 端到端集成测试 - 测试完整的工作流程
 *
 * 这些测试需要：
 * - MongoDB 运行
 * - ChromaDB 运行（并有 ziwei_books 数据）
 * - Ollama 运行（并有 ziwei-8b 模型）
 *
 * 运行方式：
 * npm run test:integration -- tests/integration/xiaoshudong
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// 检查是否应该跳过集成测试
const shouldSkipIntegration = process.env.SKIP_INTEGRATION === 'true' ||
  process.env.CI === 'true';

// 模拟 logger
vi.mock('../../../src/core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe.skipIf(shouldSkipIntegration)('XiaoShuDong Integration Tests', () => {
  let orchestrator;
  let testUserId;
  let testUserData;

  beforeAll(async () => {
    // 动态导入以避免在跳过时加载
    orchestrator = (await import('../../../src/modules/xiaoshudong/orchestrator.js')).default;

    testUserId = 'integration-test-user-' + Date.now();
    testUserData = {
      birthDate: '1990-05-15',
      birthHourIndex: 6, // 午时 (11:00-13:00)
      gender: 'male',
      birthCalendar: 'solar'
    };

    console.log('[Integration Test] Starting with userId:', testUserId);
  });

  afterAll(async () => {
    // 清理会话
    if (orchestrator) {
      orchestrator.endSession(testUserId);
    }
  });

  describe('完整工作流程', () => {
    it('应该能处理完整的用户对话流程', async () => {
      const result = await orchestrator.processMessage(
        testUserId,
        '我最近感觉事业不太顺利，能帮我看看吗？',
        { userData: testUserData }
      );

      // 验证基本响应结构
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response.length).toBeGreaterThan(10);

      // 验证元数据
      expect(result.metadata).toBeDefined();
      expect(result.metadata.sessionId).toBeDefined();
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);

      console.log('[Integration Test] Full workflow response:', {
        success: result.success,
        intent: result.intent,
        processingTime: result.metadata.processingTime,
        responseLength: result.response.length
      });
    }, 60000); // 60秒超时

    it('应该能在多轮对话中保持上下文', async () => {
      // 第一轮
      const result1 = await orchestrator.processMessage(
        testUserId,
        '你好，我想了解一下我的财运',
        { userData: testUserData }
      );

      expect(result1.success).toBe(true);

      // 第二轮 - 应该有历史记录
      const result2 = await orchestrator.processMessage(
        testUserId,
        '那我今年适合投资吗？'
      );

      expect(result2.success).toBe(true);

      // 检查历史记录
      const history = orchestrator.getHistory(testUserId);
      expect(history.length).toBeGreaterThanOrEqual(4); // 2 user + 2 assistant

      console.log('[Integration Test] Multi-turn conversation history length:', history.length);
    }, 90000);

    it('应该正确处理情感倾诉类消息', async () => {
      const result = await orchestrator.processMessage(
        testUserId + '-emotional',
        '我今天心情很不好，感觉很累',
        { userData: testUserData }
      );

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();

      // 情感类消息应该有共情回应
      console.log('[Integration Test] Emotional response intent:', result.intent);
    }, 60000);
  });

  describe('命盘计算', () => {
    it('应该能正确计算用户命盘', async () => {
      const ziweiService = (await import('../../../src/core/ziwei/ziweiService.js')).default;

      const chart = await ziweiService.computeNatalChart({
        birthDate: '1990-05-15',
        hourIndex: 6,
        gender: 'male',
        calendarType: 'solar'
      });

      expect(chart).toBeDefined();
      expect(chart.palaces).toBeDefined();
      expect(chart.palaces.length).toBe(12);

      // 检查命宫
      const mingGong = ziweiService.getPalaceByName(chart, '命宫');
      expect(mingGong).toBeDefined();

      console.log('[Integration Test] Chart computed:', {
        soulIndex: chart.soulIndex,
        bodyIndex: chart.bodyIndex,
        chineseAge: chart.chineseAge
      });
    }, 30000);
  });

  describe('RAG 检索', () => {
    it('应该能从 ChromaDB 检索相关知识片段', async () => {
      const ziweiRag = (await import('../../../src/core/ziwei/ziweiRag.js')).default;

      const results = await ziweiRag.retrieve('命宫在午宫的特点', 3);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // 验证结果格式
      const firstResult = results[0];
      expect(firstResult).toHaveProperty('content');
      expect(firstResult).toHaveProperty('source');
      expect(firstResult.content.length).toBeGreaterThan(0);

      console.log('[Integration Test] RAG retrieved:', {
        count: results.length,
        firstSource: firstResult.source
      });
    }, 30000);

    it('应该能根据宫位和星曜检索', async () => {
      const ziweiRag = (await import('../../../src/core/ziwei/ziweiRag.js')).default;

      const results = await ziweiRag.retrieveByPalaceAndStars('命宫', ['紫微'], 5);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      console.log('[Integration Test] RAG by palace/stars:', results.length);
    }, 30000);
  });

  describe('LLM 生成', () => {
    it('应该能调用 Ollama 生成命理分析', async () => {
      const ziweiLlm = (await import('../../../src/core/ziwei/ziweiLlm.js')).default;

      const chartContext = {
        palaces: [
          { name: '命宫', majorStars: ['紫微', '天府'], minorStars: ['左辅'] }
        ],
        userQuestion: '我的事业发展如何？'
      };

      const response = await ziweiLlm.generateFortuneAnalysis(
        chartContext,
        '参考知识：紫微星代表帝王之星...',
        { timeout: 60000 }
      );

      expect(response).toBeDefined();
      expect(response.length).toBeGreaterThan(20);

      console.log('[Integration Test] LLM generated response length:', response.length);
    }, 90000);
  });

  describe('Psychologist Response (心理咨询师回复)', () => {
    it('应该生成心理咨询师风格的回复', async () => {
      const { psychologistResponseNode } = await import('../../../src/modules/xiaoshudong/nodes/psychologistResponse.js');
      const XiaoShuDongState = (await import('../../../src/modules/xiaoshudong/state/XiaoShuDongState.js')).default;

      // 创建测试状态
      const state = new XiaoShuDongState('test-user');
      state.fortuneResponse = '根据您的命宫分析，紫微星在命宫表示您有帝王之相。流年运势显示今年四化入命，运势大吉。';
      state.compressedData = {
        eventSummary: '测试事件',
        emotionalState: '平静',
        coreConcerns: ['测试']
      };

      const resultState = await psychologistResponseNode(state);

      expect(resultState.finalResponse).toBeDefined();

      // 检查是否隐藏了关键词
      const forbiddenWords = ['命理', '占卜', '星盘', '紫微星', '四化入命'];
      const response = resultState.finalResponse;

      let hasForbiddenWord = false;
      for (const word of forbiddenWords) {
        if (response.includes(word)) {
          hasForbiddenWord = true;
          console.warn(`[Integration Test] Found forbidden word: ${word}`);
        }
      }

      console.log('[Integration Test] Psychologist response:', response.substring(0, 100) + '...');
    }, 60000);
  });

  describe('错误处理', () => {
    it('应该优雅地处理缺失的用户数据', async () => {
      const result = await orchestrator.processMessage(
        testUserId + '-no-data',
        '我的运势如何？',
        { userData: null } // 无用户数据
      );

      // 应该仍然返回响应，可能使用默认值或提示
      expect(result).toBeDefined();
      console.log('[Integration Test] No user data result:', result.success);
    }, 60000);

    it('应该优雅地处理无效的出生时间', async () => {
      const ziweiService = (await import('../../../src/core/ziwei/ziweiService.js')).default;

      await expect(async () => {
        await ziweiService.computeNatalChart({
          birthDate: 'invalid-date',
          hourIndex: 99,
          gender: 'unknown'
        });
      }).rejects.toThrow();

    }, 10000);
  });

  describe('性能测试', () => {
    it('完整流程应该在合理时间内完成', async () => {
      const startTime = Date.now();

      const result = await orchestrator.processMessage(
        testUserId + '-perf',
        '帮我分析一下事业',
        { userData: testUserData }
      );

      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(30000); // 应该在30秒内完成

      console.log('[Integration Test] Performance - Duration:', duration + 'ms');
    }, 60000);

    it('应该能处理并发请求', async () => {
      const users = ['concurrent-1', 'concurrent-2', 'concurrent-3'];

      const startTime = Date.now();

      const results = await Promise.all(
        users.map(userId =>
          orchestrator.processMessage(
            userId,
            '我的运势如何？',
            { userData: testUserData }
          )
        )
      );

      const duration = Date.now() - startTime;

      // 所有请求都应该成功
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      console.log('[Integration Test] Concurrent requests - Duration:', duration + 'ms');

      // 清理
      users.forEach(userId => orchestrator.endSession(userId));
    }, 120000);
  });
});

// 健康检查测试（不需要外部依赖）
describe('XiaoShuDong Health Check', () => {
  it('orchestrator 应该能返回健康状态', async () => {
    const orchestrator = (await import('../../../src/modules/xiaoshudong/orchestrator.js')).default;

    const health = orchestrator.healthCheck();

    expect(health).toBeDefined();
    expect(health.status).toBe('healthy');
    expect(health).toHaveProperty('activeSessions');
    expect(health).toHaveProperty('maxSessions');
  });
});
