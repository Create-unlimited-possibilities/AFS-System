import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('chromadb', () => ({
  ChromaClient: class {
    constructor() {
      this.getCollection = vi.fn().mockRejectedValue(new Error('does not exist'));
      this.createCollection = vi.fn().mockResolvedValue({
        id: 'mock-collection',
        delete: vi.fn().mockResolvedValue(undefined),
        add: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(0)
      });
    }
  }
}));

vi.mock('../../src/services/EmbeddingService.js', () => ({
  default: class {
    constructor() {}
    initialize = vi.fn().mockResolvedValue(undefined);
    embedQuery = vi.fn().mockResolvedValue([0.1, 0.2]);
    embedDocuments = vi.fn().mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]);
    healthCheck = vi.fn().mockResolvedValue(true);
  }
}));

const mockLoadUserMemories = vi.fn();

vi.mock('../../src/services/fileStorage.js', () => ({
  loadUserMemories: mockLoadUserMemories,
  default: class {
    constructor() {
      this.loadUserMemories = mockLoadUserMemories;
    }
  }
}));

import VectorIndexService from '../../src/services/vectorIndexService.js';
import RoleCardController from '../../src/controllers/RoleCardController.js';

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
      const mockCollection = { id: 'mock-collection' };
      vectorService.collections.set('user_123user', mockCollection);

      const result = await vectorService.getCollection('123user');
      expect(result).toBe(mockCollection);
    });

    it('should accept MongoDB ObjectId format (24-char hex string)', async () => {
      const mockCollection = { id: 'mock-collection' };
      const mongoObjectId = '507f1f77bcf86cd799439011';
      vectorService.collections.set(`user_${mongoObjectId}`, mockCollection);

      const result = await vectorService.getCollection(mongoObjectId);
      expect(result).toBe(mockCollection);
    });

    it('should accept valid userId with alphanumeric', async () => {
      const mockCollection = { id: 'mock-collection' };
      vectorService.collections.set('user_valid123', mockCollection);

      const result = await vectorService.getCollection('valid123');
      expect(result).toBe(mockCollection);
    });

    it('should accept valid userId with underscore', async () => {
      const mockCollection = { id: 'mock-collection' };
      vectorService.collections.set('user_test_user', mockCollection);

      const result = await vectorService.getCollection('test_user');
      expect(result).toBe(mockCollection);
    });

    it('should accept valid userId with hyphen', async () => {
      const result = await vectorService.getCollection('test-user');
      expect(result).toHaveProperty('id', 'mock-collection');
      expect(result).toHaveProperty('delete');
      expect(result).toHaveProperty('add');
      expect(result).toHaveProperty('count');
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
    it('should initialize successfully', async () => {
      await vectorService.initialize();
      expect(vectorService.client).toBeDefined();
      expect(vectorService.embeddingService).toBeDefined();
    });
  });

  describe('getCollection', () => {
    it('should return cached collection if exists', async () => {
      const mockCollection = { id: 'mock_collection_123' };
      vectorService.collections.set('user_a123', mockCollection);

      const result = await vectorService.getCollection('a123');
      expect(result).toBe(mockCollection);
    });
  });

  describe('indexExists', () => {
    it('should return true when collection has documents', async () => {
      const mockCollection = {
        id: 'mock-collection',
        count: vi.fn().mockResolvedValue(10)
      };
      vectorService.collections.set('user_test123', mockCollection);

      const result = await vectorService.indexExists('test123');
      expect(result).toBe(true);
    });

    it('should return false when collection has no documents', async () => {
      const mockCollection = {
        id: 'mock-collection',
        count: vi.fn().mockResolvedValue(0)
      };
      vectorService.collections.set('user_test123', mockCollection);

      const result = await vectorService.indexExists('test123');
      expect(result).toBe(false);
    });

    it('should return false when collection does not exist', async () => {
      const mockCollection = {
        id: 'mock-collection',
        count: vi.fn().mockRejectedValue(new Error('does not exist'))
      };
      vectorService.collections.set('user_test123', mockCollection);

      const result = await vectorService.indexExists('test123');
      expect(result).toBe(false);
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
    });
  });

  describe('rebuildIndex', () => {
    beforeEach(() => {
    });

    afterEach(() => {
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

  describe('search', () => {
    it('should return empty array if no index exists', async () => {
      const mockCollection = {
        query: vi.fn().mockResolvedValue({
          documents: [[]],
          distances: [[]],
          metadatas: [[]]
        })
      };
      vectorService.collections.set('user_user123', mockCollection);

      const results = await vectorService.search('user123', 'test query');
      expect(results).toEqual([]);
    });

    it('should filter by relationType', async () => {
      const mockCollection = {
        query: vi.fn().mockResolvedValue({
          documents: [['Test content']],
          distances: [[0.3]],
          metadatas: [[{ category: 'family', helperId: 'helper1' }]]
        })
      };
      vectorService.collections.set('user_user123', mockCollection);

      const results = await vectorService.search('user123', 'test query', 5, 'family', 'helper1');

      expect(mockCollection.query).toHaveBeenCalledWith({
        queryEmbeddings: [[0.1, 0.2]],
        nResults: 5,
        where: { category: 'family', helperId: 'helper1' }
      });
    });

    it('should return results with correct format', async () => {
      const mockCollection = {
        query: vi.fn().mockResolvedValue({
          documents: [['First result', 'Second result']],
          distances: [[0.2, 0.5]],
          metadatas: [[
            { category: 'self', memoryId: 'mem1' },
            { category: 'family', memoryId: 'mem2', helperId: 'helper1' }
          ]]
        })
      };
      vectorService.collections.set('user_user123', mockCollection);

      const results = await vectorService.search('user123', 'test query', 5);

      expect(results).toEqual([
        {
          content: 'First result',
          relevanceScore: 0.8,
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

    it('should return empty array on error', async () => {
      const mockCollection = {
        query: vi.fn().mockRejectedValue(new Error('Search failed'))
      };
      vectorService.collections.set('user_user123', mockCollection);

      const results = await vectorService.search('user123', 'test query');
      expect(results).toEqual([]);
    });

    it('should use default topK of 5', async () => {
      const mockCollection = {
        query: vi.fn().mockResolvedValue({
          documents: [['Test']],
          distances: [[0.1]],
          metadatas: [[{ category: 'self' }]]
        })
      };
      vectorService.collections.set('user_user123', mockCollection);

      await vectorService.search('user123', 'test query');

      expect(mockCollection.query).toHaveBeenCalledWith({
        queryEmbeddings: [[0.1, 0.2]],
        nResults: 5,
        where: undefined
      });
    });

    it('should filter by relationType without relationSpecificId', async () => {
      const mockCollection = {
        query: vi.fn().mockResolvedValue({
          documents: [['Test content']],
          distances: [[0.3]],
          metadatas: [[{ category: 'friend', helperId: 'helper1' }]]
        })
      };
      vectorService.collections.set('user_user123', mockCollection);

      const results = await vectorService.search('user123', 'test query', 5, 'friend');

      expect(mockCollection.query).toHaveBeenCalledWith({
        queryEmbeddings: [[0.1, 0.2]],
        nResults: 5,
        where: { category: 'friend' }
      });
    });
  });
});

describe('RoleCardController', () => {
  describe('buildVectorIndex', () => {
    beforeEach(() => {
    });

    afterEach(() => {
      mockLoadUserMemories.mockReset();
    });

    it('should return error if no A_set memories', async () => {
      mockLoadUserMemories.mockResolvedValue({
        A_set: [],
        Bste: [],
        Cste: []
      });

      const mockReq = { user: { id: 'test123' } };
      const mockRes = {
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn()
      };

      await RoleCardController.buildVectorIndex(mockReq, mockRes);

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('请先完成至少一个A套问题')
      );
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should build index successfully with memories', async () => {
      const mockMemories = Array.from({ length: 10 }, (_, i) => ({
        memoryId: `mem${i}`,
        targetUserId: 'test123',
        question: `Question ${i}`,
        answer: `Answer ${i}`,
        questionRole: 'elder',
        questionLayer: 'basic',
        questionOrder: i,
        createdAt: '2024-01-01T00:00:00.000Z'
      }));

      mockLoadUserMemories.mockResolvedValue({
        A_set: mockMemories,
        Bste: [],
        Cste: []
      });

      const mockReq = { user: { id: 'test123' } };
      const mockRes = {
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn()
      };

      const vectorService = new VectorIndexService();
      const mockCollection = {
        delete: vi.fn().mockResolvedValue(undefined),
        add: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(10)
      };
      vectorService.collections.set('user_test123', mockCollection);

      await RoleCardController.buildVectorIndex(mockReq, mockRes);

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('event: done')
      );
      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe('getVectorIndexStatus', () => {
    it('should return status with existing index', async () => {

      const mockMemories = Array.from({ length: 5 }, (_, i) => ({
        memoryId: `mem${i}`,
        targetUserId: 'test123',
        question: `Question ${i}`,
        answer: `Answer ${i}`,
        questionRole: 'elder',
        questionLayer: 'basic',
        questionOrder: i,
        createdAt: '2024-01-01T00:00:00.000Z'
      }));

      mockLoadUserMemories.mockResolvedValue({
        A_set: mockMemories,
        Bste: [],
        Cste: []
      });

      const mockReq = { user: { id: 'test123' } };
      const mockRes = {
        json: vi.fn()
      };

      await RoleCardController.getVectorIndexStatus(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: expect.objectContaining({
            exists: false,
            memoryCount: 5,
            canBuild: true
          })
        })
      );
    });

    it('should return status without A_set memories', async () => {

      mockLoadUserMemories.mockResolvedValue({
        A_set: [],
        Bste: [{ memoryId: 'mem1' }],
        Cste: [{ memoryId: 'mem2' }]
      });

      const mockReq = { user: { id: 'test123' } };
      const mockRes = {
        json: vi.fn()
      };

      await RoleCardController.getVectorIndexStatus(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: expect.objectContaining({
            exists: false,
            memoryCount: 2,
            canBuild: false
          })
        })
      );
    });
  });
});
