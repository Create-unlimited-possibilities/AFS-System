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

    it('should throw error for userId starting with number', async () => {
      await expect(vectorService.getCollection('123user')).rejects.toThrow('Invalid userId: contains invalid characters for ChromaDB collection names');
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
});
