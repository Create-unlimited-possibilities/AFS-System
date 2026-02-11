import { describe, it, expect, beforeEach, vi } from 'vitest';
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
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      try {
        await expect(vectorService.initialize()).rejects.toThrow('OPENAI_API_KEY environment variable is required');
      } finally {
        process.env.OPENAI_API_KEY = originalKey;
      }
    });
  });

  describe('getCollection', () => {
    it('should throw error when trying to use uninitialized service', async () => {
      await expect(vectorService.getCollection('user123')).rejects.toThrow();
    });

    it('should return cached collection if exists', async () => {
      const mockCollection = { id: 'mock_collection_123' };
      vectorService.collections.set('user_123', mockCollection);

      const result = await vectorService.getCollection('123');
      expect(result).toBe(mockCollection);
    });
  });
});
