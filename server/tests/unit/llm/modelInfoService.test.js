/**
 * Tests for OllamaModelInfoService
 * Following TDD approach - tests written first
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock the module before importing it
// This is handled dynamically in the tests

describe('OllamaModelInfoService', () => {
  let service;
  let OllamaModelInfoService;
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.resetModules();

    // Mock fetch globally
    global.fetch = vi.fn();

    // Set test environment
    process.env = { ...originalEnv, OLLAMA_BASE_URL: 'http://localhost:11434' };

    // Import fresh module for each test
    const module = await import('../../../src/core/llm/modelInfoService.js');
    OllamaModelInfoService = module.default;

    // Get the class from the instance (for testing)
    service = OllamaModelInfoService;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
    if (service && service.clearCache) {
      service.clearCache();
    }
  });

  describe('getContextLimit', () => {
    it('should fetch and return context_length from Ollama API', async () => {
      // Mock successful API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model_info: {
            'qwen3.context_length': 131072,
            'qwen3.embedding_length': 4096
          },
          parameters: 'num_ctx 4096'
        })
      });

      const result = await service.getContextLimit('test-model');

      expect(result).toBe(131072);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/show',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ model: 'test-model' })
        })
      );
    });

    it('should return cached value on second call', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model_info: { 'qwen3.context_length': 65536 }
        })
      });

      await service.getContextLimit('cached-model');
      await service.getContextLimit('cached-model');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should return default when API fails', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.getContextLimit('unknown-model');

      expect(result).toBe(65536);
    });

    it('should return default when context_length not found', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ model_info: {} })
      });

      const result = await service.getContextLimit('no-context-model');

      expect(result).toBe(65536);
    });

    it('should extract context_length from different model families (llama)', async () => {
      // Test llama family
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model_info: { 'llama.context_length': 8192 }
        })
      });

      const result = await service.getContextLimit('llama-model');
      expect(result).toBe(8192);
    });

    it('should extract context_length from qwen family', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model_info: { 'qwen2.context_length': 32768 }
        })
      });

      const result = await service.getContextLimit('qwen-model');
      expect(result).toBe(32768);
    });

    it('should fallback to num_ctx parameter if context_length missing', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model_info: {},
          parameters: 'num_ctx 16384\ntemperature 0.7'
        })
      });

      const result = await service.getContextLimit('param-model');

      expect(result).toBe(16384);
    });

    it('should use default OLLAMA_BASE_URL when env not set', async () => {
      process.env = { ...originalEnv };
      delete process.env.OLLAMA_BASE_URL;

      // Re-import to get new instance with no env
      vi.resetModules();
      const module = await import('../../../src/core/llm/modelInfoService.js');
      const newService = module.default;

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model_info: { 'qwen3.context_length': 65536 }
        })
      });

      await newService.getContextLimit('test');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://modelserver:11434/api/show',
        expect.any(Object)
      );

      newService.clearCache();
    });

    it('should handle API returning non-OK status', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await service.getContextLimit('missing-model');

      expect(result).toBe(65536);
    });
  });

  describe('clearCache', () => {
    it('should clear cached model info', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model_info: { 'qwen3.context_length': 32768 }
        })
      });

      await service.getContextLimit('clear-test');
      service.clearCache();

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model_info: { 'qwen3.context_length': 32768 }
        })
      });

      await service.getContextLimit('clear-test');

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          model_info: { 'qwen3.context_length': 65536 }
        })
      });

      await service.getContextLimit('model1');
      await service.getContextLimit('model2');

      const stats = service.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.models).toContain('model1');
      expect(stats.models).toContain('model2');
    });

    it('should return empty stats when cache is empty', () => {
      const stats = service.getCacheStats();

      expect(stats.size).toBe(0);
      expect(stats.models).toEqual([]);
    });
  });

  describe('refreshContextLimit', () => {
    it('should force refresh cache for a model', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            model_info: { 'qwen3.context_length': 32768 }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            model_info: { 'qwen3.context_length': 65536 }
          })
        });

      const first = await service.getContextLimit('refresh-test');
      expect(first).toBe(32768);

      const refreshed = await service.refreshContextLimit('refresh-test');
      expect(refreshed).toBe(65536);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle malformed JSON response gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      const result = await service.getContextLimit('malformed-model');

      expect(result).toBe(65536);
    });

    it('should handle timeout gracefully', async () => {
      // Mock a timeout by having fetch hang
      global.fetch.mockImplementationOnce(() =>
        new Promise((_, reject) => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          setTimeout(() => reject(error), 100);
        })
      );

      const result = await service.getContextLimit('timeout-model');

      expect(result).toBe(65536);
    });

    it('should handle plain context_length key (without prefix)', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model_info: { context_length: 16384 }
        })
      });

      const result = await service.getContextLimit('plain-model');

      expect(result).toBe(16384);
    });

    it('should handle num_ctx with various formats', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model_info: {},
          parameters: 'temperature 0.7\nnum_ctx 8192\nstop "END"'
        })
      });

      const result = await service.getContextLimit('format-model');

      expect(result).toBe(8192);
    });
  });
});
