/**
 * Unit Tests for XiaoShuDong Controller
 * Tests for HTTP request handling
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import controller from '../../src/modules/xiaoshudong/controller.js';
import orchestrator from '../../src/modules/xiaoshudong/orchestrator.js';

// Mock the logger
vi.mock('../../src/core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock the orchestrator
vi.mock('../../src/modules/xiaoshudong/orchestrator.js', () => ({
  default: {
    processMessage: vi.fn(),
    getHistory: vi.fn(),
    getSession: vi.fn(),
    endSession: vi.fn(),
    healthCheck: vi.fn(),
    activeSessions: new Map()
  }
}));

describe('XiaoShuDong Controller', () => {
  let mockReq, mockRes;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset all orchestrator methods
    orchestrator.processMessage.mockResolvedValue({
      success: true,
      response: 'Test response',
      intent: '情感倾诉',
      metadata: { processingTime: 100 }
    });
    orchestrator.getHistory.mockReturnValue([]);
    orchestrator.getSession.mockReturnValue(null);
    orchestrator.endSession.mockReturnValue(true);
    orchestrator.healthCheck.mockReturnValue({
      status: 'healthy',
      activeSessions: 0,
      maxSessions: 1000
    });

    // Mock request and response objects
    mockReq = {
      user: {
        id: 'test-user-id',
        birthCalendar: '1990-05-15',
        birthHourIndex: 6,
        gender: 'male'
      },
      body: {},
      query: {}
    };

    mockRes = {
      status: vi.fn(function() { return this; }),
      json: vi.fn(function() { return this; })
    };
  });

  describe('sendMessage', () => {
    it('should send message and return response', async () => {
      mockReq.body.message = 'Hello, how are you?';

      await controller.sendMessage(mockReq, mockRes);

      expect(orchestrator.processMessage).toHaveBeenCalledWith(
        'test-user-id',
        'Hello, how are you?',
        expect.objectContaining({
          userData: expect.objectContaining({
            birthCalendar: '1990-05-15',
            birthHourIndex: 6,
            gender: 'male'
          })
        })
      );

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        response: 'Test response',
        intent: '情感倾诉'
      }));
    });

    it('should trim whitespace from message', async () => {
      mockReq.body.message = '  Hello with spaces  ';

      await controller.sendMessage(mockReq, mockRes);

      expect(orchestrator.processMessage).toHaveBeenCalledWith(
        'test-user-id',
        'Hello with spaces',
        expect.any(Object)
      );
    });

    it('should return error when message is empty', async () => {
      mockReq.body.message = '';

      await controller.sendMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: '消息不能为空'
      }));
      expect(orchestrator.processMessage).not.toHaveBeenCalled();
    });

    it('should return error when message is missing', async () => {
      mockReq.body = {};

      await controller.sendMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: '消息不能为空'
      }));
    });

    it('should return error when message is not a string', async () => {
      mockReq.body.message = 12345;

      await controller.sendMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: '消息不能为空'
      }));
    });

    it('should handle orchestrator errors', async () => {
      orchestrator.processMessage.mockResolvedValue({
        success: false,
        error: 'Processing failed'
      });

      mockReq.body.message = 'Test';

      await controller.sendMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Processing failed'
      }));
    });

    it('should pass userData with birth info if available', async () => {
      mockReq.user.birthCalendar = '1995-08-20';
      mockReq.user.birthHourIndex = 8;
      mockReq.user.gender = 'female';
      mockReq.body.message = 'Test';

      await controller.sendMessage(mockReq, mockRes);

      expect(orchestrator.processMessage).toHaveBeenCalledWith(
        'test-user-id',
        'Test',
        expect.objectContaining({
          userData: expect.objectContaining({
            birthCalendar: '1995-08-20',
            birthHourIndex: 8,
            gender: 'female'
          })
        })
      );
    });

    it('should handle user without birth info', async () => {
      mockReq.user = { id: 'test-user-id' };
      mockReq.body.message = 'Test';

      await controller.sendMessage(mockReq, mockRes);

      expect(orchestrator.processMessage).toHaveBeenCalledWith(
        'test-user-id',
        'Test',
        expect.objectContaining({
          userData: null
        })
      );
    });
  });

  describe('getHistory', () => {
    it('should get conversation history', async () => {
      const mockHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
      ];
      orchestrator.getHistory.mockReturnValue(mockHistory);

      await controller.getHistory(mockReq, mockRes);

      expect(orchestrator.getHistory).toHaveBeenCalledWith('test-user-id', 50);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        history: mockHistory,
        count: 2
      });
    });

    it('should use custom limit from query', async () => {
      mockReq.query.limit = '10';

      await controller.getHistory(mockReq, mockRes);

      expect(orchestrator.getHistory).toHaveBeenCalledWith('test-user-id', 10);
    });

    it('should return empty history array', async () => {
      orchestrator.getHistory.mockReturnValue([]);

      await controller.getHistory(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        history: [],
        count: 0
      });
    });
  });

  describe('getSession', () => {
    it('should return session info when session exists', async () => {
      const mockState = {
        metadata: {
          sessionId: 'test-session-123',
          userData: { birthCalendar: '1990-05-15' }
        },
        messages: [1, 2, 3, 4, 5]
      };
      orchestrator.getSession.mockReturnValue(mockState);

      await controller.getSession(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        hasSession: true,
        session: {
          sessionId: 'test-session-123',
          messageCount: 5,
          hasBirthInfo: true
        }
      });
    });

    it('should return hasSession false when no session', async () => {
      orchestrator.getSession.mockReturnValue(null);

      await controller.getSession(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        hasSession: false,
        session: null
      });
    });

    it('should handle session without userData', async () => {
      const mockState = {
        metadata: { sessionId: 'test-session-123' },
        messages: []
      };
      orchestrator.getSession.mockReturnValue(mockState);

      await controller.getSession(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        hasSession: true,
        session: {
          sessionId: 'test-session-123',
          messageCount: 0,
          hasBirthInfo: false
        }
      });
    });
  });

  describe('endSession', () => {
    it('should end session successfully', async () => {
      await controller.endSession(mockReq, mockRes);

      expect(orchestrator.endSession).toHaveBeenCalledWith('test-user-id');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '会话已结束'
      });
    });

    it('should handle when session does not exist', async () => {
      orchestrator.endSession.mockReturnValue(false);

      await controller.endSession(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '会话已结束'
      });
    });
  });

  describe('health', () => {
    it('should return health status', async () => {
      orchestrator.healthCheck.mockReturnValue({
        status: 'healthy',
        activeSessions: 5,
        maxSessions: 1000
      });

      await controller.health(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        health: {
          status: 'healthy',
          activeSessions: 5,
          maxSessions: 1000
        }
      });
    });
  });
});
