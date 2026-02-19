import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock ChromaDB
vi.mock('chromadb', () => ({
  ChromaClient: class MockChromaClient {
    constructor() {
      this.heartbeat = vi.fn().mockResolvedValue(true);
      this.listCollections = vi.fn().mockResolvedValue([]);
    }
    async getCollection({ name }) {
      throw new Error(`Collection ${name} does not exist`);
    }
    async createCollection({ name, metadata }) {
      return {
        name,
        metadata,
        add: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(0),
        query: vi.fn().mockResolvedValue({
          documents: [[]],
          distances: [[]],
          metadatas: [[]]
        }),
        get: vi.fn().mockResolvedValue([])
      };
    }
    async deleteCollection({ name }) {
      return undefined;
    }
  }
}));

// Mock EmbeddingService
vi.mock('../../src/core/storage/embedding.js', () => ({
  default: class MockEmbeddingService {
    constructor() {}
    initialize = vi.fn().mockResolvedValue(undefined);
    embedQuery = vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]);
    embedDocuments = vi.fn().mockResolvedValue([
      [0.1, 0.2, 0.3, 0.4, 0.5],
      [0.2, 0.3, 0.4, 0.5, 0.6]
    ]);
    healthCheck = vi.fn().mockResolvedValue(true);
  }
}));

// Mock FileStorage
const mockLoadUserMemories = vi.fn();
vi.mock('../../src/core/storage/file.js', () => ({
  default: class MockFileStorage {
    constructor() {
      this.loadUserMemories = mockLoadUserMemories;
    }
    loadUserMemories = mockLoadUserMemories;
  }
}));

import VectorIndexService from '../../src/core/storage/vector.js';

describe('VectorIndexService', () => {
  let vectorService;

  beforeEach(() => {
    vectorService = new VectorIndexService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('validateUserId', () => {
    it('should throw error for invalid userId (null)', () => {
      expect(() => vectorService.validateUserId(null)).toThrow('Invalid userId: must be a non-empty string');
    });

    it('should throw error for invalid userId (empty string)', () => {
      expect(() => vectorService.validateUserId('')).toThrow('Invalid userId: must be a non-empty string');
    });

    it('should throw error for invalid userId (undefined)', () => {
      expect(() => vectorService.validateUserId(undefined)).toThrow('Invalid userId: must be a non-empty string');
    });

    it('should throw error for invalid userId (number)', () => {
      expect(() => vectorService.validateUserId(123)).toThrow('Invalid userId: must be a non-empty string');
    });

    it('should throw error for invalid userId with invalid characters', () => {
      expect(() => vectorService.validateUserId('user@123')).toThrow('Invalid userId: contains invalid characters');
    });

    it('should accept userId starting with number', () => {
      expect(() => vectorService.validateUserId('123user')).not.toThrow();
    });

    it('should accept MongoDB ObjectId format (24-char hex string)', () => {
      const mongoObjectId = '507f1f77bcf86cd799439011';
      expect(() => vectorService.validateUserId(mongoObjectId)).not.toThrow();
    });

    it('should accept valid userId with alphanumeric', () => {
      expect(() => vectorService.validateUserId('valid123')).not.toThrow();
    });

    it('should accept valid userId with underscore', () => {
      expect(() => vectorService.validateUserId('test_user')).not.toThrow();
    });

    it('should accept valid userId with hyphen', () => {
      expect(() => vectorService.validateUserId('test-user')).not.toThrow();
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await vectorService.initialize();
      expect(vectorService.embeddingService).toBeDefined();
      expect(vectorService.chromaService).toBeDefined();
    });

    it('should not reinitialize if already initialized', async () => {
      await vectorService.initialize();
      const chromaService = vectorService.chromaService;
      await vectorService.initialize();
      expect(vectorService.chromaService).toBe(chromaService);
    });
  });

  describe('getCollection', () => {
    it('should create and cache collection for new user', async () => {
      const collection = await vectorService.getCollection('testUser123');
      expect(collection).toBeDefined();
      expect(collection.name).toBe('user_testUser123');
    });

    it('return cached collection if exists', async () => {
      const collection1 = await vectorService.getCollection('cachedUser');
      const collection2 = await vectorService.getCollection('cachedUser');
      expect(collection1).toBe(collection2);
    });
  });

  describe('clearCollectionCache', () => {
    it('should clear specific user from cache', async () => {
      await vectorService.getCollection('userToClear');
      expect(vectorService.collectionCache.has('user_userToClear')).toBe(true);

      vectorService.clearCollectionCache('userToClear');
      expect(vectorService.collectionCache.has('user_userToClear')).toBe(false);
    });

    it('should clear all cache when userId is null', async () => {
      await vectorService.getCollection('user1');
      await vectorService.getCollection('user2');
      expect(vectorService.collectionCache.size).toBe(2);

      vectorService.clearCollectionCache(null);
      expect(vectorService.collectionCache.size).toBe(0);
    });
  });

  describe('buildMemoryText', () => {
    it('should build text from question and answer', () => {
      const memory = {
        question: 'What is your name?',
        answer: 'My name is John'
      };

      const result = vectorService.buildMemoryText(memory);
      expect(result).toBe('问题: What is your name?\n回答: My name is John');
    });

    it('should handle missing answer', () => {
      const memory = {
        question: 'What is your name?'
      };

      const result = vectorService.buildMemoryText(memory);
      expect(result).toBe('问题: What is your name?');
    });

    it('should handle missing question', () => {
      const memory = {
        answer: 'My name is John'
      };

      const result = vectorService.buildMemoryText(memory);
      expect(result).toBe('回答: My name is John');
    });

    it('should handle empty memory', () => {
      const memory = {};
      const result = vectorService.buildMemoryText(memory);
      expect(result).toBe('');
    });
  });

  describe('buildMetadata', () => {
    it('should build metadata for elder role (self category)', () => {
      const memory = {
        targetUserId: 'user123',
        memoryId: 'mem1',
        questionId: 'q1',
        questionRole: 'elder',
        questionLayer: 'basic',
        questionOrder: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        importance: 0.8,
        tags: ['positive', 'family']
      };

      const result = vectorService.buildMetadata(memory);
      expect(result).toEqual({
        userId: 'user123',
        memoryId: 'mem1',
        questionId: 'q1',
        questionRole: 'elder',
        questionLayer: 'basic',
        questionOrder: 1,
        source: 'questionnaire',
        createdAt: '2024-01-01T00:00:00.000Z',
        category: 'self',
        importance: 0.8,
        tags: 'positive,family'
      });
    });

    it('should build metadata for family role', () => {
      const memory = {
        targetUserId: 'user123',
        memoryId: 'mem2',
        questionId: 'q2',
        questionRole: 'family',
        questionLayer: 'emotional',
        questionOrder: 1,
        helperId: 'helper1',
        helperNickname: 'Alice',
        createdAt: '2024-01-01T00:00:00.000Z'
      };

      const result = vectorService.buildMetadata(memory);
      expect(result).toEqual({
        userId: 'user123',
        memoryId: 'mem2',
        questionId: 'q2',
        questionRole: 'family',
        questionLayer: 'emotional',
        questionOrder: 1,
        source: 'questionnaire',
        createdAt: '2024-01-01T00:00:00.000Z',
        category: 'family',
        helperId: 'helper1',
        helperNickname: 'Alice'
      });
    });

    it('should build metadata for friend role', () => {
      const memory = {
        targetUserId: 'user123',
        memoryId: 'mem3',
        questionId: 'q3',
        questionRole: 'friend',
        questionLayer: 'basic',
        questionOrder: 1,
        helperId: 'helper2',
        helperNickname: 'Bob',
        createdAt: '2024-01-01T00:00:00.000Z'
      };

      const result = vectorService.buildMetadata(memory);
      expect(result).toEqual({
        userId: 'user123',
        memoryId: 'mem3',
        questionId: 'q3',
        questionRole: 'friend',
        questionLayer: 'basic',
        questionOrder: 1,
        source: 'questionnaire',
        createdAt: '2024-01-01T00:00:00.000Z',
        category: 'friend',
        helperId: 'helper2',
        helperNickname: 'Bob'
      });
    });
  });

  describe('getStats', () => {
    it('should return collection stats', async () => {
      const collection = await vectorService.getCollection('statsUser');
      collection.count.mockResolvedValue(42);

      const result = await vectorService.getStats('statsUser');

      expect(result).toEqual({
        totalDocuments: 42,
        collectionName: 'user_statsUser'
      });
    });
  });

  describe('indexExists', () => {
    it('should return true when collection has documents', async () => {
      const collection = await vectorService.getCollection('existingUser');
      collection.count.mockResolvedValue(10);

      const result = await vectorService.indexExists('existingUser');
      expect(result).toBe(true);
    });

    it('should return false when collection has no documents', async () => {
      const collection = await vectorService.getCollection('emptyUser');
      collection.count.mockResolvedValue(0);

      const result = await vectorService.indexExists('emptyUser');
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const result = await vectorService.indexExists('invalid@user');
      expect(result).toBe(false);
    });
  });

  describe('search', () => {
    it('should return empty array if no results', async () => {
      const collection = await vectorService.getCollection('searchUser');
      collection.query.mockResolvedValue({
        documents: [[]],
        distances: [[]],
        metadatas: [[]]
      });

      const results = await vectorService.search('searchUser', 'test query');
      expect(results).toEqual([]);
    });

    it('should return formatted search results', async () => {
      const collection = await vectorService.getCollection('searchUser2');
      collection.query.mockResolvedValue({
        documents: [['First result', 'Second result']],
        distances: [[0.2, 0.5]],
        metadatas: [[
          { category: 'self', memoryId: 'mem1' },
          { category: 'family', memoryId: 'mem2', helperId: 'helper1' }
        ]]
      });

      const results = await vectorService.search('searchUser2', 'test query', 5);

      expect(results).toEqual([
        {
          content: 'First result',
          relevanceScore: 0.2,
          category: 'self',
          metadata: { category: 'self', memoryId: 'mem1' }
        },
        {
          content: 'Second result',
          relevanceScore: 0.5,
          category: 'family',
          metadata: { category: 'family', memoryId: 'mem2', helperId: 'helper1' }
        }
      ]);
    });

    it('should filter by relationType', async () => {
      const collection = await vectorService.getCollection('filterUser');
      collection.query.mockResolvedValue({
        documents: [['Test content']],
        distances: [[0.3]],
        metadatas: [[{ category: 'family', helperId: 'helper1' }]]
      });

      await vectorService.search('filterUser', 'test query', 5, 'family', 'helper1');

      expect(collection.query).toHaveBeenCalledWith(
        expect.objectContaining({
          nResults: 5,
          where: { category: 'family', helperId: 'helper1' }
        })
      );
    });

    it('should return empty array on error', async () => {
      const collection = await vectorService.getCollection('errorUser');
      collection.query.mockRejectedValue(new Error('Search failed'));

      const results = await vectorService.search('errorUser', 'test query');
      expect(results).toEqual([]);
    });
  });

  describe('addMemory', () => {
    it('should add memory to collection', async () => {
      const collection = await vectorService.getCollection('addMemUser');
      const memory = {
        memoryId: 'newMem1',
        targetUserId: 'addMemUser',
        question: 'Q1',
        answer: 'A1',
        questionRole: 'elder',
        questionLayer: 'basic',
        questionOrder: 1,
        createdAt: '2024-01-01T00:00:00.000Z'
      };

      await vectorService.addMemory('addMemUser', memory);

      expect(collection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          ids: ['newMem1'],
          documents: ['问题: Q1\n回答: A1']
        })
      );
    });
  });

  describe('deleteMemory', () => {
    it('should delete memories by filter', async () => {
      const collection = await vectorService.getCollection('delMemUser');

      await vectorService.deleteMemory('delMemUser', { category: 'family' });

      expect(collection.delete).toHaveBeenCalledWith({
        where: { category: 'family' }
      });
    });

    it('should delete all memories when no filter', async () => {
      const collection = await vectorService.getCollection('delAllMemUser');

      await vectorService.deleteMemory('delAllMemUser');

      expect(collection.delete).toHaveBeenCalledWith({
        where: undefined
      });
    });
  });

  describe('updateMemory', () => {
    it('should delete old and add new memory', async () => {
      const collection = await vectorService.getCollection('updMemUser');
      const memory = {
        memoryId: 'updMem1',
        targetUserId: 'updMemUser',
        question: 'Updated Q',
        answer: 'Updated A',
        questionRole: 'elder',
        questionLayer: 'basic',
        questionOrder: 1,
        createdAt: '2024-01-01T00:00:00.000Z'
      };

      await vectorService.updateMemory('updMemUser', 'updMem1', memory);

      expect(collection.delete).toHaveBeenCalledWith({ ids: ['updMem1'] });
      expect(collection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          ids: ['updMem1'],
          documents: ['问题: Updated Q\n回答: Updated A']
        })
      );
    });
  });

  describe('rebuildIndex', () => {
    afterEach(() => {
      mockLoadUserMemories.mockReset();
    });

    it('should throw error if no memories exist', async () => {
      mockLoadUserMemories.mockResolvedValue({
        A_set: [],
        Bste: [],
        Cste: []
      });

      await expect(vectorService.rebuildIndex('noMemoryUser')).rejects.toThrow('用户没有任何记忆文件');
    });

    it('should process memories in batches', async () => {
      const mockMemories = Array.from({ length: 100 }, (_, i) => ({
        memoryId: `mem${i}`,
        targetUserId: 'batchUser',
        question: `Question ${i}`,
        answer: `Answer ${i}`,
        questionRole: i < 33 ? 'elder' : i < 66 ? 'family' : 'friend',
        questionLayer: i % 2 === 0 ? 'basic' : 'emotional',
        questionOrder: i,
        createdAt: '2024-01-01T00:00:00.000Z'
      }));

      mockLoadUserMemories.mockResolvedValue({
        A_set: mockMemories.slice(0, 33),
        Bste: mockMemories.slice(33, 66),
        Cste: mockMemories.slice(66, 100)
      });

      const progressCallback = vi.fn();
      const result = await vectorService.rebuildIndex('batchUser', progressCallback);

      expect(result.success).toBe(true);
      expect(result.memoryCount).toBe(100);
      expect(result.categories).toEqual({
        self: 33,
        family: 33,
        friend: 34
      });
      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all services available', async () => {
      await vectorService.initialize();
      const result = await vectorService.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.chromadb).toBe('connected');
      expect(result.embedding).toBe('available');
    });

    it('should return unhealthy status on initialization failure', async () => {
      const brokenService = new VectorIndexService();
      // Don't initialize, should fail
      delete brokenService.initialize;
      brokenService.initialize = vi.fn().mockRejectedValue(new Error('Connection failed'));

      const result = await brokenService.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Connection failed');
    });
  });
});
