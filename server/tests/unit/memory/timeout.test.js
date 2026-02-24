/**
 * Timeout Detection System Unit Tests
 * Tests the session timeout detection and memory save functionality
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the logger
vi.mock('../../../src/core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock ChatSession model
const mockSessions = [];
vi.mock('../../../src/modules/chat/model.js', () => ({
  default: {
    find: vi.fn().mockImplementation((query) => {
      let results = mockSessions.filter(s => {
        if (query.isActive !== undefined && s.isActive !== query.isActive) return false;
        if (query.lastMessageAt?.$lt) {
          return new Date(s.lastMessageAt) < new Date(query.lastMessageAt.$lt);
        }
        return true;
      });
      return Promise.resolve(results);
    }),
    findOne: vi.fn().mockImplementation((query) => {
      return Promise.resolve(mockSessions.find(s => s.sessionId === query.sessionId) || null);
    }),
    findOneAndUpdate: vi.fn().mockImplementation((query, update) => {
      const session = mockSessions.find(s => s.sessionId === query.sessionId);
      if (session) {
        Object.assign(session, update);
      }
      return Promise.resolve(session);
    })
  }
}));

// Mock User model
vi.mock('../../../src/modules/user/model.js', () => ({
  default: {
    findById: vi.fn().mockImplementation((id) => {
      return Promise.resolve({
        _id: id,
        name: 'Test User',
        toString: () => id
      });
    })
  }
}));

// Mock DualStorage
vi.mock('../../../src/core/storage/dual.js', () => ({
  default: class MockDualStorage {
    async loadRoleCardV2(userId) {
      return {
        coreLayer: { personality: 'test' },
        safetyGuardrails: {},
        calibration: {}
      };
    }
  }
}));

// Mock MemoryExtractor
vi.mock('../../../src/modules/memory/MemoryExtractor.js', () => ({
  default: class MockMemoryExtractor {
    async extract(options) {
      return {
        summary: 'Test summary',
        keyTopics: ['topic1', 'topic2'],
        facts: ['fact1'],
        tags: ['tag1']
      };
    }
  }
}));

// Mock MemoryStore
const savedMemories = [];
vi.mock('../../../src/modules/memory/MemoryStore.js', () => ({
  default: class MockMemoryStore {
    async saveBidirectional(options) {
      savedMemories.push(options);
      return {
        userA: { memoryId: 'mem_test_a' },
        userB: { memoryId: 'mem_test_b' }
      };
    }
  }
}));

// Import Scheduler after mocks
import Scheduler, { getScheduler } from '../../../src/modules/memory/Scheduler.js';

describe('Timeout Detection System', () => {
  let scheduler;

  beforeEach(() => {
    // Clear mock data
    mockSessions.length = 0;
    savedMemories.length = 0;

    // Create new scheduler instance
    scheduler = new Scheduler();
    scheduler.timeoutCheckIntervalMs = 100; // Fast interval for testing
    scheduler.timeoutThresholdMs = 30 * 60 * 1000; // 30 minutes
  });

  afterEach(() => {
    // Stop any running timers
    scheduler.stop();
    vi.clearAllMocks();
  });

  describe('checkSessionTimeouts', () => {
    it('should find sessions that have been inactive for more than 30 minutes', async () => {
      // Create a session that's been inactive for 45 minutes
      const oldDate = new Date(Date.now() - 45 * 60 * 1000);
      mockSessions.push({
        sessionId: 'session_timeout_1',
        targetUserId: 'user_target_1',
        interlocutorUserId: 'user_interlocutor_1',
        isActive: true,
        lastMessageAt: oldDate,
        relation: 'friend',
        cycles: [{
          cycleId: 'cycle_1',
          startedAt: oldDate,
          messages: [
            { role: 'user', content: 'Hello', timestamp: oldDate },
            { role: 'assistant', content: 'Hi there!', timestamp: oldDate }
          ]
        }],
        currentCycleId: 'cycle_1'
      });

      const result = await scheduler.checkSessionTimeouts();

      expect(result.checked).toBe(1);
      expect(result.timedOut).toBe(1);
      expect(result.processed).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should not find sessions that are still active', async () => {
      // Create a session that was active 5 minutes ago
      const recentDate = new Date(Date.now() - 5 * 60 * 1000);
      mockSessions.push({
        sessionId: 'session_active_1',
        targetUserId: 'user_target_1',
        interlocutorUserId: 'user_interlocutor_1',
        isActive: true,
        lastMessageAt: recentDate,
        cycles: [{ cycleId: 'cycle_1', startedAt: recentDate, messages: [] }],
        currentCycleId: 'cycle_1'
      });

      const result = await scheduler.checkSessionTimeouts();

      expect(result.checked).toBe(0);
      expect(result.timedOut).toBe(0);
    });

    it('should not find sessions that are not active', async () => {
      const oldDate = new Date(Date.now() - 45 * 60 * 1000);
      mockSessions.push({
        sessionId: 'session_inactive_1',
        targetUserId: 'user_target_1',
        interlocutorUserId: 'user_interlocutor_1',
        isActive: false, // Not active
        lastMessageAt: oldDate,
        cycles: [{ cycleId: 'cycle_1', startedAt: oldDate, messages: [] }],
        currentCycleId: 'cycle_1'
      });

      const result = await scheduler.checkSessionTimeouts();

      expect(result.checked).toBe(0);
    });

    it('should handle multiple timed-out sessions', async () => {
      const oldDate = new Date(Date.now() - 45 * 60 * 1000);

      // Add 3 timed-out sessions
      for (let i = 0; i < 3; i++) {
        mockSessions.push({
          sessionId: `session_timeout_${i}`,
          targetUserId: `user_target_${i}`,
          interlocutorUserId: `user_interlocutor_${i}`,
          isActive: true,
          lastMessageAt: oldDate,
          relation: 'stranger',
          cycles: [{
            cycleId: `cycle_${i}`,
            startedAt: oldDate,
            messages: [
              { role: 'user', content: `Message ${i}`, timestamp: oldDate },
              { role: 'assistant', content: `Response ${i}`, timestamp: oldDate }
            ]
          }],
          currentCycleId: `cycle_${i}`
        });
      }

      const result = await scheduler.checkSessionTimeouts();

      expect(result.checked).toBe(3);
      expect(result.timedOut).toBe(3);
      expect(result.processed).toBe(3);
    });
  });

  describe('processTimedOutSession', () => {
    it('should save memory and start new cycle', async () => {
      const oldDate = new Date(Date.now() - 45 * 60 * 1000);
      const session = {
        sessionId: 'session_process_1',
        targetUserId: 'user_target_1',
        interlocutorUserId: 'user_interlocutor_1',
        isActive: true,
        lastMessageAt: oldDate,
        relation: 'friend',
        cycles: [{
          cycleId: 'cycle_old',
          startedAt: oldDate,
          messages: [
            { role: 'user', content: 'Hello', timestamp: oldDate },
            { role: 'assistant', content: 'Hi there!', timestamp: oldDate },
            { role: 'user', content: 'How are you?', timestamp: oldDate },
            { role: 'assistant', content: 'I am well!', timestamp: oldDate }
          ]
        }],
        currentCycleId: 'cycle_old'
      };

      const result = await scheduler.processTimedOutSession(session);

      expect(result).toBe(true);
      // Memory should have been saved
      expect(savedMemories.length).toBeGreaterThan(0);
    });

    it('should skip memory save if insufficient messages', async () => {
      const oldDate = new Date(Date.now() - 45 * 60 * 1000);
      const session = {
        sessionId: 'session_short_1',
        targetUserId: 'user_target_1',
        interlocutorUserId: 'user_interlocutor_1',
        isActive: true,
        lastMessageAt: oldDate,
        relation: 'stranger',
        cycles: [{
          cycleId: 'cycle_short',
          startedAt: oldDate,
          messages: [
            { role: 'user', content: 'Hi', timestamp: oldDate }
            // Only 1 message, not enough for memory save
          ]
        }],
        currentCycleId: 'cycle_short'
      };

      const result = await scheduler.processTimedOutSession(session);

      expect(result).toBe(true);
      // Memory should not have been saved (only 1 message)
      expect(savedMemories.length).toBe(0);
    });

    it('should handle missing user data gracefully', async () => {
      const oldDate = new Date(Date.now() - 45 * 60 * 1000);
      const session = {
        sessionId: 'session_no_user',
        targetUserId: null, // Missing target user
        interlocutorUserId: 'user_interlocutor_1',
        isActive: true,
        lastMessageAt: oldDate,
        cycles: [{
          cycleId: 'cycle_1',
          startedAt: oldDate,
          messages: [
            { role: 'user', content: 'Hello', timestamp: oldDate },
            { role: 'assistant', content: 'Hi!', timestamp: oldDate }
          ]
        }],
        currentCycleId: 'cycle_1'
      };

      const result = await scheduler.processTimedOutSession(session);

      // Should return false due to missing users
      expect(result).toBe(false);
    });
  });

  describe('startNewCycleForSession', () => {
    it('should end current cycle and create new one', async () => {
      const session = {
        sessionId: 'session_cycle_1',
        currentCycleId: 'cycle_old',
        cycles: [{
          cycleId: 'cycle_old',
          startedAt: new Date(),
          messages: []
        }]
      };

      const result = await scheduler.startNewCycleForSession(session);

      expect(result).toBe(true);
      // New cycle should have been created
      expect(session.currentCycleId).not.toBe('cycle_old');
    });
  });

  describe('startTimeoutChecker', () => {
    it('should start periodic checking', () => {
      scheduler.startTimeoutChecker();

      expect(scheduler.isTimeoutCheckerRunning).toBe(true);
      expect(scheduler.timeoutTimerId).not.toBeNull();
    });

    it('should not start if already running', () => {
      scheduler.startTimeoutChecker();
      const firstTimerId = scheduler.timeoutTimerId;

      scheduler.startTimeoutChecker(); // Try to start again

      expect(scheduler.isTimeoutCheckerRunning).toBe(true);
      expect(scheduler.timeoutTimerId).toBe(firstTimerId);
    });
  });

  describe('stopTimeoutChecker', () => {
    it('should stop the checker', () => {
      scheduler.startTimeoutChecker();
      scheduler.stopTimeoutChecker();

      expect(scheduler.isTimeoutCheckerRunning).toBe(false);
      expect(scheduler.timeoutTimerId).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('should return timeout checker status', () => {
      scheduler.startTimeoutChecker();
      const status = scheduler.getStatus();

      expect(status.timeoutChecker).toBeDefined();
      expect(status.timeoutChecker.isRunning).toBe(true);
      expect(status.timeoutChecker.checkIntervalMinutes).toBe(100 / 60000);
      expect(status.timeoutChecker.timeoutThresholdMinutes).toBe(30);
    });
  });

  describe('triggerTimeoutCheck', () => {
    it('should manually trigger a check', async () => {
      const result = await scheduler.triggerTimeoutCheck();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('checked');
      expect(result).toHaveProperty('timedOut');
      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('Configurable Timeout Threshold', () => {
    it('should use default threshold of 30 minutes', () => {
      const defaultScheduler = new Scheduler();
      expect(defaultScheduler.timeoutThresholdMs).toBe(30 * 60 * 1000);
    });

    it('should use environment variable for threshold if set', () => {
      const originalEnv = process.env.SESSION_TIMEOUT_MINUTES;
      process.env.SESSION_TIMEOUT_MINUTES = '60';

      const customScheduler = new Scheduler();
      expect(customScheduler.timeoutThresholdMs).toBe(60 * 60 * 1000);

      process.env.SESSION_TIMEOUT_MINUTES = originalEnv;
    });
  });
});

describe('getScheduler Singleton', () => {
  it('should return the same instance', () => {
    const scheduler1 = getScheduler();
    const scheduler2 = getScheduler();

    expect(scheduler1).toBe(scheduler2);
  });
});
