/**
 * Memory Flow Integration Tests
 * Tests the complete memory lifecycle from save to compress to index
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fsPromises from 'fs/promises';
import path from 'path';
import MemoryStore from '../../../src/modules/memory/MemoryStore.js';
import PendingTopicsManager from '../../../src/modules/memory/PendingTopicsManager.js';

// Mock the logger
vi.mock('../../../src/core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock LLMClient for MemoryExtractor and Compressor
vi.mock('../../../src/core/llm/client.js', () => ({
  default: class MockLLMClient {
    constructor(model, options) {
      this.model = model;
      this.options = options;
    }

    async generate(prompt, options) {
      // Return mock responses based on prompt content
      if (prompt.includes('记忆提取') || prompt.includes('提取')) {
        return JSON.stringify({
          summary: '关于日常生活的愉快对话',
          topicSummary: '日常聊天',
          keyTopics: ['家庭', '健康', '日常生活'],
          facts: ['用户今天感觉很好', '用户提到孙子的情况'],
          emotionalJourney: {
            start: '平静',
            peak: '开心',
            end: '满足'
          },
          memorableMoments: [
            {
              content: '提到孙子时特别开心',
              importance: 0.9,
              emotionTag: '开心',
              reason: '与家庭关系密切'
            }
          ],
          pendingTopics: [
            {
              topic: '下次继续聊孙子的学校生活',
              context: '孙子刚开学',
              suggestedFollowUp: '问问孙子学校怎么样',
              urgency: 'medium'
            }
          ],
          personalityFiltered: {
            retentionScore: 0.85,
            likelyToRecall: ['孙子', '学校'],
            likelyToForget: [],
            forgetReason: ''
          },
          tags: ['family', 'grandchildren', 'daily']
        });
      }

      if (prompt.includes('V1压缩') || prompt.includes('压缩')) {
        return JSON.stringify({
          compressedContent: '压缩后的对话摘要：与家人愉快聊天，提到孙子开学的情况。',
          compressionRatio: 0.4,
          keyPoints: ['家庭话题', '孙子近况'],
          emotionalHighlights: ['开心', '期待'],
          personalityAdjustment: {},
          originalLength: 500,
          compressedLength: 200
        });
      }

      return JSON.stringify({});
    }

    async healthCheck() {
      return true;
    }
  }
}));

// Mock Indexer to avoid actual ChromaDB operations
vi.mock('../../../src/modules/memory/Indexer.js', () => ({
  default: class MockIndexer {
    constructor() {
      this.indexedMemories = [];
    }

    async indexConversationMemory(userId, memory) {
      this.indexedMemories.push({ userId, memoryId: memory.memoryId });
      return {
        success: true,
        memoryId: memory.memoryId,
        indexed: true,
        indexedAt: new Date().toISOString()
      };
    }

    async indexMemory(userId, memory) {
      return this.indexConversationMemory(userId, memory);
    }

    async indexBatch(userId, memories) {
      const results = { total: memories.length, indexed: 0, failed: 0, memoryIds: [] };
      for (const memory of memories) {
        const result = await this.indexConversationMemory(userId, memory);
        if (result.success) {
          results.indexed++;
          results.memoryIds.push(result.memoryId);
        } else {
          results.failed++;
        }
      }
      return { success: true, ...results };
    }

    getIndexingStatus(userId) {
      return { status: 'idle', userId, queuedCount: 0 };
    }
  }
}));

// Mock VectorIndexService
vi.mock('../../../src/core/storage/vector.js', () => ({
  default: class MockVectorIndexService {
    constructor() {
      this.collections = new Map();
    }

    async getCollection(userId) {
      if (!this.collections.has(userId)) {
        this.collections.set(userId, {
          items: [],
          add: vi.fn(async ({ ids, embeddings, documents, metadatas }) => {
            for (let i = 0; i < ids.length; i++) {
              this.collections.get(userId).items.push({
                id: ids[i],
                embedding: embeddings[i],
                document: documents[i],
                metadata: metadatas[i]
              });
            }
          }),
          query: vi.fn(async () => ({ ids: [], documents: [], metadatas: [] })),
          delete: vi.fn()
        });
      }
      return this.collections.get(userId);
    }

    buildMemoryText(memory) {
      if (memory.content?.processed?.summary) {
        return memory.content.processed.summary;
      }
      return memory.content?.raw || '';
    }

    buildMetadata(memory) {
      return {
        memoryId: memory.memoryId,
        createdAt: memory.meta?.createdAt,
        compressionStage: memory.meta?.compressionStage || 'raw'
      };
    }
  }
}));

// Mock EmbeddingService
vi.mock('../../../src/core/storage/embedding.js', () => ({
  default: class MockEmbeddingService {
    async embedQuery(text) {
      // Return a mock embedding vector
      return new Array(768).fill(0).map(() => Math.random());
    }

    async embedBatch(texts) {
      return texts.map(() => new Array(768).fill(0).map(() => Math.random()));
    }
  }
}));

describe('Memory Flow Integration', () => {
  let memoryStore;
  let pendingTopicsManager;
  // Use unique base path with random suffix to avoid conflicts in parallel runs
  const testBasePath = `./test_storage_memory_flow_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const testUserId = 'test_user_flow_123';
  const testPartnerId = 'test_partner_flow_456';

  beforeEach(async () => {
    // Create instances with test base path
    memoryStore = new MemoryStore();
    memoryStore.basePath = testBasePath;

    pendingTopicsManager = new PendingTopicsManager();
    pendingTopicsManager.basePath = testBasePath;

    // Ensure test directory exists
    await fsPromises.mkdir(testBasePath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fsPromises.rm(testBasePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete Memory Lifecycle', () => {
    it('should save conversation memory through MemoryStore', async () => {
      const conversationData = {
        raw: JSON.stringify([
          { content: '你好，今天怎么样？', isOwner: true },
          { content: '挺好的，刚送孙子去学校', isOwner: false },
          { content: '孙子几年级了？', isOwner: true },
          { content: '一年级，刚开学', isOwner: false }
        ]),
        messageCount: 4
      };

      const memoryData = {
        meta: {
          messageCount: conversationData.messageCount
        },
        content: {
          raw: conversationData.raw
        }
      };

      const result = await memoryStore.saveMemory(testUserId, testPartnerId, memoryData, false);

      expect(result.memoryId).toBeDefined();
      expect(result.memoryId).toMatch(/^mem_/);
      expect(result.filePath).toBeDefined();
      expect(result.memory.meta.messageCount).toBe(4);
      expect(result.memory.meta.compressionStage).toBe('raw');
    });

    it('should load and verify memories are persisted correctly', async () => {
      // Save a memory
      const saveResult = await memoryStore.saveMemory(testUserId, testPartnerId, {
        content: {
          raw: 'test conversation',
          processed: {
            summary: 'Test summary',
            keyTopics: ['topic1']
          }
        },
        meta: {
          compressionStage: 'raw'
        }
      }, false);

      // Load memories
      const memories = await memoryStore.loadUserMemories(testUserId);

      expect(memories[testPartnerId]).toBeDefined();
      expect(memories[testPartnerId]).toHaveLength(1);
      expect(memories[testPartnerId][0].memoryId).toBe(saveResult.memoryId);
      expect(memories[testPartnerId][0].content.raw).toBe('test conversation');
    });

    it('should update memory with extracted content', async () => {
      // Save initial memory
      const saveResult = await memoryStore.saveMemory(testUserId, testPartnerId, {
        content: { raw: 'original raw content' }
      }, false);

      // Simulate extraction result
      const extractedContent = {
        processed: {
          summary: 'Extracted summary',
          keyTopics: ['family', 'daily'],
          facts: ['Fact 1', 'Fact 2'],
          emotionalJourney: { start: 'calm', peak: 'happy', end: 'content' },
          memorableMoments: [{ content: 'Moment 1', importance: 0.9 }]
        }
      };

      // Update memory
      const updatedMemory = await memoryStore.updateMemory(saveResult.filePath, {
        content: extractedContent,
        meta: {
          compressionStage: 'raw'
        }
      });

      expect(updatedMemory.content.processed.summary).toBe('Extracted summary');
      expect(updatedMemory.content.raw).toBe('original raw content');

      // Verify persistence
      const memories = await memoryStore.loadUserMemories(testUserId);
      expect(memories[testPartnerId][0].content.processed.summary).toBe('Extracted summary');
    });

    it('should update memory with compression results', async () => {
      // Save and process a memory
      const saveResult = await memoryStore.saveMemory(testUserId, testPartnerId, {
        content: {
          raw: 'raw content',
          processed: { summary: 'processed summary' }
        }
      }, false);

      // Simulate compression result
      const compressionResult = {
        compressedContent: 'Compressed content summary',
        compressionRatio: 0.4,
        keyPoints: ['Point 1', 'Point 2'],
        compressionStage: 'v1'
      };

      // Update with compression
      await memoryStore.updateMemory(saveResult.filePath, {
        compression: compressionResult,
        meta: {
          compressionStage: 'v1',
          compressedAt: new Date().toISOString()
        }
      });

      // Verify
      const memories = await memoryStore.loadUserMemories(testUserId);
      expect(memories[testPartnerId][0].compression.compressedContent).toBe('Compressed content summary');
      expect(memories[testPartnerId][0].meta.compressionStage).toBe('v1');
    });

    it('should mark memory as indexed', async () => {
      const saveResult = await memoryStore.saveMemory(testUserId, testPartnerId, {
        content: { raw: 'test' }
      }, false);

      // Mark as indexed
      const indexedMemory = await memoryStore.markAsIndexed(saveResult.filePath);

      expect(indexedMemory.vectorIndex.indexed).toBe(true);
      expect(indexedMemory.vectorIndex.indexedAt).toBeDefined();

      // Verify persistence
      const memories = await memoryStore.loadUserMemories(testUserId);
      expect(memories[testPartnerId][0].vectorIndex.indexed).toBe(true);
    });
  });

  describe('Pending Topics Management', () => {
    it('should add pending topics', async () => {
      const topicData = {
        topic: '下次继续聊孙子的学校生活',
        context: '孙子刚开学',
        suggestedFollowUp: '问问孙子学校怎么样',
        withUserId: testPartnerId,
        urgency: 'medium'
      };

      const result = await pendingTopicsManager.addTopic(testUserId, topicData);

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^topic_/);
      expect(result.topic).toBe('下次继续聊孙子的学校生活');
      expect(result.context).toBe('孙子刚开学');
      expect(result.urgency).toBe('medium');
      expect(result.status).toBe('pending');
    });

    it('should get pending topics for a user', async () => {
      // Add multiple topics
      await pendingTopicsManager.addTopic(testUserId, {
        topic: 'Topic 1',
        withUserId: testPartnerId,
        urgency: 'high'
      });

      await pendingTopicsManager.addTopic(testUserId, {
        topic: 'Topic 2',
        withUserId: 'another_partner',
        urgency: 'low'
      });

      const topics = await pendingTopicsManager.getPendingTopics(testUserId);

      expect(topics.length).toBe(2);
      expect(topics[0].topic).toBe('Topic 1');
      expect(topics[1].topic).toBe('Topic 2');
    });

    it('should get topics for specific partner', async () => {
      await pendingTopicsManager.addTopic(testUserId, {
        topic: 'Partner topic 1',
        withUserId: testPartnerId,
        urgency: 'medium'
      });

      await pendingTopicsManager.addTopic(testUserId, {
        topic: 'Other partner topic',
        withUserId: 'other_partner',
        urgency: 'medium'
      });

      const partnerTopics = await pendingTopicsManager.getTopicsForPartner(testUserId, testPartnerId);

      expect(partnerTopics.length).toBe(1);
      expect(partnerTopics[0].topic).toBe('Partner topic 1');
    });

    it('should clear pending topic', async () => {
      const added = await pendingTopicsManager.addTopic(testUserId, {
        topic: 'Topic to clear',
        withUserId: testPartnerId
      });

      const cleared = await pendingTopicsManager.clearTopic(testUserId, added.id);

      expect(cleared).toBe(true);

      const topics = await pendingTopicsManager.getPendingTopics(testUserId);
      expect(topics.find(t => t.id === added.id)).toBeUndefined();
    });

    it('should mark topic as checked', async () => {
      const added = await pendingTopicsManager.addTopic(testUserId, {
        topic: 'Topic to check',
        withUserId: testPartnerId
      });

      const checked = await pendingTopicsManager.markAsChecked(testUserId, added.id);

      expect(checked).not.toBeNull();
      expect(checked.lastChecked).toBeDefined();
      expect(checked.checkCount).toBe(1);

      // Check again
      const checkedAgain = await pendingTopicsManager.markAsChecked(testUserId, added.id);
      expect(checkedAgain.checkCount).toBe(2);
    });

    it('should update topic status', async () => {
      const added = await pendingTopicsManager.addTopic(testUserId, {
        topic: 'Topic for status update',
        withUserId: testPartnerId,
        status: 'pending'
      });

      const updated = await pendingTopicsManager.updateTopicStatus(testUserId, added.id, 'addressed');

      expect(updated.status).toBe('addressed');
    });

    it('should get topic statistics', async () => {
      await pendingTopicsManager.addTopic(testUserId, {
        topic: 'High urgency topic',
        withUserId: 'partner1',
        urgency: 'high'
      });

      await pendingTopicsManager.addTopic(testUserId, {
        topic: 'Low urgency topic',
        withUserId: 'partner2',
        urgency: 'low'
      });

      const stats = await pendingTopicsManager.getTopicStats(testUserId);

      expect(stats.total).toBe(2);
      expect(stats.byUrgency.high).toBe(1);
      expect(stats.byUrgency.low).toBe(1);
    });
  });

  describe('Bidirectional Memory Save', () => {
    it('should save memories for both conversation participants', async () => {
      const options = {
        userAId: 'user_alice',
        userBId: 'user_bob',
        conversationData: {
          raw: JSON.stringify([
            { content: 'Hello from Alice', isOwner: true },
            { content: 'Hi from Bob', isOwner: false }
          ]),
          messageCount: 2
        },
        userAMemory: {
          processed: {
            summary: 'Alice perspective: talked with Bob',
            keyTopics: ['greeting']
          },
          tags: ['friend', 'greeting']
        },
        userBMemory: {
          processed: {
            summary: 'Bob perspective: talked with Alice',
            keyTopics: ['greeting']
          },
          tags: ['friend', 'greeting']
        },
        userBHasRoleCard: true
      };

      const result = await memoryStore.saveBidirectional(options);

      // Verify both memories were saved
      expect(result.userA.memoryId).toBeDefined();
      expect(result.userB.memoryId).toBeDefined();
      expect(result.userA.memoryId).not.toBe(result.userB.memoryId);

      // Load and verify Alice's memories
      const aliceMemories = await memoryStore.loadUserMemories('user_alice');
      expect(aliceMemories['user_bob']).toBeDefined();
      expect(aliceMemories['user_bob'][0].content.processed.summary).toBe('Alice perspective: talked with Bob');

      // Load and verify Bob's memories
      const bobMemories = await memoryStore.loadUserMemories('user_bob');
      expect(bobMemories['user_alice']).toBeDefined();
      expect(bobMemories['user_alice'][0].content.processed.summary).toBe('Bob perspective: talked with Alice');
    });
  });

  describe('Memory Statistics', () => {
    it('should calculate memory statistics correctly', async () => {
      // Create memories with different states
      await memoryStore.saveMemory(testUserId, 'partner1', {
        content: { raw: 'raw memory' },
        meta: { compressionStage: 'raw' }
      }, false);

      await memoryStore.saveMemory(testUserId, 'partner2', {
        content: { raw: 'indexed raw memory' },
        meta: { compressionStage: 'raw' },
        vectorIndex: { indexed: true, indexedAt: new Date().toISOString() }
      }, false);

      await memoryStore.saveMemory(testUserId, 'partner3', {
        content: { raw: 'v1 memory' },
        meta: { compressionStage: 'v1', compressedAt: new Date().toISOString() }
      }, false);

      const stats = await memoryStore.getMemoryStats(testUserId);

      expect(stats.totalMemories).toBe(3);
      expect(stats.totalPartners).toBe(3);
      expect(stats.byCompressionStage.raw).toBe(2);
      expect(stats.byCompressionStage.v1).toBe(1);
      expect(stats.indexed).toBe(1);
    });
  });

  describe('Memory Pending Compression', () => {
    it('should find memories eligible for compression', async () => {
      // Create an old memory with unique summary to ensure unique file name
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 5);

      await memoryStore.saveMemory(testUserId, testPartnerId, {
        content: { raw: 'old memory content for compression', processed: { summary: 'old unique summary for compression test' } },
        meta: {
          createdAt: oldDate.toISOString(),
          compressionStage: 'raw'
        }
      }, false);

      const pending = await memoryStore.getMemoriesPendingCompression(testUserId, 'raw', 3);

      // Only the old memory should be pending
      expect(pending.length).toBeGreaterThanOrEqual(1);

      const oldMemoryInList = pending.find(m => m.memory.content.raw === 'old memory content for compression');
      expect(oldMemoryInList).toBeDefined();
      expect(oldMemoryInList.age).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user gracefully', async () => {
      const memories = await memoryStore.loadUserMemories('nonexistent_user');
      expect(memories).toEqual({});
    });

    it('should handle invalid memory ID when finding', async () => {
      const found = await memoryStore.findMemoryFile(testUserId, 'nonexistent_memory_id');
      expect(found).toBeNull();
    });

    it('should handle clearing non-existent topic', async () => {
      const cleared = await pendingTopicsManager.clearTopic(testUserId, 'nonexistent_topic_id');
      expect(cleared).toBe(false);
    });
  });
});
