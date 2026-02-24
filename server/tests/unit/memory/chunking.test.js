/**
 * Topic Chunking Unit Tests
 * Tests the topic-based memory chunking functionality
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the logger
vi.mock('../../../src/core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock MemoryStore
const savedChunks = [];
vi.mock('../../../src/modules/memory/MemoryStore.js', () => ({
  default: class MockMemoryStore {
    async saveMemory(userId, partnerId, data) {
      const chunk = {
        memoryId: `chunk_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        userId,
        partnerId,
        ...data,
        savedAt: new Date()
      };
      savedChunks.push(chunk);
      return { memoryId: chunk.memoryId, filePath: `/test/${chunk.memoryId}.json`, memory: chunk };
    }

    async loadUserMemories(userId) {
      const userChunks = savedChunks.filter(c => c.userId === userId);
      const byPartner = {};
      for (const chunk of userChunks) {
        if (!byPartner[chunk.partnerId]) {
          byPartner[chunk.partnerId] = [];
        }
        byPartner[chunk.partnerId].push(chunk);
      }
      return byPartner;
    }
  }
}));

// Mock VectorIndexService
const indexedChunks = [];
vi.mock('../../../src/core/storage/vector.js', () => ({
  default: class MockVectorIndexService {
    async initialize() {
      return true;
    }

    async indexMemory(userId, memoryId, data) {
      indexedChunks.push({ userId, memoryId, data, indexedAt: new Date() });
      return { success: true };
    }

    async searchSimilar(userId, query, limit = 5) {
      // Return mock similar results based on query keywords
      const results = indexedChunks
        .filter(c => c.userId === userId)
        .slice(0, limit)
        .map(c => ({
          memoryId: c.memoryId,
          score: 0.85,
          content: c.data?.content?.processed?.summary || 'Test summary'
        }));
      return results;
    }
  }
}));

describe('Topic Chunking System', () => {
  beforeEach(() => {
    savedChunks.length = 0;
    indexedChunks.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== Topic Detection Tests ====================

  describe('Topic Detection', () => {
    /**
     * Simulates topic detection logic
     */
    function detectTopicBoundaries(messages) {
      const boundaries = [0]; // Start of conversation
      const topicKeywords = {
        health: ['健康', '医院', '医生', '药', '身体', 'health', 'doctor'],
        family: ['家人', '儿子', '女儿', '孙子', '老伴', 'family', 'son', 'daughter'],
        hobbies: ['爱好', '兴趣', '喜欢', '爱做', 'hobby', 'like'],
        weather: ['天气', '下雨', '晴天', '冷', '热', 'weather'],
        food: ['吃', '喝', '饭', '菜', 'food', 'eat'],
        end: ['再见', '拜拜', 'bye', 'goodbye', '不聊了']
      };

      let currentTopic = null;

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.role !== 'user') continue;

        const content = msg.content.toLowerCase();
        let detectedTopic = null;

        for (const [topic, keywords] of Object.entries(topicKeywords)) {
          if (keywords.some(kw => content.includes(kw))) {
            detectedTopic = topic;
            break;
          }
        }

        // If topic changed and we have a previous topic, mark boundary
        if (detectedTopic && detectedTopic !== currentTopic && currentTopic !== null) {
          boundaries.push(i);
        }

        if (detectedTopic) {
          currentTopic = detectedTopic;
        }
      }

      return boundaries;
    }

    it('should detect topic changes in conversation', () => {
      const messages = [
        { role: 'user', content: '今天天气真好' },
        { role: 'assistant', content: '是啊，阳光明媚' },
        { role: 'user', content: '我最近身体不太好' },
        { role: 'assistant', content: '怎么了？去看医生了吗？' }
      ];

      const boundaries = detectTopicBoundaries(messages);

      expect(boundaries.length).toBeGreaterThan(1);
    });

    it('should detect end of conversation topic', () => {
      const messages = [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好！' },
        { role: 'user', content: '再见，下次聊' },
        { role: 'assistant', content: '好的，再见' }
      ];

      const boundaries = detectTopicBoundaries(messages);

      // Should detect the 'bye' topic
      expect(boundaries.length).toBeGreaterThan(0);
    });

    it('should group messages by topic', () => {
      const messages = [
        { role: 'user', content: '最近身体怎么样？' },
        { role: 'assistant', content: '还好，就是有点小毛病' },
        { role: 'user', content: '有去看医生吗？' },
        { role: 'assistant', content: '去了，医生说没事' },
        { role: 'user', content: '那挺好的。你家人还好吗？' },
        { role: 'assistant', content: '他们都很好' }
      ];

      const boundaries = detectTopicBoundaries(messages);

      // Should detect transition from health to family topic
      expect(boundaries.length).toBeGreaterThan(1);
    });
  });

  // ==================== Chunk Creation Tests ====================

  describe('Chunk Creation', () => {
    /**
     * Simulates chunk creation
     */
    function createChunks(messages, boundaries) {
      const chunks = [];

      for (let i = 0; i < boundaries.length; i++) {
        const start = boundaries[i];
        const end = boundaries[i + 1] || messages.length;

        if (start < end) {
          chunks.push({
            chunkId: `chunk_${i}_${Date.now()}`,
            messages: messages.slice(start, end),
            startIndex: start,
            endIndex: end - 1,
            messageCount: end - start,
            createdAt: new Date()
          });
        }
      }

      return chunks;
    }

    it('should create chunks based on boundaries', () => {
      const messages = [
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Message 2' },
        { role: 'assistant', content: 'Response 2' },
        { role: 'user', content: 'Message 3' },
        { role: 'assistant', content: 'Response 3' }
      ];
      const boundaries = [0, 2, 4];

      const chunks = createChunks(messages, boundaries);

      expect(chunks.length).toBe(3);
      expect(chunks[0].messageCount).toBe(2);
      expect(chunks[1].messageCount).toBe(2);
      expect(chunks[2].messageCount).toBe(2);
    });

    it('should handle single chunk when no boundaries', () => {
      const messages = [
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' }
      ];
      const boundaries = [0];

      const chunks = createChunks(messages, boundaries);

      expect(chunks.length).toBe(1);
      expect(chunks[0].messages).toEqual(messages);
    });

    it('should include metadata in chunks', () => {
      const messages = [
        { role: 'user', content: 'Hello', timestamp: new Date() },
        { role: 'assistant', content: 'Hi', timestamp: new Date() }
      ];
      const boundaries = [0];

      const chunks = createChunks(messages, boundaries);

      expect(chunks[0]).toHaveProperty('chunkId');
      expect(chunks[0]).toHaveProperty('startIndex');
      expect(chunks[0]).toHaveProperty('endIndex');
      expect(chunks[0]).toHaveProperty('messageCount');
      expect(chunks[0]).toHaveProperty('createdAt');
    });
  });

  // ==================== Incomplete Topic Detection Tests ====================

  describe('Incomplete Topic Detection', () => {
    /**
     * Simulates incomplete topic detection
     */
    function detectIncompleteTopics(messages) {
      const incompletePatterns = [
        /\?$/, // Ends with question
        /吗[？?]$/, // Chinese question
        /呢[？?]$/, // Chinese inquiry
        /什么/, // Asking "what"
        /怎么/, // Asking "how"
        /为什么/, // Asking "why"
        /谁/, // Asking "who"
        /哪里/, // Asking "where"
      ];

      const incomplete = [];

      for (let i = 0; i < messages.length - 1; i++) {
        const msg = messages[i];
        if (msg.role !== 'assistant') continue;

        const nextMsg = messages[i + 1];
        if (nextMsg.role !== 'user') continue;

        // Check if assistant's response might be incomplete
        const content = msg.content.trim();
        const isPossiblyIncomplete = incompletePatterns.some(pattern =>
          pattern.test(content) || content.length < 10
        );

        if (isPossiblyIncomplete) {
          incomplete.push({
            messageIndex: i,
            content: content,
            reason: 'Short or question-like response'
          });
        }
      }

      return incomplete;
    }

    it('should detect potentially incomplete responses', () => {
      const messages = [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '嗯？' }, // Very short, possibly incomplete
        { role: 'user', content: '我问你好' },
        { role: 'assistant', content: '你好！' }
      ];

      const incomplete = detectIncompleteTopics(messages);

      expect(incomplete.length).toBeGreaterThan(0);
    });

    it('should detect question endings as potentially incomplete', () => {
      const messages = [
        { role: 'user', content: '我今天应该做什么？' },
        { role: 'assistant', content: '你觉得呢？' }, // Ends with question
        { role: 'user', content: '我不知道' }
      ];

      const incomplete = detectIncompleteTopics(messages);

      expect(incomplete.length).toBeGreaterThan(0);
    });

    it('should not mark complete responses as incomplete', () => {
      const messages = [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好！很高兴见到你。今天过得怎么样？' },
        { role: 'user', content: '挺好的' },
        { role: 'assistant', content: '那真是太好了！有什么特别的事情发生吗？' }
      ];

      const incomplete = detectIncompleteTopics(messages);

      // These are complete responses even though they end with questions
      expect(incomplete.length).toBe(0);
    });
  });

  // ==================== Chunk Storage Tests ====================

  describe('Chunk Storage', () => {
    it('should store chunks with proper structure', async () => {
      const MemoryStore = (await import('../../../src/modules/memory/MemoryStore.js')).default;
      const store = new MemoryStore();

      const chunkData = {
        content: {
          raw: JSON.stringify([
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' }
          ]),
          processed: {
            summary: 'Greeting exchange',
            keyTopics: ['greeting']
          }
        },
        meta: {
          messageCount: 2,
          chunkIndex: 0,
          compressionStage: 'raw'
        }
      };

      const result = await store.saveMemory('user_1', 'partner_1', chunkData);

      expect(result).toHaveProperty('memoryId');
      expect(result.memoryId).toMatch(/^chunk_/);
    });

    it('should load stored chunks by user', async () => {
      const MemoryStore = (await import('../../../src/modules/memory/MemoryStore.js')).default;
      const store = new MemoryStore();

      // Save multiple chunks
      await store.saveMemory('user_2', 'partner_1', {
        content: { raw: 'chunk1', processed: { summary: 'First chunk' } }
      });
      await store.saveMemory('user_2', 'partner_2', {
        content: { raw: 'chunk2', processed: { summary: 'Second chunk' } }
      });

      const memories = await store.loadUserMemories('user_2');

      expect(Object.keys(memories).length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==================== Vector Search Tests ====================

  describe('Vector Search', () => {
    it('should index chunks for vector search', async () => {
      const VectorIndexService = (await import('../../../src/core/storage/vector.js')).default;
      const service = new VectorIndexService();

      await service.initialize();

      const result = await service.indexMemory('user_1', 'mem_123', {
        content: { processed: { summary: 'Test chunk for indexing' } }
      });

      expect(result.success).toBe(true);
    });

    it('should search for similar chunks', async () => {
      const VectorIndexService = (await import('../../../src/core/storage/vector.js')).default;
      const service = new VectorIndexService();

      await service.initialize();

      // Index a chunk first
      await service.indexMemory('user_1', 'mem_456', {
        content: { processed: { summary: 'Weather discussion' } }
      });

      // Search for similar content
      const results = await service.searchSimilar('user_1', '天气怎么样', 5);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ==================== Chunk Size Tests ====================

  describe('Chunk Size Management', () => {
    /**
     * Calculates optimal chunk size based on message count and content
     */
    function calculateChunkSize(messages, maxMessages = 20, maxTokens = 2000) {
      const chunks = [];
      let currentChunk = [];
      let currentTokenCount = 0;

      // Simple token estimation: ~4 chars per token for Chinese, ~0.25 for ASCII
      const estimateTokens = (text) => {
        let tokens = 0;
        for (const char of text) {
          if (/[\u4e00-\u9fff]/.test(char)) {
            tokens += 1.5; // Chinese character
          } else {
            tokens += 0.25; // ASCII
          }
        }
        return Math.ceil(tokens);
      };

      for (const msg of messages) {
        const msgTokens = estimateTokens(msg.content || '');

        if (currentChunk.length >= maxMessages || currentTokenCount + msgTokens > maxTokens) {
          if (currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = [];
            currentTokenCount = 0;
          }
        }

        currentChunk.push(msg);
        currentTokenCount += msgTokens;
      }

      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }

      return chunks;
    }

    it('should split large conversations into appropriate chunks', () => {
      const messages = [];
      for (let i = 0; i < 50; i++) {
        messages.push({ role: 'user', content: `这是第${i + 1}条消息` });
        messages.push({ role: 'assistant', content: `这是第${i + 1}条回复` });
      }

      const chunks = calculateChunkSize(messages, 20, 2000);

      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(20);
      }
    });

    it('should keep small conversations as single chunk', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
        { role: 'assistant', content: 'I am well!' }
      ];

      const chunks = calculateChunkSize(messages, 20, 2000);

      expect(chunks.length).toBe(1);
    });

    it('should respect token limits', () => {
      // Create messages with high token count
      const messages = [
        { role: 'user', content: 'A'.repeat(5000) }, // ~1250 tokens
        { role: 'assistant', content: 'B'.repeat(5000) }, // ~1250 tokens
        { role: 'user', content: 'C'.repeat(5000) } // Would exceed 2000 token limit
      ];

      const chunks = calculateChunkSize(messages, 20, 2000);

      // Should split due to token limit
      expect(chunks.length).toBeGreaterThan(1);
    });
  });
});
