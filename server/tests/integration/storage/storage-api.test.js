/**
 * DualStorage API集成测试
 * 测试DualStorage相关的API端点
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { vi, describe, test, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import DualStorage from '../../../src/services/dualStorage.js';

// Mock modules
vi.mock('../../../src/services/dualStorage.js');

describe('DualStorage API Integration', () => {
  let app;

  beforeEach(() => {
    // 设置测试环境
    app = express();
    app.use(express.json());

    // 测试路由
    app.post('/api/storage/guidelines/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const { guidelines } = req.body;
        const result = await DualStorage.saveAssistantsGuidelines(userId, guidelines);
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

  test('should save guidelines through API', async () => {
    const guidelines = [
      {
        assistantId: 'assistant-1',
        conversationGuidelines: '测试对话准则'
      }
    ];

    DualStorage.saveAssistantsGuidelines = vi.fn().mockResolvedValue({
      success: true,
      filePath: '/test/guidelines.json'
    });

    const response = await request(app)
      .post('/api/storage/guidelines/test_user')
      .send({ guidelines });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.filePath).toBeDefined();
    expect(DualStorage.saveAssistantsGuidelines).toHaveBeenCalledWith('test_user', guidelines);
  });

  test('should load guidelines through API', async () => {
    const mockGuidelines = [
      {
        assistantId: 'assistant-1',
        conversationGuidelines: '测试对话准则'
      }
    ];

    DualStorage.loadAssistantsGuidelines = vi.fn().mockResolvedValue(mockGuidelines);

    const response = await request(app)
      .get('/api/storage/guidelines/test_user');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(mockGuidelines);
    expect(DualStorage.loadAssistantsGuidelines).toHaveBeenCalledWith('test_user');
  });

  test('should handle storage errors', async () => {
    DualStorage.saveAssistantsGuidelines = vi.fn().mockRejectedValue(
      new Error('Storage write failed')
    );

    const response = await request(app)
      .post('/api/storage/guidelines/test_user')
      .send({ guidelines: [] });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Storage write failed');
  });
});
