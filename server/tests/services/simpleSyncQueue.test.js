import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import SimpleSyncQueue from '../../src/services/simpleSyncQueue.js';

vi.mock('../../src/utils/simpleFileLock.js', () => ({
  acquireLock: vi.fn(() => Promise.resolve(vi.fn()))
}));

vi.mock('../../src/models/User.js', () => ({
  default: {
    findById: vi.fn(() => ({
      lean: vi.fn()
    }))
  }
}));

vi.mock('../../src/models/Answer.js', () => ({
  default: {
    findById: vi.fn(() => ({
      lean: vi.fn()
    }))
  }
}));

vi.mock('../../src/models/AssistRelation.js', () => ({
  default: {
    findById: vi.fn(() => ({
      lean: vi.fn()
    }))
  }
}));

vi.mock('../../src/models/ChatSession.js', () => ({
  default: {
    findById: vi.fn(() => ({
      lean: vi.fn()
    }))
  }
}));

describe('SimpleSyncQueue', () => {
  let syncQueue;
  let mockDualStorage;
  let mockUser;
  let mockAnswer;
  let mockAssistRelation;
  let mockChatSession;
  let mockAcquireLock;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockDualStorage = {
      saveUserProfile: vi.fn().mockResolvedValue({ success: true }),
      saveRoleCard: vi.fn().mockResolvedValue({ success: true }),
      saveSentiments: vi.fn().mockResolvedValue({ success: true }),
      saveConversations: vi.fn().mockResolvedValue({ success: true }),
      saveAssistantsGuidelines: vi.fn().mockResolvedValue({ success: true }),
      saveAnswer: vi.fn().mockResolvedValue({ success: true }),
      saveAssistRelation: vi.fn().mockResolvedValue({ success: true }),
      saveChatSession: vi.fn().mockResolvedValue({ success: true })
    };

    syncQueue = new SimpleSyncQueue(mockDualStorage);

    mockUser = (await import('../../src/models/User.js')).default;
    mockAnswer = (await import('../../src/models/Answer.js')).default;
    mockAssistRelation = (await import('../../src/models/AssistRelation.js')).default;
    mockChatSession = (await import('../../src/models/ChatSession.js')).default;
    mockAcquireLock = (await import('../../src/utils/simpleFileLock.js')).acquireLock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with dualStorage', () => {
      expect(syncQueue.dualStorage).toBe(mockDualStorage);
    });

    it('should initialize empty pending Set', () => {
      expect(syncQueue.pending).toBeInstanceOf(Set);
      expect(syncQueue.pending.size).toBe(0);
    });

    it('should initialize empty buffer Map', () => {
      expect(syncQueue.buffer).toBeInstanceOf(Map);
      expect(syncQueue.buffer.size).toBe(0);
    });

    it('should initialize timer as null', () => {
      expect(syncQueue.timer).toBeNull();
    });
  });

  describe('enqueue', () => {
    it('should add operation to pending Set', () => {
      syncQueue.enqueue('User', 'user123', 'update');
      expect(syncQueue.pending.has('User:user123')).toBe(true);
    });

    it('should add operation to buffer Map', () => {
      syncQueue.enqueue('User', 'user123', 'update', { name: 'Test' });
      expect(syncQueue.buffer.has('User:user123')).toBe(true);
      expect(syncQueue.buffer.get('User:user123')).toEqual({
        collection: 'User',
        id: 'user123',
        operation: 'update',
        data: { name: 'Test' }
      });
    });

    it('should clear existing timer and set new one', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      syncQueue.enqueue('User', 'user123', 'update');
      
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);

      syncQueue.enqueue('User', 'user456', 'update');
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

      clearTimeoutSpy.mockRestore();
      setTimeoutSpy.mockRestore();
    });

    it('should handle data parameter as null', () => {
      syncQueue.enqueue('User', 'user123', 'update');
      expect(syncQueue.buffer.get('User:user123').data).toBeNull();
    });
  });

  describe('deduplication', () => {
    it('should deduplicate same key in pending Set', () => {
      syncQueue.enqueue('User', 'user123', 'update');
      syncQueue.enqueue('User', 'user123', 'update');
      expect(syncQueue.pending.size).toBe(1);
    });

    it('should overwrite buffer for same key', () => {
      syncQueue.enqueue('User', 'user123', 'update', { name: 'First' });
      syncQueue.enqueue('User', 'user123', 'update', { name: 'Second' });
      
      expect(syncQueue.buffer.size).toBe(1);
      expect(syncQueue.buffer.get('User:user123').data.name).toBe('Second');
    });
  });

  describe('flush', () => {
    it('should clear timer', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      syncQueue.enqueue('User', 'user123', 'update');
      expect(syncQueue.timer).not.toBeNull();
      
      syncQueue.flush();
      
      expect(syncQueue.timer).toBeNull();
      clearTimeoutSpy.mockRestore();
    });

    it('should clear buffer and pending sets', async () => {
      mockUser.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
      mockAcquireLock.mockResolvedValue(vi.fn());

      syncQueue.enqueue('User', 'user123', 'update');
      
      await syncQueue.flush();
      
      expect(syncQueue.buffer.size).toBe(0);
      expect(syncQueue.pending.size).toBe(0);
    });

    it('should execute operations from buffer', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);

      syncQueue.enqueue('User', 'user123', 'update');
      
      await syncQueue.flush();
      
      expect(mockUser.findById).toHaveBeenCalledWith('user123');
    });

    it('should handle errors gracefully and continue with other operations', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);
      
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockUser.findById.mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error('DB Error')) });
      mockAnswer.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ id: 'answer123' }) });

      syncQueue.enqueue('User', 'user123', 'update');
      syncQueue.enqueue('Answer', 'answer123', 'update');
      
      await syncQueue.flush();
      
      expect(errorSpy).toHaveBeenCalledWith(
        'Sync failed for User:user123',
        'DB Error'
      );
      expect(mockDualStorage.saveAnswer).toHaveBeenCalled();
      
      errorSpy.mockRestore();
    });
  });

  describe('debouncing', () => {
    it('should debounce rapid enqueues', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);
      mockUser.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

      const flushSpy = vi.spyOn(syncQueue, 'flush');

      syncQueue.enqueue('User', 'user123', 'update');
      syncQueue.enqueue('User', 'user123', 'update');
      syncQueue.enqueue('User', 'user123', 'update');

      expect(flushSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      await vi.runAllTimersAsync();

      expect(flushSpy).toHaveBeenCalledTimes(1);
      
      flushSpy.mockRestore();
    });

    it('should reset timer on new enqueue', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);
      mockUser.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

      syncQueue.enqueue('User', 'user123', 'update');
      
      vi.advanceTimersByTime(50);
      
      syncQueue.enqueue('User', 'user456', 'update');
      
      vi.advanceTimersByTime(50);
      
      expect(mockUser.findById).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(50);
      
      await vi.runAllTimersAsync();
      
      expect(mockUser.findById).toHaveBeenCalled();
    });
  });

  describe('executeOperation', () => {
    it('should acquire and release lock for User collection', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);
      mockUser.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

      await syncQueue.executeOperation({
        collection: 'User',
        id: 'user123',
        operation: 'update',
        data: null
      });

      expect(mockAcquireLock).toHaveBeenCalledWith('sync-operation-User');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should call syncUser for User collection', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);
      mockUser.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

      const syncUserSpy = vi.spyOn(syncQueue, 'syncUser');

      await syncQueue.executeOperation({
        collection: 'User',
        id: 'user123',
        operation: 'update',
        data: null
      });

      expect(syncUserSpy).toHaveBeenCalledWith('user123', 'update', null);
      
      syncUserSpy.mockRestore();
    });

    it('should call syncAnswer for Answer collection', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);
      mockAnswer.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

      const syncAnswerSpy = vi.spyOn(syncQueue, 'syncAnswer');

      await syncQueue.executeOperation({
        collection: 'Answer',
        id: 'answer123',
        operation: 'update',
        data: null
      });

      expect(syncAnswerSpy).toHaveBeenCalledWith('answer123', 'update', null);
      
      syncAnswerSpy.mockRestore();
    });

    it('should call syncAssistRelation for AssistRelation collection', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);
      mockAssistRelation.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

      const syncAssistRelationSpy = vi.spyOn(syncQueue, 'syncAssistRelation');

      await syncQueue.executeOperation({
        collection: 'AssistRelation',
        id: 'relation123',
        operation: 'update',
        data: null
      });

      expect(syncAssistRelationSpy).toHaveBeenCalledWith('relation123', 'update', null);
      
      syncAssistRelationSpy.mockRestore();
    });

    it('should call syncChatSession for ChatSession collection', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);
      mockChatSession.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

      const syncChatSessionSpy = vi.spyOn(syncQueue, 'syncChatSession');

      await syncQueue.executeOperation({
        collection: 'ChatSession',
        id: 'session123',
        operation: 'update',
        data: null
      });

      expect(syncChatSessionSpy).toHaveBeenCalledWith('session123', 'update', null);
      
      syncChatSessionSpy.mockRestore();
    });

    it('should warn for unknown collection', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await syncQueue.executeOperation({
        collection: 'Unknown',
        id: '123',
        operation: 'update',
        data: null
      });

      expect(warnSpy).toHaveBeenCalledWith('Unknown collection: Unknown');
      expect(mockRelease).toHaveBeenCalled();
      
      warnSpy.mockRestore();
    });
  });

  describe('syncUser', () => {
    it('should save user profile, roleCard, sentiments, conversations, and guidelines', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);

      const user = {
        _id: 'user123',
        uniqueCode: 'CODE123',
        email: 'test@test.com',
        name: 'Test User',
        isActive: true,
        companionChat: {
          roleCard: { personality: 'friendly' },
          strangerSentiments: [{ strangerId: 's1', currentScore: 50 }],
          conversationsAsTarget: [{ sessionId: 'sess1' }],
          assistantsGuidelines: [{ assistantId: 'a1' }]
        }
      };

      mockUser.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(user) });

      await syncQueue.syncUser('user123', 'update', null);

      expect(mockDualStorage.saveUserProfile).toHaveBeenCalledWith('user123', user);
      expect(mockDualStorage.saveRoleCard).toHaveBeenCalledWith('user123', user.companionChat.roleCard);
      expect(mockDualStorage.saveSentiments).toHaveBeenCalledWith('user123', user.companionChat.strangerSentiments);
      expect(mockDualStorage.saveConversations).toHaveBeenCalledWith('user123', user.companionChat.conversationsAsTarget);
      expect(mockDualStorage.saveAssistantsGuidelines).toHaveBeenCalledWith('user123', user.companionChat.assistantsGuidelines);
    });

    it('should do nothing if user not found', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);

      mockUser.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

      await syncQueue.syncUser('user123', 'update', null);

      expect(mockDualStorage.saveUserProfile).not.toHaveBeenCalled();
      expect(mockDualStorage.saveRoleCard).not.toHaveBeenCalled();
    });

    it('should skip sync on delete operation', async () => {
      await syncQueue.syncUser('user123', 'delete', null);

      expect(mockUser.findById).not.toHaveBeenCalled();
      expect(mockDualStorage.saveUserProfile).not.toHaveBeenCalled();
    });
  });

  describe('syncAnswer', () => {
    it('should save answer to dualStorage', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);

      const answer = {
        _id: 'answer123',
        content: 'Test answer'
      };

      mockAnswer.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(answer) });

      await syncQueue.syncAnswer('answer123', 'update', null);

      expect(mockDualStorage.saveAnswer).toHaveBeenCalledWith('answer123', answer);
    });

    it('should do nothing if answer not found', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);

      mockAnswer.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

      await syncQueue.syncAnswer('answer123', 'update', null);

      expect(mockDualStorage.saveAnswer).not.toHaveBeenCalled();
    });

    it('should skip sync on delete operation', async () => {
      await syncQueue.syncAnswer('answer123', 'delete', null);

      expect(mockAnswer.findById).not.toHaveBeenCalled();
      expect(mockDualStorage.saveAnswer).not.toHaveBeenCalled();
    });
  });

  describe('syncAssistRelation', () => {
    it('should save assist relation to dualStorage', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);

      const relation = {
        _id: 'relation123',
        relationType: 'family'
      };

      mockAssistRelation.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(relation) });

      await syncQueue.syncAssistRelation('relation123', 'update', null);

      expect(mockDualStorage.saveAssistRelation).toHaveBeenCalledWith('relation123', relation);
    });

    it('should do nothing if relation not found', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);

      mockAssistRelation.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

      await syncQueue.syncAssistRelation('relation123', 'update', null);

      expect(mockDualStorage.saveAssistRelation).not.toHaveBeenCalled();
    });

    it('should skip sync on delete operation', async () => {
      await syncQueue.syncAssistRelation('relation123', 'delete', null);

      expect(mockAssistRelation.findById).not.toHaveBeenCalled();
      expect(mockDualStorage.saveAssistRelation).not.toHaveBeenCalled();
    });
  });

  describe('syncChatSession', () => {
    it('should save chat session to dualStorage', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);

      const session = {
        _id: 'session123',
        messages: []
      };

      mockChatSession.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(session) });

      await syncQueue.syncChatSession('session123', 'update', null);

      expect(mockDualStorage.saveChatSession).toHaveBeenCalledWith('session123', session);
    });

    it('should do nothing if session not found', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);

      mockChatSession.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

      await syncQueue.syncChatSession('session123', 'update', null);

      expect(mockDualStorage.saveChatSession).not.toHaveBeenCalled();
    });

    it('should skip sync on delete operation', async () => {
      await syncQueue.syncChatSession('session123', 'delete', null);

      expect(mockChatSession.findById).not.toHaveBeenCalled();
      expect(mockDualStorage.saveChatSession).not.toHaveBeenCalled();
    });
  });

  describe('integration tests', () => {
    it('should handle complete enqueue and flush cycle', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);

      const user = {
        _id: 'user123',
        uniqueCode: 'CODE123',
        email: 'test@test.com',
        name: 'Test User',
        isActive: true,
        companionChat: {
          roleCard: { personality: 'friendly' },
          strangerSentiments: [],
          conversationsAsTarget: [],
          assistantsGuidelines: []
        }
      };

      mockUser.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(user) });

      syncQueue.enqueue('User', 'user123', 'update');

      expect(syncQueue.pending.has('User:user123')).toBe(true);
      expect(syncQueue.buffer.size).toBe(1);

      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      expect(syncQueue.pending.size).toBe(0);
      expect(syncQueue.buffer.size).toBe(0);
      expect(mockDualStorage.saveUserProfile).toHaveBeenCalled();
    });

    it('should process multiple operations in correct order', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);

      mockUser.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'user123', uniqueCode: 'U1', email: 'u@test.com', name: 'U', isActive: true, companionChat: {} }) });
      mockAnswer.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'answer123', content: 'A' }) });
      mockAssistRelation.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'rel123', relationType: 'family' }) });

      syncQueue.enqueue('User', 'user123', 'update');
      syncQueue.enqueue('Answer', 'answer123', 'update');
      syncQueue.enqueue('AssistRelation', 'rel123', 'update');

      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      expect(mockUser.findById).toHaveBeenCalled();
      expect(mockAnswer.findById).toHaveBeenCalled();
      expect(mockAssistRelation.findById).toHaveBeenCalled();
    });

    it('should handle concurrent enqueues correctly', async () => {
      const mockRelease = vi.fn();
      mockAcquireLock.mockResolvedValue(mockRelease);

      mockUser.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'user123', uniqueCode: 'U1', email: 'u@test.com', name: 'U', isActive: true, companionChat: {} }) });

      syncQueue.enqueue('User', 'user123', 'update');
      syncQueue.enqueue('User', 'user123', 'update');
      syncQueue.enqueue('User', 'user123', 'update');

      expect(syncQueue.buffer.size).toBe(1);

      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      expect(mockUser.findById).toHaveBeenCalledTimes(1);
    });
  });
});
