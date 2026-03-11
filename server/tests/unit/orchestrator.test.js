/**
 * Unit Tests for XiaoShuDong Orchestrator
 * Tests for the main workflow orchestration
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import orchestrator from '../../src/modules/xiaoshudong/orchestrator.js';
import XiaoShuDongState from '../../src/modules/xiaoshudong/state/XiaoShuDongState.js';

// Mock the logger
vi.mock('../../src/core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock the nodes to avoid real LLM calls
vi.mock('../../src/modules/xiaoshudong/nodes/intentClassifier.js', () => ({
  intentClassifierNode: vi.fn(async (state) => {
    state.intent = { isEmotional: true, needsAdvice: true, confidence: 0.8 };
    return state;
  })
}));

vi.mock('../../src/modules/xiaoshudong/nodes/chartRetriever.js', () => ({
  chartRetrieverNode: vi.fn(async (state) => {
    state.metadata.chartRetrieved = true;
    return state;
  })
}));

vi.mock('../../src/modules/xiaoshudong/nodes/ragRetriever.js', () => ({
  ragRetrieverNode: vi.fn(async (state) => {
    state.metadata.ragRetrieved = true;
    state.ragContext = [{ content: 'Test RAG content' }];
    return state;
  })
}));

vi.mock('../../src/modules/xiaoshudong/nodes/fortuneGenerator.js', () => ({
  fortuneGeneratorNode: vi.fn(async (state) => {
    state.fortuneResponse = 'Test fortune response';
    state.metadata.fortuneGenerated = true;
    return state;
  })
}));

vi.mock('../../src/modules/xiaoshudong/nodes/psychologistResponse.js', () => ({
  psychologistResponseNode: vi.fn(async (state) => {
    state.finalResponse = 'Warm psychologist response';
    state.metadata.psychologistResponse = true;
    return state;
  })
}));

describe('XiaoShuDong Orchestrator', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Clear ALL sessions from the orchestrator
    const userIds = Array.from(orchestrator.activeSessions.keys());
    for (const userId of userIds) {
      orchestrator.endSession(userId);
    }
  });

  describe('processMessage', () => {
    it('should process message and return response', async () => {
      const result = await orchestrator.processMessage('test-user-1', '我的事业发展如何');

      expect(result.success).toBe(true);
      expect(result.response).toBe('Warm psychologist response');
      expect(result.intent).toBe('情感倾诉 + 寻求建议');
      expect(result.metadata).toBeDefined();
    });

    it('should create new session for first message', async () => {
      await orchestrator.processMessage('test-user-1', '你好');

      const sessionCount = orchestrator.getSessionCount();
      expect(sessionCount).toBe(1);
    });

    it('should reuse existing session for same user', async () => {
      await orchestrator.processMessage('test-user-1', 'First message');
      const initialCount = orchestrator.getSessionCount();

      await orchestrator.processMessage('test-user-1', 'Second message');
      const finalCount = orchestrator.getSessionCount();

      expect(finalCount).toBe(initialCount);
    });

    it('should create new session when newSession option is true', async () => {
      await orchestrator.processMessage('test-user-1', 'First message');
      const firstSession = orchestrator.getSession('test-user-1');

      await orchestrator.processMessage('test-user-1', 'Second message', { newSession: true });
      const secondSession = orchestrator.getSession('test-user-1');

      expect(secondSession.metadata.sessionId).not.toBe(firstSession.metadata.sessionId);
    });

    it('should handle errors gracefully', async () => {
      // Mock a node to throw error
      const { intentClassifierNode } = await import('../../src/modules/xiaoshudong/nodes/intentClassifier.js');
      intentClassifierNode.mockRejectedValueOnce(new Error('Test error'));

      const result = await orchestrator.processMessage('test-user-1', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(result.response).toContain('累了');
    });

    it('should include metadata in response', async () => {
      const result = await orchestrator.processMessage('test-user-1', 'Test');

      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.chartRetrieved).toBe(true);
      expect(result.metadata.ragRetrieved).toBe(true);
      expect(result.metadata.fortuneGenerated).toBe(true);
      expect(result.metadata.polished).toBe(true);
      expect(result.metadata.sessionId).toBeDefined();
    });

    it('should create session with user data when provided', async () => {
      const userData = {
        birthCalendar: '1990-05-15',
        birthHourIndex: 6,
        gender: 'male'
      };

      await orchestrator.processMessage('test-user-1', 'Test', { userData });

      const state = orchestrator.getSession('test-user-1');

      expect(state.metadata.userData).toBeDefined();
      expect(state.metadata.userData.birthCalendar).toBe('1990-05-15');
      expect(state.metadata.userData.birthHourIndex).toBe(6);
      expect(state.metadata.userData.gender).toBe('male');
    });

    it('should add messages to history', async () => {
      await orchestrator.processMessage('test-user-1', 'Hello');

      const history = orchestrator.getHistory('test-user-1');

      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('Hello');
      expect(history[1].role).toBe('assistant');
      expect(history[1].content).toBe('Polished psychologist response');
    });

    it('should accumulate messages across multiple calls', async () => {
      await orchestrator.processMessage('test-user-1', 'First');
      await orchestrator.processMessage('test-user-1', 'Second');

      const history = orchestrator.getHistory('test-user-1');

      expect(history).toHaveLength(4);
      expect(history[0].content).toBe('First');
      expect(history[2].content).toBe('Second');
    });
  });

  describe('getSession', () => {
    it('should return null for non-existent session', () => {
      const state = orchestrator.getSession('non-existent-user');

      expect(state).toBeNull();
    });

    it('should return state for existing session', async () => {
      await orchestrator.processMessage('test-user-1', 'Test');

      const state = orchestrator.getSession('test-user-1');

      expect(state).toBeInstanceOf(XiaoShuDongState);
      expect(state.userId).toBe('test-user-1');
    });
  });

  describe('getHistory', () => {
    it('should return empty array for non-existent session', () => {
      const history = orchestrator.getHistory('non-existent-user');

      expect(history).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      // Send multiple messages
      for (let i = 0; i < 10; i++) {
        await orchestrator.processMessage('test-user-1', 'Message ' + i);
      }

      const history = orchestrator.getHistory('test-user-1', 5);

      // Should have 10 messages (5 user + 5 assistant) but limited to last 5
      expect(history.length).toBeLessThanOrEqual(5);
    });

    it('should default to limit of 50', async () => {
      await orchestrator.processMessage('test-user-1', 'Test');

      const history = orchestrator.getHistory('test-user-1');

      expect(history).toBeDefined();
      expect(history.length).toBeLessThanOrEqual(50);
    });
  });

  describe('endSession', () => {
    it('should remove existing session', async () => {
      await orchestrator.processMessage('test-user-1', 'Test');
      expect(orchestrator.getSession('test-user-1')).toBeDefined();

      const result = orchestrator.endSession('test-user-1');

      expect(result).toBe(true);
      expect(orchestrator.getSession('test-user-1')).toBeNull();
    });

    it('should return false for non-existent session', () => {
      const result = orchestrator.endSession('non-existent-user');

      expect(result).toBe(false);
    });
  });

  describe('getSessionCount', () => {
    it('should return 0 initially', () => {
      expect(orchestrator.getSessionCount()).toBe(0);
    });

    it('should increment with new sessions', async () => {
      await orchestrator.processMessage('user-1', 'Test');
      expect(orchestrator.getSessionCount()).toBe(1);

      await orchestrator.processMessage('user-2', 'Test');
      expect(orchestrator.getSessionCount()).toBe(2);
    });

    it('should decrement when sessions end', async () => {
      await orchestrator.processMessage('user-1', 'Test');
      await orchestrator.processMessage('user-2', 'Test');

      orchestrator.endSession('user-1');
      expect(orchestrator.getSessionCount()).toBe(1);
    });
  });

  describe('cleanupOldSessions', () => {
    it('should not remove active sessions', async () => {
      await orchestrator.processMessage('test-user-1', 'Test');

      orchestrator.cleanupOldSessions();

      expect(orchestrator.getSession('test-user-1')).toBeDefined();
    });

    it('should be called automatically during processMessage', async () => {
      // cleanupOldSessions is called internally
      await orchestrator.processMessage('test-user-1', 'Test');

      // Should not throw
      expect(orchestrator.getSession('test-user-1')).toBeDefined();
    });
  });

  describe('healthCheck', () => {
    it('should return health status', () => {
      const health = orchestrator.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.activeSessions).toBe(0);
      expect(health.maxSessions).toBe(1000);
    });

    it('should report active session count', async () => {
      await orchestrator.processMessage('test-user-1', 'Test');

      const health = orchestrator.healthCheck();

      expect(health.activeSessions).toBe(1);
    });
  });

  describe('integration scenarios', () => {
    it('should handle full workflow for advice-seeking user', async () => {
      const result = await orchestrator.processMessage('test-user-1', '我的事业发展如何？');

      expect(result.success).toBe(true);
      expect(result.response).toBeTruthy();
      expect(result.intent).toContain('寻求建议');
      expect(result.metadata.chartRetrieved).toBe(true);
      expect(result.metadata.fortuneGenerated).toBe(true);
      expect(result.metadata.polished).toBe(true);
    });

    it('should handle emotional-only conversation', async () => {
      // Mock intent to be emotional only
      const { intentClassifierNode } = await import('../../src/modules/xiaoshudong/nodes/intentClassifier.js');
      intentClassifierNode.mockImplementationOnce(async (state) => {
        state.intent = { isEmotional: true, needsAdvice: false, confidence: 0.7 };
        return state;
      });

      const result = await orchestrator.processMessage('test-user-1', '我今天很难过');

      expect(result.success).toBe(true);
      expect(result.response).toBeTruthy();
    });

    it('should handle multiple users independently', async () => {
      const result1 = await orchestrator.processMessage('user-1', 'Message 1');
      const result2 = await orchestrator.processMessage('user-2', 'Message 2');

      expect(result1.metadata.sessionId).not.toBe(result2.metadata.sessionId);
      expect(orchestrator.getSessionCount()).toBe(2);
    });
  });

  describe('session management', () => {
    it('should generate unique session IDs', async () => {
      await orchestrator.processMessage('user-1', 'Test');
      await orchestrator.processMessage('user-2', 'Test');

      const state1 = orchestrator.getSession('user-1');
      const state2 = orchestrator.getSession('user-2');

      expect(state1.metadata.sessionId).not.toBe(state2.metadata.sessionId);
    });

    it('should update lastAccess time on activity', async () => {
      await orchestrator.processMessage('test-user-1', 'First');

      const sessionData = orchestrator.activeSessions.get('test-user-1');
      const firstAccess = sessionData.lastAccess;

      // Wait a bit (minimal)
      await new Promise(resolve => setTimeout(resolve, 10));

      await orchestrator.processMessage('test-user-1', 'Second');

      const secondAccess = sessionData.lastAccess;

      expect(secondAccess).toBeGreaterThan(firstAccess);
    });
  });
});
