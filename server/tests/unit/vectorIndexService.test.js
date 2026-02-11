import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('chromadb', () => ({
  ChromaClient: class {
    constructor() {
      this.getCollection = vi.fn().mockRejectedValue(new Error('does not exist'));
      this.createCollection = vi.fn().mockResolvedValue({ id: 'mock-collection' });
    }
  }
}));

vi.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: class {
    constructor() {
      this.embedQuery = vi.fn().mockResolvedValue([0.1, 0.2]);
    }
  }
}));

const mockLoadUserMemories = vi.fn();

vi.mock('../../src/services/fileStorage.js', () => ({
  default: class {
    constructor() {
      this.loadUserMemories = mockLoadUserMemories;
    }
  }
}));

import VectorIndexService from '../../src/services/vectorIndexService.js';

describe('VectorIndexService', () => {
  let vectorService;

  beforeEach(() => {
    vectorService = new VectorIndexService();
  });

  describe('userId validation', () => {
    it('should throw error for invalid userId (null)', async () => {
      await expect(vectorService.getCollection(null)).rejects.toThrow('Invalid userId');
    });

    it('should throw error for invalid userId (empty string)', async () => {
      await expect(vectorService.getCollection('')).rejects.toThrow('Invalid userId');
    });

    it('should throw error for invalid userId (undefined)', async () => {
      await expect(vectorService.getCollection(undefined)).rejects.toThrow('Invalid userId');
    });

    it('should throw error for invalid userId (number)', async () => {
      await expect(vectorService.getCollection(123)).rejects.toThrow('Invalid userId');
    });

    it('should throw error for invalid userId with invalid characters', async () => {
      await expect(vectorService.getCollection('user@123')).rejects.toThrow('Invalid userId: contains invalid characters for ChromaDB collection names');
    });

    it('should accept userId starting with number', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      const mockCollection = { id: 'mock-collection' };
      vectorService.collections.set('user_123user', mockCollection);

      const result = await vectorService.getCollection('123user');
      expect(result).toBe(mockCollection);
      vi.unstubAllEnvs();
    });

    it('should accept MongoDB ObjectId format (24-char hex string)', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      const mockCollection = { id: 'mock-collection' };
      const mongoObjectId = '507f1f77bcf86cd799439011';
      vectorService.collections.set(`user_${mongoObjectId}`, mockCollection);

      const result = await vectorService.getCollection(mongoObjectId);
      expect(result).toBe(mockCollection);
      vi.unstubAllEnvs();
    });

    it('should accept valid userId with alphanumeric', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      const mockCollection = { id: 'mock-collection' };
      vectorService.collections.set('user_valid123', mockCollection);

      const result = await vectorService.getCollection('valid123');
      expect(result).toBe(mockCollection);
      vi.unstubAllEnvs();
    });

    it('should accept valid userId with underscore', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      const mockCollection = { id: 'mock-collection' };
      vectorService.collections.set('user_test_user', mockCollection);

      const result = await vectorService.getCollection('test_user');
      expect(result).toBe(mockCollection);
      vi.unstubAllEnvs();
    });

    it('should accept valid userId with hyphen', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      const result = await vectorService.getCollection('test-user');
      expect(result).toStrictEqual({ id: 'mock-collection' });
      vi.unstubAllEnvs();
    });
  });

  describe('clearCollectionCache', () => {
    it('should clear specific user from cache', () => {
      vectorService.collections.set('user_123', 'mock_collection');
      expect(vectorService.collections.has('user_123')).toBe(true);

      vectorService.clearCollectionCache('123');
      expect(vectorService.collections.has('user_123')).toBe(false);
    });

    it('should clear all cache when userId is null', () => {
      vectorService.collections.set('user_123', 'mock_collection');
      vectorService.collections.set('user_456', 'mock_collection');
      expect(vectorService.collections.size).toBe(2);

      vectorService.clearCollectionCache(null);
      expect(vectorService.collections.size).toBe(0);
    });
  });

  describe('initialize', () => {
    it('should throw error if OPENAI_API_KEY is not set', async () => {
      vi.stubEnv('OPENAI_API_KEY', undefined);
      await expect(vectorService.initialize()).rejects.toThrow('OPENAI_API_KEY environment variable is required');
      vi.unstubAllEnvs();
    });
  });

  describe('getCollection', () => {
    it('should throw error when trying to use uninitialized service', async () => {
      await expect(vectorService.getCollection('user123')).rejects.toThrow();
    });

    it('should return cached collection if exists', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      const mockCollection = { id: 'mock_collection_123' };
      vectorService.collections.set('user_a123', mockCollection);

      const result = await vectorService.getCollection('a123');
      expect(result).toBe(mockCollection);
      vi.unstubAllEnvs();
    });
  });

  describe('indexExists', () => {
    it('should return true when collection has documents', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      const mockCollection = {
        id: 'mock-collection',
        count: vi.fn().mockResolvedValue(10)
      };
      vectorService.collections.set('user_test123', mockCollection);

      const result = await vectorService.indexExists('test123');
      expect(result).toBe(true);
      vi.unstubAllEnvs();
    });

    it('should return false when collection has no documents', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      const mockCollection = {
        id: 'mock-collection',
        count: vi.fn().mockResolvedValue(0)
      };
      vectorService.collections.set('user_test123', mockCollection);

      const result = await vectorService.indexExists('test123');
      expect(result).toBe(false);
      vi.unstubAllEnvs();
    });

    it('should return false when collection does not exist', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      const mockCollection = {
        id: 'mock-collection',
        count: vi.fn().mockRejectedValue(new Error('does not exist'))
      };
      vectorService.collections.set('user_test123', mockCollection);

      const result = await vectorService.indexExists('test123');
      expect(result).toBe(false);
      vi.unstubAllEnvs();
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
  });

  describe('buildMetadata', () => {
    it('should build metadata for elder role', () => {
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

  describe('batchInsert', () => {
    it('should insert documents in batch', async () => {
      const mockCollection = {
        add: vi.fn().mockResolvedValue(undefined)
      };

      const documents = [
        { id: 'doc1', embedding: [0.1, 0.2], document: 'text1', metadata: { key: 'value1' } },
        { id: 'doc2', embedding: [0.3, 0.4], document: 'text2', metadata: { key: 'value2' } }
      ];

      await vectorService.batchInsert(mockCollection, documents);

      expect(mockCollection.add).toHaveBeenCalledWith({
        ids: ['doc1', 'doc2'],
        embeddings: [[0.1, 0.2], [0.3, 0.4]],
        documents: ['text1', 'text2'],
        metadatas: [{ key: 'value1' }, { key: 'value2' }]
      });
    });

    it('should throw error on insert failure', async () => {
      const mockCollection = {
        add: vi.fn().mockRejectedValue(new Error('Insert failed'))
      };

      const documents = [
        { id: 'doc1', embedding: [0.1, 0.2], document: 'text1', metadata: { key: 'value1' } }
      ];

      await expect(vectorService.batchInsert(mockCollection, documents)).rejects.toThrow('Insert failed');
    });
  });

  describe('getStats', () => {
    it('should return collection stats', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      const mockCollection = {
        id: 'mock-collection',
        count: vi.fn().mockResolvedValue(42)
      };
      vectorService.collections.set('user_test123', mockCollection);

      const result = await vectorService.getStats('test123');

      expect(result).toEqual({
        totalDocuments: 42,
        collectionName: 'user_test123'
      });
      vi.unstubAllEnvs();
    });
  });

  describe('rebuildIndex', () => {
    beforeEach(() => {
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      mockLoadUserMemories.mockReset();
    });

    it('should throw error if no memories exist', async () => {
      mockLoadUserMemories.mockResolvedValue({
        A_set: [],
        Bste: [],
        Cste: []
      });

      const mockCollection = {
        delete: vi.fn().mockResolvedValue(undefined),
        add: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(0)
      };

      vectorService.collections.set('user_test123', mockCollection);

      await expect(vectorService.rebuildIndex('test123')).rejects.toThrow('用户没有任何记忆文件');
    });

    it('should process memories in batches', async () => {
      const mockMemories = Array.from({ length: 100 }, (_, i) => ({
        memoryId: `mem${i}`,
        targetUserId: 'test123',
        question: `Question ${i}`,
        answer: `Answer ${i}`,
        questionRole: i < 33 ? 'elder' : i < 66 ? 'family' : 'friend',
        questionLayer: i % 2 === 0 ? 'basic' : 'emotional',
        questionOrder: i,
        createdAt: '2024-01-01T00:00:00.000Z'
      }));

      const memoriesByCategory = {
        A_set: mockMemories.slice(0, 33),
        Bste: mockMemories.slice(33, 66),
        Cste: mockMemories.slice(66, 100)
      };

      mockLoadUserMemories.mockResolvedValue(memoriesByCategory);

      const mockCollection = {
        delete: vi.fn().mockResolvedValue(undefined),
        add: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(100)
      };

      vectorService.collections.set('user_test123', mockCollection);

      const progressCallback = vi.fn();
      const result = await vectorService.rebuildIndex('test123', progressCallback);

      expect(mockCollection.delete).toHaveBeenCalledWith({ where: {} });
      expect(mockCollection.add).toHaveBeenCalled();
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
});
