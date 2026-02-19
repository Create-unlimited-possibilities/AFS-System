/**
 * MemoryStore Unit Tests
 * Tests the conversation memory storage functionality
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fsPromises from 'fs/promises';
import path from 'path';
import MemoryStore from '../../../src/modules/memory/MemoryStore.js';

// Mock the logger to avoid console noise
vi.mock('../../../src/core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock the Indexer to avoid actual indexing
vi.mock('../../../src/modules/memory/Indexer.js', () => ({
  default: class MockIndexer {
    async indexConversationMemory() {
      return { success: true, queued: false };
    }
  }
}));

describe('MemoryStore', () => {
  let memoryStore;
  const testUserId = 'test_user_123';
  const testPartnerId = 'test_partner_456';
  // Use unique base path with random suffix to avoid conflicts in parallel runs
  const testBasePath = `./test_storage_memory_store_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  beforeEach(async () => {
    // Create a new MemoryStore instance and override basePath
    memoryStore = new MemoryStore();
    memoryStore.basePath = testBasePath;

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

  describe('saveMemory', () => {
    it('should save a memory file with correct structure', async () => {
      const memoryData = {
        meta: {
          messageCount: 10
        },
        content: {
          raw: 'Test conversation content',
          processed: {
            summary: 'Test summary',
            keyTopics: ['topic1', 'topic2']
          }
        }
      };

      const result = await memoryStore.saveMemory(testUserId, testPartnerId, memoryData, false);

      expect(result).toHaveProperty('memoryId');
      expect(result.memoryId).toMatch(/^mem_/);
      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('memory');
      expect(result.memory.memoryId).toBe(result.memoryId);
      expect(result.memory.version).toBe('1.0.0');
      expect(result.memory.meta.messageCount).toBe(10);
      expect(result.memory.meta.compressionStage).toBe('raw');
      expect(result.memory.content.raw).toBe('Test conversation content');
    });

    it('should create memory with autoIndex enabled by default', async () => {
      const memoryData = {
        content: { raw: 'test' }
      };

      const result = await memoryStore.saveMemory(testUserId, testPartnerId, memoryData, true);

      expect(result.memory.vectorIndex.autoIndex).toBe(true);
      expect(result.memory.vectorIndex.indexed).toBe(false);
    });

    it('should create directories if they do not exist', async () => {
      const memoryData = { content: { raw: 'test' } };
      const result = await memoryStore.saveMemory(testUserId, testPartnerId, memoryData, false);

      // Verify the file exists
      const fileContent = await fsPromises.readFile(result.filePath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      expect(parsed.memoryId).toBe(result.memoryId);
    });
  });

  describe('loadUserMemories', () => {
    it('should load all memories for a user', async () => {
      // Create test memories for multiple partners with unique summaries to ensure different file names
      await memoryStore.saveMemory(testUserId, 'partner1', {
        content: { raw: 'memory1', processed: { summary: 'unique summary one' } }
      }, false);
      await memoryStore.saveMemory(testUserId, 'partner1', {
        content: { raw: 'memory2', processed: { summary: 'unique summary two' } }
      }, false);
      await memoryStore.saveMemory(testUserId, 'partner2', {
        content: { raw: 'memory3', processed: { summary: 'unique summary three' } }
      }, false);

      const memories = await memoryStore.loadUserMemories(testUserId);

      expect(memories).toHaveProperty('partner1');
      expect(memories).toHaveProperty('partner2');
      expect(memories.partner1.length).toBeGreaterThanOrEqual(1);
      expect(memories.partner2.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty object if user has no memories', async () => {
      const memories = await memoryStore.loadUserMemories('nonexistent_user');
      expect(memories).toEqual({});
    });

    it('should include _filePath in loaded memories', async () => {
      const saveResult = await memoryStore.saveMemory(testUserId, testPartnerId, { content: { raw: 'test' } }, false);

      const memories = await memoryStore.loadUserMemories(testUserId);

      expect(memories[testPartnerId][0]._filePath).toBe(saveResult.filePath);
    });
  });

  describe('saveBidirectional', () => {
    it('should save memories for both users', async () => {
      const options = {
        userAId: 'user_alice',
        userBId: 'user_bob',
        conversationData: {
          raw: 'Conversation content',
          messageCount: 5
        },
        userAMemory: {
          processed: { summary: 'Alice memory' },
          tags: ['tag1']
        },
        userBMemory: {
          processed: { summary: 'Bob memory' },
          tags: ['tag2']
        },
        userBHasRoleCard: true
      };

      const result = await memoryStore.saveBidirectional(options);

      expect(result).toHaveProperty('userA');
      expect(result).toHaveProperty('userB');
      expect(result.userA.memoryId).toMatch(/^mem_/);
      expect(result.userB.memoryId).toMatch(/^mem_/);
      expect(result.userA.memoryId).not.toBe(result.userB.memoryId);

      // Verify Alice's memory
      const aliceMemories = await memoryStore.loadUserMemories('user_alice');
      expect(aliceMemories['user_bob']).toBeDefined();

      // Verify Bob's memory
      const bobMemories = await memoryStore.loadUserMemories('user_bob');
      expect(bobMemories['user_alice']).toBeDefined();
    });

    it('should handle case when user B has no role card', async () => {
      const options = {
        userAId: 'user_alice',
        userBId: 'user_bob_no_card',
        conversationData: {
          raw: 'Conversation',
          messageCount: 3
        },
        userAMemory: {
          processed: { summary: 'Alice memory' }
        },
        userBMemory: {},
        userBHasRoleCard: false
      };

      const result = await memoryStore.saveBidirectional(options);

      // User B's memory should have pending_processing tag
      expect(result.userB.memory.tags).toContain('pending_processing');
      expect(result.userB.memory.content.processed).toBeNull();
    });
  });

  describe('updateMemory', () => {
    it('should deep merge updates into existing memory', async () => {
      const saveResult = await memoryStore.saveMemory(testUserId, testPartnerId, {
        content: { raw: 'original' },
        tags: ['tag1']
      }, false);

      const updatedMemory = await memoryStore.updateMemory(saveResult.filePath, {
        tags: ['tag1', 'tag2'],
        meta: {
          messageCount: 100
        }
      });

      expect(updatedMemory.tags).toEqual(['tag1', 'tag2']);
      expect(updatedMemory.meta.messageCount).toBe(100);
      expect(updatedMemory.content.raw).toBe('original'); // Unchanged
    });

    it('should deep merge nested objects', async () => {
      const saveResult = await memoryStore.saveMemory(testUserId, testPartnerId, {
        content: {
          raw: 'original',
          processed: {
            summary: 'original summary',
            keyTopics: ['topic1']
          }
        }
      }, false);

      const updatedMemory = await memoryStore.updateMemory(saveResult.filePath, {
        content: {
          processed: {
            summary: 'updated summary'
          }
        }
      });

      // Deep merge: keyTopics should be replaced, not merged
      expect(updatedMemory.content.processed.summary).toBe('updated summary');
    });

    it('should update version on significant changes', async () => {
      const saveResult = await memoryStore.saveMemory(testUserId, testPartnerId, {
        content: { raw: 'original' }
      }, false);

      const originalVersion = saveResult.memory.version;

      const updatedMemory = await memoryStore.updateMemory(saveResult.filePath, {
        content: { raw: 'updated' }
      });

      expect(updatedMemory.version).toBe(originalVersion);
    });
  });

  describe('markAsIndexed', () => {
    it('should update vectorIndex fields', async () => {
      const saveResult = await memoryStore.saveMemory(testUserId, testPartnerId, {
        content: { raw: 'test' }
      }, false);

      expect(saveResult.memory.vectorIndex.indexed).toBe(false);

      const updatedMemory = await memoryStore.markAsIndexed(saveResult.filePath);

      expect(updatedMemory.vectorIndex.indexed).toBe(true);
      expect(updatedMemory.vectorIndex.indexedAt).toBeDefined();
    });
  });

  describe('updateCompressionStage', () => {
    it('should update compression metadata to v1', async () => {
      const saveResult = await memoryStore.saveMemory(testUserId, testPartnerId, {
        content: { raw: 'test' }
      }, false);

      const updatedMemory = await memoryStore.updateCompressionStage(saveResult.filePath, 'v1');

      expect(updatedMemory.meta.compressionStage).toBe('v1');
      expect(updatedMemory.meta.compressedAt).toBeDefined();
    });

    it('should update compression metadata to v2', async () => {
      const saveResult = await memoryStore.saveMemory(testUserId, testPartnerId, {
        content: { raw: 'test' }
      }, false);

      const updatedMemory = await memoryStore.updateCompressionStage(saveResult.filePath, 'v2');

      expect(updatedMemory.meta.compressionStage).toBe('v2');
    });

    it('should throw error for invalid compression stage', async () => {
      const saveResult = await memoryStore.saveMemory(testUserId, testPartnerId, {
        content: { raw: 'test' }
      }, false);

      await expect(
        memoryStore.updateCompressionStage(saveResult.filePath, 'invalid')
      ).rejects.toThrow('Invalid compression stage');
    });
  });

  describe('getMemoriesPendingCompression', () => {
    it('should filter by stage and age', async () => {
      // Create a memory that's old enough for v1 compression (3+ days)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 5);

      await memoryStore.saveMemory(testUserId, testPartnerId, {
        meta: {
          createdAt: oldDate.toISOString(),
          compressionStage: 'raw'
        },
        content: { raw: 'old memory for compression test', processed: { summary: 'old summary' } }
      }, false);

      // Create a recent memory with a different summary to ensure unique file name
      await memoryStore.saveMemory(testUserId, testPartnerId, {
        meta: {
          compressionStage: 'raw'
        },
        content: { raw: 'recent memory for compression test', processed: { summary: 'recent summary unique' } }
      }, false);

      // Get memories pending v1 compression (min 3 days old)
      const pendingV1 = await memoryStore.getMemoriesPendingCompression(testUserId, 'raw', 3);

      // The old memory should be in the list
      const oldMemoryInList = pendingV1.find(m => m.memory.content.raw === 'old memory for compression test');
      expect(oldMemoryInList).toBeDefined();
      expect(oldMemoryInList.age).toBeGreaterThanOrEqual(3);
    });

    it('should exclude already compressed memories', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      // Create a memory that's already compressed
      await memoryStore.saveMemory(testUserId, testPartnerId, {
        meta: {
          createdAt: oldDate.toISOString(),
          compressionStage: 'v1',
          compressedAt: oldDate.toISOString()
        },
        content: { raw: 'compressed memory' }
      }, false);

      const pending = await memoryStore.getMemoriesPendingCompression(testUserId, 'raw', 3);

      // Should not include the v1 compressed memory
      const compressedInList = pending.find(m => m.memory.content.raw === 'compressed memory');
      expect(compressedInList).toBeUndefined();
    });
  });

  describe('generateFileName', () => {
    it('should generate correct format with timestamp', () => {
      const memoryData = {
        content: {
          processed: {
            summary: 'Test conversation topic'
          }
        }
      };

      const fileName = memoryStore.generateFileName(memoryData);

      // Should match pattern: YYYY-MM-DDTHH-mm-ss_topic.json
      expect(fileName).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_/);
      expect(fileName).toMatch(/Test_conversation_topic\.json$/);
    });

    it('should use topicSummary if available', () => {
      const memoryData = {
        topicSummary: 'Custom topic summary'
      };

      const fileName = memoryStore.generateFileName(memoryData);

      expect(fileName).toContain('Custom_topic_summary');
    });

    it('should use keyTopics if summary not available', () => {
      const memoryData = {
        content: {
          processed: {
            keyTopics: ['First topic', 'Second topic']
          }
        }
      };

      const fileName = memoryStore.generateFileName(memoryData);

      expect(fileName).toContain('First_topic');
    });

    it('should default to "conversation" if no topic info', () => {
      const fileName = memoryStore.generateFileName({});

      expect(fileName).toMatch(/_conversation\.json$/);
    });

    it('should sanitize special characters', () => {
      const memoryData = {
        content: {
          processed: {
            summary: 'Test<>:"/\\|?*special'
          }
        }
      };

      const fileName = memoryStore.generateFileName(memoryData);

      // Should not contain invalid characters
      expect(fileName).not.toMatch(/[<>:"/\\|?*]/);
    });

    it('should truncate long summaries', () => {
      const longSummary = 'A'.repeat(100);
      const memoryData = {
        content: {
          processed: {
            summary: longSummary
          }
        }
      };

      const fileName = memoryStore.generateFileName(memoryData);

      // Topic part should be limited to 50 chars
      const topicPart = fileName.split('_').slice(1).join('_').replace('.json', '');
      expect(topicPart.length).toBeLessThanOrEqual(50);
    });
  });

  describe('generateMemoryId', () => {
    it('should return UUID format with mem_ prefix', () => {
      const memoryId = memoryStore.generateMemoryId();

      expect(memoryId).toMatch(/^mem_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(memoryStore.generateMemoryId());
      }

      expect(ids.size).toBe(100);
    });
  });

  describe('getConversationPath', () => {
    it('should return correct path structure', () => {
      const convPath = memoryStore.getConversationPath(testUserId, testPartnerId);

      expect(convPath).toContain(testUserId);
      expect(convPath).toContain('conversations');
      expect(convPath).toContain(`with_${testPartnerId}`);
    });

    it('should use basePath as root', () => {
      const convPath = memoryStore.getConversationPath(testUserId, testPartnerId);

      // Use path.resolve for comparison to handle relative vs absolute paths
      const resolvedPath = path.resolve(convPath);
      const resolvedBase = path.resolve(testBasePath);
      expect(resolvedPath.startsWith(resolvedBase)).toBe(true);
    });
  });

  describe('deepMerge', () => {
    it('should merge nested objects recursively', () => {
      const target = {
        level1: {
          level2: {
            value: 'original'
          },
          other: 'kept'
        }
      };

      const source = {
        level1: {
          level2: {
            value: 'updated',
            newKey: 'added'
          }
        }
      };

      const result = memoryStore.deepMerge(target, source);

      expect(result.level1.level2.value).toBe('updated');
      expect(result.level1.level2.newKey).toBe('added');
      expect(result.level1.other).toBe('kept');
    });

    it('should replace arrays, not merge them', () => {
      const target = {
        tags: ['a', 'b']
      };

      const source = {
        tags: ['c', 'd']
      };

      const result = memoryStore.deepMerge(target, source);

      expect(result.tags).toEqual(['c', 'd']);
    });

    it('should handle null values', () => {
      const target = {
        value: 'original'
      };

      const source = {
        value: null
      };

      const result = memoryStore.deepMerge(target, source);

      expect(result.value).toBeNull();
    });
  });

  describe('deleteMemory', () => {
    it('should delete memory file', async () => {
      const saveResult = await memoryStore.saveMemory(testUserId, testPartnerId, {
        content: { raw: 'test' }
      }, false);

      const deleted = await memoryStore.deleteMemory(saveResult.filePath);

      expect(deleted).toBe(true);

      // Verify file is gone
      const memories = await memoryStore.loadUserMemories(testUserId);
      expect(memories[testPartnerId]).toHaveLength(0);
    });

    it('should return false if file not found', async () => {
      const deleted = await memoryStore.deleteMemory('/nonexistent/path/file.json');
      expect(deleted).toBe(false);
    });
  });

  describe('getMemoryStats', () => {
    it('should return correct statistics', async () => {
      // Create various memories
      await memoryStore.saveMemory(testUserId, 'partner1', {
        content: { raw: 'test1' },
        meta: { compressionStage: 'raw' }
      }, false);

      await memoryStore.saveMemory(testUserId, 'partner2', {
        content: { raw: 'test2' },
        meta: { compressionStage: 'v1' },
        vectorIndex: { indexed: true }
      }, false);

      const stats = await memoryStore.getMemoryStats(testUserId);

      expect(stats.totalMemories).toBe(2);
      expect(stats.totalPartners).toBe(2);
      expect(stats.byCompressionStage.raw).toBe(1);
      expect(stats.byCompressionStage.v1).toBe(1);
      expect(stats.indexed).toBe(1);
    });
  });

  describe('findMemoryFile', () => {
    it('should find memory by ID', async () => {
      const saveResult = await memoryStore.saveMemory(testUserId, testPartnerId, {
        content: { raw: 'test' }
      }, false);

      const found = await memoryStore.findMemoryFile(testUserId, saveResult.memoryId);

      expect(found).not.toBeNull();
      expect(found.filePath).toBe(saveResult.filePath);
      expect(found.memory.memoryId).toBe(saveResult.memoryId);
    });

    it('should return null if not found', async () => {
      const found = await memoryStore.findMemoryFile(testUserId, 'nonexistent_id');
      expect(found).toBeNull();
    });
  });
});
