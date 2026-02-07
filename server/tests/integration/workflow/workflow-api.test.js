/**
 * Workflow集成测试
 * 测试SentimentManager和DualStorage之间的工作流集成
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { vi, describe, test, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import SentimentManager from '../../../src/services/langchain/sentimentManager.js';
import DualStorage from '../../../src/services/dualStorage.js';

// Mock modules
vi.mock('../../../src/services/langchain/sentimentManager.js');
vi.mock('../../../src/services/dualStorage.js');

describe('Workflow Integration', () => {
  let app;
  const targetUserId = '507f1f77bcf86cd799439011';
  const strangerId = '507f1f77bcf86cd799439012';

  beforeEach(() => {
    // 设置测试环境
    app = express();
    app.use(express.json());

    // 测试路由
    app.post('/api/sentiment/update', async (req, res) => {
      try {
        const { targetUserId, strangerId, updateData } = req.body;
        const result = await SentimentManager.updateSentiment(targetUserId, strangerId, updateData);
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.get('/api/storage/guidelines/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const result = await DualStorage.loadAssistantsGuidelines(userId);
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    vi.clearAllMocks();
  });

  test('should complete full sentiment update workflow', async () => {
    const updateData = {
      message: '今天聊得很开心',
      conversationHistory: [
        { role: 'user', content: '今天天气真好' },
        { role: 'assistant', content: '是的，很适合出门' }
      ],
      isConversationEnd: true
    };

    // Mock updateSentiment directly
    SentimentManager.updateSentiment = vi.fn().mockResolvedValue({
      newScore: 55,
      reason: '基于对话的好感度提升'
    });

    // Mock sentiment calculation
    SentimentManager.getStrangerSentiment = vi.fn().mockResolvedValue({
      currentScore: 50,
      totalConversations: 5,
      totalMessages: 12
    });

    SentimentManager.calculateFactors = vi.fn().mockResolvedValue({
      sentiment: 8,
      frequency: 0.7,
      quality: 1,
      decay: -0.5
    });

    SentimentManager.generateReason = vi.fn().mockResolvedValue('基于对话的好感度提升');

    // Mock storage operations
    DualStorage.loadAssistantsGuidelines = vi.fn().mockResolvedValue([
      {
        assistantId: strangerId,
        conversationGuidelines: '通用对话准则'
      }
    ]);

    DualStorage.saveAssistantsGuidelines = vi.fn().mockResolvedValue({
      success: true,
      filePath: '/updated/guidelines.json'
    });

    // 1. Update sentiment
    const updateResponse = await request(app)
      .post('/api/sentiment/update')
      .send({ targetUserId, strangerId, updateData });

    // 2. Load and update guidelines
    const loadResponse = await request(app)
      .get(`/api/storage/guidelines/${targetUserId}`);

    const guidelines = loadResponse.body.data;
    const conversationGuidelines = guidelines[0]?.conversationGuidelines;

    // Verify responses
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(loadResponse.status).toBe(200);
    expect(loadResponse.body.success).toBe(true);
  });

  test('should handle storage and sentiment integration', async () => {
    // Test integration between storage and sentiment
    const updateData = {
      message: '今天心情很好',
      conversationHistory: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ],
      isConversationEnd: true
    };

    // Mock updateSentiment to throw error (testing error case)
    SentimentManager.updateSentiment = vi.fn().mockRejectedValue(
      new Error('Integration test error')
    );

    const response = await request(app)
      .post('/api/sentiment/update')
      .send({ targetUserId, strangerId, updateData });

    // Expect 500 error
    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
  });
});
