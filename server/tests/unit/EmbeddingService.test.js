import { describe, it, expect, beforeEach, vi } from 'vitest';

let mockOllamaShouldFail = false;
let mockOpenAIShouldFail = false;

vi.mock('@langchain/ollama', () => ({
  OllamaEmbeddings: class {
    constructor(options) {
      this.baseUrl = options?.baseUrl || 'http://localhost:11434';
      this.model = options?.model || 'bge-m3';
    }
    embedQuery = vi.fn().mockImplementation(async () => {
      if (mockOllamaShouldFail) {
        throw new Error('Ollama connection failed');
      }
      return [0.1, 0.2, 0.3];
    });
    embedDocuments = vi.fn().mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]);
  }
}));

vi.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: class {
    constructor(options) {
      this.openAIApiKey = options?.openAIApiKey;
      this.modelName = options?.modelName || 'text-embedding-3-small';
    }
    embedQuery = vi.fn().mockResolvedValue([0.4, 0.5, 0.6]);
    embedDocuments = vi.fn().mockResolvedValue([[0.4, 0.5], [0.6, 0.7]]);
  }
}));

describe('EmbeddingService', () => {
  let EmbeddingService;
  let embeddingService;

  beforeEach(async () => {
    vi.resetModules();
    process.env.EMBEDDING_BACKEND = 'ollama';
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    process.env.EMBEDDING_MODEL = 'bge-m3';
    EmbeddingService = (await import('../../src/services/EmbeddingService.js')).default;
    embeddingService = new EmbeddingService();
  });

  describe('initialize', () => {
    it('should initialize Ollama client when backend is ollama', async () => {
      await embeddingService.initialize();
      expect(embeddingService.client).toBeDefined();
      expect(embeddingService.client.model).toBe('bge-m3');
    });

    it('should initialize OpenAI client when backend is openai', async () => {
      process.env.EMBEDDING_BACKEND = 'openai';
      process.env.OPENAI_API_KEY = 'test-api-key';
      vi.resetModules();
      EmbeddingService = (await import('../../src/services/EmbeddingService.js')).default;
      embeddingService = new EmbeddingService();
      
      await embeddingService.initialize();
      expect(embeddingService.client).toBeDefined();
      expect(embeddingService.client.modelName).toBe('text-embedding-3-small');
    });

    it('should throw error if backend is invalid', async () => {
      process.env.EMBEDDING_BACKEND = 'invalid';
      vi.resetModules();
      EmbeddingService = (await import('../../src/services/EmbeddingService.js')).default;
      embeddingService = new EmbeddingService();
      
      await expect(embeddingService.initialize()).rejects.toThrow();
    });

    it('should not reinitialize if already initialized', async () => {
      await embeddingService.initialize();
      const client1 = embeddingService.client;
      await embeddingService.initialize();
      const client2 = embeddingService.client;
      expect(client1).toBe(client2);
    });
  });

  describe('embedQuery', () => {
    it('should generate embedding for a single text', async () => {
      await embeddingService.initialize();
      const embedding = await embeddingService.embedQuery('test text');
      expect(embedding).toEqual([0.1, 0.2, 0.3]);
      expect(embeddingService.client.embedQuery).toHaveBeenCalledWith('test text');
    });

    it('should auto-initialize if not initialized', async () => {
      const embedding = await embeddingService.embedQuery('test text');
      expect(embedding).toEqual([0.1, 0.2, 0.3]);
      expect(embeddingService.client).toBeDefined();
    });

    it('should throw error if initialization fails', async () => {
      mockOllamaShouldFail = true;
      vi.resetModules();
      EmbeddingService = (await import('../../src/services/EmbeddingService.js')).default;
      embeddingService = new EmbeddingService();
      
      await expect(embeddingService.embedQuery('test')).rejects.toThrow();
      mockOllamaShouldFail = false;
    });
  });

  describe('embedDocuments', () => {
    it('should generate embeddings for multiple texts', async () => {
      await embeddingService.initialize();
      const embeddings = await embeddingService.embedDocuments(['text1', 'text2']);
      expect(embeddings).toEqual([[0.1, 0.2], [0.3, 0.4]]);
      expect(embeddingService.client.embedDocuments).toHaveBeenCalledWith(['text1', 'text2']);
    });

    it('should auto-initialize if not initialized', async () => {
      const embeddings = await embeddingService.embedDocuments(['text1', 'text2']);
      expect(embeddings).toEqual([[0.1, 0.2], [0.3, 0.4]]);
      expect(embeddingService.client).toBeDefined();
    });
  });

  describe('healthCheck', () => {
    it('should return true if service is healthy', async () => {
      await embeddingService.initialize();
      const isHealthy = await embeddingService.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false if service is not healthy', async () => {
      mockOllamaShouldFail = true;
      vi.resetModules();
      EmbeddingService = (await import('../../src/services/EmbeddingService.js')).default;
      embeddingService = new EmbeddingService();
      
      const isHealthy = await embeddingService.healthCheck();
      expect(isHealthy).toBe(false);
      mockOllamaShouldFail = false;
    });

    it('should auto-initialize during health check', async () => {
      const isHealthy = await embeddingService.healthCheck();
      expect(isHealthy).toBe(true);
      expect(embeddingService.client).toBeDefined();
    });
  });
});
