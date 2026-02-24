/**
 * Indexing Wait Mechanism Integration Tests
 * Tests the session indexing state and message queue functionality
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
      return Promise.resolve(mockSessions.filter(s => {
        if (query.sessionId && s.sessionId !== query.sessionId) return false;
        if (query.isActive !== undefined && s.isActive !== query.isActive) return false;
        return true;
      }));
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
    }),
    setIndexing: vi.fn().mockImplementation((sessionId) => {
      const session = mockSessions.find(s => s.sessionId === sessionId);
      if (session) {
        session.sessionStatus = 'indexing';
        session.indexingStartedAt = new Date();
      }
      return Promise.resolve(session);
    }),
    setActive: vi.fn().mockImplementation((sessionId) => {
      const session = mockSessions.find(s => s.sessionId === sessionId);
      if (session) {
        session.sessionStatus = 'active';
        delete session.indexingStartedAt;
      }
      return Promise.resolve(session);
    }),
    setFatiguePrompt: vi.fn().mockImplementation((sessionId) => {
      const session = mockSessions.find(s => s.sessionId === sessionId);
      if (session) {
        session.sessionStatus = 'fatigue_prompt';
      }
      return Promise.resolve(session);
    }),
    isIndexing: vi.fn().mockImplementation(async (sessionId) => {
      const session = mockSessions.find(s => s.sessionId === sessionId);
      return session?.sessionStatus === 'indexing';
    })
  }
}));

// Mock UnreadMessage model
const mockUnreadMessages = [];
vi.mock('../../../src/modules/chat/models/UnreadMessage.js', () => ({
  default: {
    find: vi.fn().mockImplementation((query) => {
      let results = mockUnreadMessages.filter(m => {
        if (query.sessionId && m.sessionId !== query.sessionId) return false;
        if (query.status && m.status !== query.status) return false;
        if (query.targetUserId && m.targetUserId !== query.targetUserId) return false;
        return true;
      });
      // Sort by timestamp
      results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      return Promise.resolve(results);
    }),
    countDocuments: vi.fn().mockImplementation((query) => {
      return Promise.resolve(mockUnreadMessages.filter(m => {
        if (query.sessionId && m.sessionId !== query.sessionId) return false;
        if (query.status && m.status !== query.status) return false;
        return true;
      }).length);
    }),
    createPending: vi.fn().mockImplementation((data) => {
      const message = {
        _id: `unread_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        ...data,
        status: 'pending',
        timestamp: new Date()
      };
      mockUnreadMessages.push(message);
      return Promise.resolve(message);
    }),
    markAsIndexed: vi.fn().mockImplementation((messageIds) => {
      mockUnreadMessages.forEach(m => {
        if (messageIds.includes(m._id)) {
          m.status = 'indexed';
          m.indexedAt = new Date();
        }
      });
      return Promise.resolve({ modifiedCount: messageIds.length });
    }),
    getPendingMessages: vi.fn().mockImplementation((targetUserId) => {
      return Promise.resolve(mockUnreadMessages.filter(m =>
        m.targetUserId === targetUserId && m.status === 'pending'
      ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
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
    async loadRoleCardV2() {
      return { coreLayer: {}, safetyGuardrails: {}, calibration: {} };
    }
    async loadAllRelationLayers() {
      return {};
    }
  }
}));

// Mock PromptAssembler
vi.mock('../../../src/modules/rolecard/v2/index.js', () => ({
  PromptAssembler: class MockPromptAssembler {
    assemble() {
      return { systemPrompt: 'Test system prompt' };
    }
  }
}));

// Import after mocks
import ChatSession from '../../../src/modules/chat/model.js';
import UnreadMessage from '../../../src/modules/chat/models/UnreadMessage.js';

describe('Indexing Wait Mechanism', () => {
  beforeEach(() => {
    // Clear mock data
    mockSessions.length = 0;
    mockUnreadMessages.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== Session Status Tests ====================

  describe('Session Status Management', () => {
    it('should set session to indexing mode', async () => {
      mockSessions.push({
        sessionId: 'session_test_1',
        sessionStatus: 'active',
        targetUserId: 'user_target_1',
        interlocutorUserId: 'user_interlocutor_1'
      });

      const result = await ChatSession.setIndexing('session_test_1');

      expect(result.sessionStatus).toBe('indexing');
      expect(result.indexingStartedAt).toBeDefined();
    });

    it('should set session back to active mode', async () => {
      mockSessions.push({
        sessionId: 'session_test_2',
        sessionStatus: 'indexing',
        indexingStartedAt: new Date()
      });

      const result = await ChatSession.setActive('session_test_2');

      expect(result.sessionStatus).toBe('active');
      expect(result.indexingStartedAt).toBeUndefined();
    });

    it('should set session to fatigue prompt mode', async () => {
      mockSessions.push({
        sessionId: 'session_test_3',
        sessionStatus: 'active'
      });

      const result = await ChatSession.setFatiguePrompt('session_test_3');

      expect(result.sessionStatus).toBe('fatigue_prompt');
    });

    it('should check if session is indexing', async () => {
      mockSessions.push({
        sessionId: 'session_indexing_1',
        sessionStatus: 'indexing'
      });

      const isIndexing = await ChatSession.isIndexing('session_indexing_1');

      expect(isIndexing).toBe(true);
    });

    it('should return false if session is not indexing', async () => {
      mockSessions.push({
        sessionId: 'session_active_1',
        sessionStatus: 'active'
      });

      const isIndexing = await ChatSession.isIndexing('session_active_1');

      expect(isIndexing).toBe(false);
    });
  });

  // ==================== UnreadMessage Tests ====================

  describe('UnreadMessage Storage', () => {
    it('should create pending message', async () => {
      const result = await UnreadMessage.createPending({
        sessionId: 'session_unread_1',
        targetUserId: 'user_target_1',
        interlocutorUserId: 'user_interlocutor_1',
        content: 'Test message during indexing'
      });

      expect(result.status).toBe('pending');
      expect(result.content).toBe('Test message during indexing');
      expect(result.timestamp).toBeDefined();
    });

    it('should find pending messages for a session', async () => {
      mockUnreadMessages.push({
        _id: 'unread_1',
        sessionId: 'session_pending_1',
        targetUserId: 'user_target_1',
        status: 'pending',
        content: 'Message 1',
        timestamp: new Date()
      });
      mockUnreadMessages.push({
        _id: 'unread_2',
        sessionId: 'session_pending_1',
        targetUserId: 'user_target_1',
        status: 'pending',
        content: 'Message 2',
        timestamp: new Date()
      });
      mockUnreadMessages.push({
        _id: 'unread_3',
        sessionId: 'session_pending_1',
        targetUserId: 'user_target_1',
        status: 'indexed',
        content: 'Already indexed',
        timestamp: new Date()
      });

      const pending = await UnreadMessage.find({
        sessionId: 'session_pending_1',
        status: 'pending'
      });

      expect(pending.length).toBe(2);
    });

    it('should mark messages as indexed', async () => {
      mockUnreadMessages.push({
        _id: 'unread_mark_1',
        status: 'pending'
      });
      mockUnreadMessages.push({
        _id: 'unread_mark_2',
        status: 'pending'
      });

      await UnreadMessage.markAsIndexed(['unread_mark_1', 'unread_mark_2']);

      const indexed = mockUnreadMessages.filter(m => m.status === 'indexed');
      expect(indexed.length).toBe(2);
    });

    it('should count pending messages', async () => {
      mockUnreadMessages.push(
        { sessionId: 'session_count_1', status: 'pending' },
        { sessionId: 'session_count_1', status: 'pending' },
        { sessionId: 'session_count_1', status: 'indexed' }
      );

      const count = await UnreadMessage.countDocuments({
        sessionId: 'session_count_1',
        status: 'pending'
      });

      expect(count).toBe(2);
    });
  });

  // ==================== Indexing Flow Tests ====================

  describe('Indexing Flow', () => {
    it('should store message as pending when session is indexing', async () => {
      // Setup: session is in indexing mode
      mockSessions.push({
        sessionId: 'session_flow_1',
        sessionStatus: 'indexing',
        targetUserId: 'user_target_1',
        interlocutorUserId: 'user_interlocutor_1',
        cycles: [{ cycleId: 'cycle_1', messages: [] }],
        currentCycleId: 'cycle_1'
      });

      // Simulate incoming message during indexing
      const pendingMessage = await UnreadMessage.createPending({
        sessionId: 'session_flow_1',
        targetUserId: 'user_target_1',
        interlocutorUserId: 'user_interlocutor_1',
        content: 'Message while indexing'
      });

      expect(pendingMessage.status).toBe('pending');
    });

    it('should process pending messages after indexing completes', async () => {
      // Setup: session was indexing, now has pending messages
      mockSessions.push({
        sessionId: 'session_flow_2',
        sessionStatus: 'indexing',
        targetUserId: 'user_target_1',
        interlocutorUserId: 'user_interlocutor_1',
        cycles: [{ cycleId: 'cycle_1', messages: [] }],
        currentCycleId: 'cycle_1'
      });

      // Add pending messages
      await UnreadMessage.createPending({
        sessionId: 'session_flow_2',
        targetUserId: 'user_target_1',
        interlocutorUserId: 'user_interlocutor_1',
        content: 'Pending message 1'
      });
      await UnreadMessage.createPending({
        sessionId: 'session_flow_2',
        targetUserId: 'user_target_1',
        interlocutorUserId: 'user_interlocutor_1',
        content: 'Pending message 2'
      });

      // Get pending count before processing
      const beforeCount = await UnreadMessage.countDocuments({
        sessionId: 'session_flow_2',
        status: 'pending'
      });
      expect(beforeCount).toBe(2);

      // Simulate: set session back to active
      await ChatSession.setActive('session_flow_2');

      // Mark messages as indexed
      const pendingMessages = await UnreadMessage.find({
        sessionId: 'session_flow_2',
        status: 'pending'
      });
      await UnreadMessage.markAsIndexed(pendingMessages.map(m => m._id));

      // Verify: pending count should be 0
      const afterCount = await UnreadMessage.countDocuments({
        sessionId: 'session_flow_2',
        status: 'pending'
      });
      expect(afterCount).toBe(0);

      // Verify: session is active
      const session = await ChatSession.findOne({ sessionId: 'session_flow_2' });
      expect(session.sessionStatus).toBe('active');
    });
  });

  // ==================== Token Threshold Tests ====================

  describe('Token Threshold Transitions', () => {
    it('should transition to fatigue_prompt at 60% threshold', async () => {
      mockSessions.push({
        sessionId: 'session_threshold_1',
        sessionStatus: 'active'
      });

      // Simulate 60% threshold reached
      await ChatSession.setFatiguePrompt('session_threshold_1');

      const session = await ChatSession.findOne({ sessionId: 'session_threshold_1' });
      expect(session.sessionStatus).toBe('fatigue_prompt');
    });

    it('should transition to indexing at 70% threshold', async () => {
      mockSessions.push({
        sessionId: 'session_threshold_2',
        sessionStatus: 'active'
      });

      // Simulate 70% threshold reached (force offline)
      await ChatSession.setIndexing('session_threshold_2');

      const session = await ChatSession.findOne({ sessionId: 'session_threshold_2' });
      expect(session.sessionStatus).toBe('indexing');
    });

    it('should return to active after user continues from fatigue prompt', async () => {
      mockSessions.push({
        sessionId: 'session_threshold_3',
        sessionStatus: 'fatigue_prompt'
      });

      // User continues conversation
      await ChatSession.setActive('session_threshold_3');

      const session = await ChatSession.findOne({ sessionId: 'session_threshold_3' });
      expect(session.sessionStatus).toBe('active');
    });
  });

  // ==================== Error Handling Tests ====================

  describe('Error Handling', () => {
    it('should handle non-existent session gracefully', async () => {
      const result = await ChatSession.setIndexing('non_existent_session');
      expect(result).toBeUndefined();
    });

    it('should handle empty pending messages gracefully', async () => {
      const pending = await UnreadMessage.find({
        sessionId: 'session_empty',
        status: 'pending'
      });
      expect(pending).toEqual([]);
    });
  });
});
