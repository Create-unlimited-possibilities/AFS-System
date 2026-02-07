/**
 * 性能和并发测试
 * 测试API端点的性能和并发处理能力
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { vi, describe, test, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import SentimentManager from '../../src/services/langchain/sentimentManager.js';
import DualStorage from '../../src/services/dualStorage.js';

// Mock modules
vi.mock('../../src/services/langchain/sentimentManager.js');
vi.mock('../../src/services/dualStorage.js');

describe('Performance Tests', () => {
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

  describe('Concurrency Tests', () => {
    test('should handle concurrent requests', async () => {
      const promises = Array(10).fill(0).map((_, i) => {
        return request(app)
          .get('/api/storage/guidelines/test_user');
      });

      DualStorage.loadAssistantsGuidelines = vi.fn()
        .mockResolvedValue([]);

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(DualStorage.loadAssistantsGuidelines).toHaveBeenCalledTimes(10);
    });
  });

  describe('Performance Tests', () => {
    test('should handle rapid sentiment updates', async () => {
      const updateData = {
        message: '测试消息',
        conversationHistory: [],
        isConversationEnd: false
      };

      // Mock updateSentiment directly
      SentimentManager.updateSentiment = vi.fn().mockResolvedValue({
        newScore: 50,
        reason: '小幅提升'
      });

      // Test 100 rapid requests
      const startTime = Date.now();
      const promises = Array(100).fill(0).map(async (_, i) => {
        return request(app)
          .post('/api/sentiment/update')
          .send({ targetUserId, strangerId, updateData });
      });

      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
      console.log(`100 concurrent requests completed in ${duration}ms`);
    });
  });
});
