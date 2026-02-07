/**
 * SentimentManager API集成测试
 * 测试SentimentManager相关的API端点
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { vi, describe, test, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import SentimentManager from '../../../src/services/langchain/sentimentManager.js';

// Mock modules
vi.mock('../../../src/services/langchain/sentimentManager.js');

describe('SentimentManager API Integration', () => {
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

    app.get('/api/sentiment/:targetUserId/:strangerId', async (req, res) => {
      try {
        const { targetUserId, strangerId } = req.params;
        const result = await SentimentManager.getStrangerSentiment(targetUserId, strangerId);
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    vi.clearAllMocks();
  });

  test('should update sentiment through API', async () => {
    const updateData = {
      message: '今天天气很好',
      conversationHistory: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ],
      isConversationEnd: true
    };

    // Mock updateSentiment directly
    SentimentManager.updateSentiment = vi.fn().mockResolvedValue({
      newScore: 55,
      reason: '基于正面消息的好感度提升'
    });

    const response = await request(app)
      .post('/api/sentiment/update')
      .send({ targetUserId, strangerId, updateData });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(SentimentManager.updateSentiment).toHaveBeenCalledWith(
      targetUserId,
      strangerId,
      updateData
    );
  });

  test('should get sentiment through API', async () => {
    SentimentManager.getStrangerSentiment = vi.fn().mockResolvedValue({
      currentScore: 60,
      totalConversations: 5,
      totalMessages: 12
    });

    const response = await request(app)
      .get(`/api/sentiment/${targetUserId}/${strangerId}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.currentScore).toBe(60);
    expect(SentimentManager.getStrangerSentiment).toHaveBeenCalledWith(targetUserId, strangerId);
  });

  test('should handle API errors gracefully', async () => {
    // Mock updateSentiment to throw error
    SentimentManager.updateSentiment = vi.fn().mockRejectedValue(
      new Error('Database connection failed')
    );

    const response = await request(app)
      .post('/api/sentiment/update')
      .send({ targetUserId, strangerId, updateData: { message: 'test' } });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Database connection failed');
  });
});
