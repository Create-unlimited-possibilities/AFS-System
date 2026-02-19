/**
 * MemoryStore - Conversation Memory Storage
 * Handles saving and loading conversation memories with personality filtering
 *
 * @author AFS Team
 * @version 1.0.0
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import logger from '../../core/utils/logger.js';

// Create module-specific logger
const memoryLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'MEMORY' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'MEMORY' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'MEMORY' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'MEMORY' }),
};

class MemoryStore {
  constructor() {
    // Detect Docker environment
    const isDocker = fs.existsSync('/.dockerenv') ||
                     process.env.DOCKER_CONTAINER === 'true' ||
                     process.env.NODE_ENV === 'docker';

    // Determine base path based on environment
    if (isDocker) {
      this.basePath = '/app/storage/userdata';
    } else {
      // Check if we're already in server directory or project root
      const cwd = process.cwd();
      if (cwd.endsWith('server') || cwd.includes('server/') || cwd.includes('server\\')) {
        // Already in server directory
        this.basePath = path.join(cwd, 'storage', 'userdata');
      } else {
        // In project root, need to add server
        this.basePath = path.join(cwd, 'server', 'storage', 'userdata');
      }
    }

    this.version = '1.0.0';
    memoryLogger.info(`MemoryStore initialized with basePath: ${this.basePath}`);
  }

  /**
   * Get the conversation path for a user with another user
   * @param {string} userId - The user whose memory we're storing
   * @param {string} withUserId - The conversation partner
   * @returns {string} The full path to the conversation folder
   */
  getConversationPath(userId, withUserId) {
    return path.join(this.basePath, String(userId), 'conversations', `with_${withUserId}`);
  }

  /**
   * Generate a unique memory ID
   * @returns {string} Memory ID in format mem_{uuid}
   */
  generateMemoryId() {
    return `mem_${crypto.randomUUID()}`;
  }

  /**
   * Generate a file name from memory data
   * Format: {ISO-timestamp}_{topicSummary}.json
   * @param {Object} memoryData - The memory data containing topic info
   * @returns {string} Sanitized file name
   */
  generateFileName(memoryData) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');

    // Get topic summary from memory data
    let topicSummary = 'conversation';
    if (memoryData?.content?.processed?.summary) {
      topicSummary = memoryData.content.processed.summary;
    } else if (memoryData?.topicSummary) {
      topicSummary = memoryData.topicSummary;
    } else if (memoryData?.content?.processed?.keyTopics?.length > 0) {
      topicSummary = memoryData.content.processed.keyTopics[0];
    }

    // Sanitize the topic summary for file name
    const sanitizedSummary = this.sanitizeFileName(topicSummary)
      .substring(0, 50) // Limit length
      .trim() || 'conversation';

    return `${timestamp}_${sanitizedSummary}.json`;
  }

  /**
   * Sanitize a string for use as a file name
   * @param {string} str - Input string
   * @returns {string} Sanitized string safe for file names
   */
  sanitizeFileName(str) {
    if (!str || typeof str !== 'string') return 'conversation';

    return str
      // Replace invalid file name characters
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      // Replace spaces and underscores with underscores
      .replace(/[\s]+/g, '_')
      // Remove multiple consecutive underscores
      .replace(/_+/g, '_')
      // Remove leading/trailing underscores
      .replace(/^_|_$/g, '');
  }

  /**
   * Save a conversation memory to file
   * @param {string} userId - The user whose memory we're storing
   * @param {string} withUserId - The conversation partner
   * @param {Object} memoryData - The memory data to save
   * @param {boolean} autoIndex - Whether to mark for auto-indexing (default: true)
   * @returns {Promise<{memoryId: string, filePath: string, memory: Object}>}
   */
  async saveMemory(userId, withUserId, memoryData, autoIndex = true) {
    try {
      memoryLogger.info(`Saving memory for user ${userId} with ${withUserId}`);

      // Create conversation path
      const conversationPath = this.getConversationPath(userId, withUserId);
      await fsPromises.mkdir(conversationPath, { recursive: true });

      // Generate memory ID and file name
      const memoryId = memoryData.memoryId || this.generateMemoryId();
      const fileName = this.generateFileName(memoryData);
      const filePath = path.join(conversationPath, fileName);

      // Build complete memory object
      const memory = {
        memoryId,
        version: this.version,
        meta: {
          createdAt: memoryData.meta?.createdAt || new Date().toISOString(),
          participants: memoryData.meta?.participants || [userId, withUserId],
          participantRoles: memoryData.meta?.participantRoles || {},
          messageCount: memoryData.meta?.messageCount || 0,
          compressionStage: memoryData.meta?.compressionStage || 'raw',
          compressedAt: memoryData.meta?.compressedAt || null,
        },
        content: {
          raw: memoryData.content?.raw || '',
          processed: memoryData.content?.processed || null,
        },
        pendingTopics: memoryData.pendingTopics || { hasUnfinished: false, topics: [] },
        personalityFiltered: memoryData.personalityFiltered || {
          retentionScore: 1.0,
          likelyToRecall: [],
          likelyToForget: [],
        },
        vectorIndex: {
          indexed: memoryData.vectorIndex?.indexed ?? false,
          indexedAt: memoryData.vectorIndex?.indexedAt || null,
          autoIndex,
        },
        tags: memoryData.tags || [],
      };

      // Write to JSON file
      await fsPromises.writeFile(filePath, JSON.stringify(memory, null, 2), 'utf-8');

      memoryLogger.info(`Memory saved successfully: ${memoryId}`, { filePath });

      return { memoryId, filePath, memory };
    } catch (error) {
      memoryLogger.error(`Failed to save memory: ${error.message}`, { error: error.stack });
      throw error;
    }
  }

  /**
   * Load all conversation memories for a user
   * @param {string} userId - The user ID
   * @returns {Promise<Object>} Memories object keyed by partnerId
   */
  async loadUserMemories(userId) {
    try {
      memoryLogger.info(`Loading memories for user ${userId}`);

      const userConversationsPath = path.join(this.basePath, String(userId), 'conversations');

      // Check if conversations directory exists
      if (!fs.existsSync(userConversationsPath)) {
        memoryLogger.info(`No conversations directory found for user ${userId}`);
        return {};
      }

      const memories = {};
      const entries = await fsPromises.readdir(userConversationsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('with_')) {
          const partnerId = entry.name.replace('with_', '');
          const folderPath = path.join(userConversationsPath, entry.name);

          memories[partnerId] = [];
          await this.loadMemoriesFromFolder(folderPath, memories[partnerId]);
        }
      }

      const totalMemories = Object.values(memories).reduce((sum, arr) => sum + arr.length, 0);
      memoryLogger.info(`Loaded ${totalMemories} memories for user ${userId}`);

      return memories;
    } catch (error) {
      memoryLogger.error(`Failed to load user memories: ${error.message}`, { error: error.stack });
      throw error;
    }
  }

  /**
   * Recursively load JSON memory files from a folder
   * @param {string} folderPath - Path to the folder
   * @param {Array} targetArray - Array to push loaded memories into
   */
  async loadMemoriesFromFolder(folderPath, targetArray) {
    try {
      const entries = await fsPromises.readdir(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively load from subdirectories
          await this.loadMemoriesFromFolder(fullPath, targetArray);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          try {
            const content = await fsPromises.readFile(fullPath, 'utf-8');
            const memory = JSON.parse(content);

            // Add file path for future updates
            memory._filePath = fullPath;
            targetArray.push(memory);
          } catch (parseError) {
            memoryLogger.warn(`Failed to parse memory file: ${fullPath}`, { error: parseError.message });
          }
        }
      }
    } catch (error) {
      memoryLogger.error(`Failed to load memories from folder: ${error.message}`, { folderPath });
      throw error;
    }
  }

  /**
   * Save memory bidirectionally for both conversation participants
   * @param {Object} options - Bidirectional save options
   * @param {string} options.userAId - First user ID
   * @param {string} options.userBId - Second user ID
   * @param {Object} options.conversationData - Raw conversation data
   * @param {Object} options.userAMemory - Processed memory for user A (with personality filtering)
   * @param {Object} options.userBMemory - Processed memory for user B
   * @param {boolean} options.userBHasRoleCard - Whether user B has a role card
   * @returns {Promise<{userA: Object, userB: Object}>}
   */
  async saveBidirectional(options) {
    const { userAId, userBId, conversationData, userAMemory, userBMemory, userBHasRoleCard = false } = options;

    try {
      memoryLogger.info(`Saving bidirectional memory: ${userAId} <-> ${userBId}`);

      // Prepare memory data for User A (with personality-filtered memory)
      const memoryDataA = {
        memoryId: this.generateMemoryId(),
        meta: {
          participants: [userAId, userBId],
          participantRoles: {
            [userAId]: 'roleCard',
            [userBId]: userBHasRoleCard ? 'roleCard' : 'unknown',
          },
          messageCount: conversationData.messageCount || 0,
          compressionStage: 'raw',
        },
        content: {
          raw: conversationData.raw || '',
          processed: userAMemory?.processed || null,
        },
        pendingTopics: userAMemory?.pendingTopics || { hasUnfinished: false, topics: [] },
        personalityFiltered: userAMemory?.personalityFiltered || {
          retentionScore: 1.0,
          likelyToRecall: [],
          likelyToForget: [],
        },
        tags: userAMemory?.tags || [],
      };

      // Prepare memory data for User B
      const memoryDataB = {
        memoryId: this.generateMemoryId(), // Different ID for each user's copy
        meta: {
          participants: [userBId, userAId],
          participantRoles: {
            [userBId]: 'roleCard',
            [userAId]: 'roleCard', // User A always has role card in this context
          },
          messageCount: conversationData.messageCount || 0,
          compressionStage: 'raw',
        },
        content: {
          raw: conversationData.raw || '',
          processed: userBHasRoleCard ? userBMemory?.processed : null,
        },
        pendingTopics: userBMemory?.pendingTopics || { hasUnfinished: false, topics: [] },
        personalityFiltered: userBHasRoleCard ? userBMemory?.personalityFiltered : {
          retentionScore: 1.0,
          likelyToRecall: [],
          likelyToForget: [],
        },
        tags: userBHasRoleCard ? (userBMemory?.tags || []) : ['pending_processing'],
      };

      // Save both memories in parallel
      const [resultA, resultB] = await Promise.all([
        this.saveMemory(userAId, userBId, memoryDataA),
        this.saveMemory(userBId, userAId, memoryDataB),
      ]);

      memoryLogger.info(`Bidirectional memory saved successfully`, {
        userAMemoryId: resultA.memoryId,
        userBMemoryId: resultB.memoryId,
      });

      return {
        userA: resultA,
        userB: resultB,
      };
    } catch (error) {
      memoryLogger.error(`Failed to save bidirectional memory: ${error.message}`, { error: error.stack });
      throw error;
    }
  }

  /**
   * Update an existing memory file
   * @param {string} filePath - Path to the memory file
   * @param {Object} updates - Updates to merge into the memory
   * @returns {Promise<Object>} Updated memory object
   */
  async updateMemory(filePath, updates) {
    try {
      memoryLogger.debug(`Updating memory at ${filePath}`);

      // Read existing memory
      const content = await fsPromises.readFile(filePath, 'utf-8');
      const memory = JSON.parse(content);

      // Deep merge updates
      const updatedMemory = this.deepMerge(memory, updates);

      // Update version if changed significantly
      if (updates.meta || updates.content) {
        updatedMemory.version = this.version;
      }

      // Write back to file
      await fsPromises.writeFile(filePath, JSON.stringify(updatedMemory, null, 2), 'utf-8');

      memoryLogger.debug(`Memory updated successfully: ${updatedMemory.memoryId}`);

      return updatedMemory;
    } catch (error) {
      memoryLogger.error(`Failed to update memory: ${error.message}`, { filePath, error: error.stack });
      throw error;
    }
  }

  /**
   * Mark a memory as indexed in the vector store
   * @param {string} filePath - Path to the memory file
   * @returns {Promise<Object>} Updated memory object
   */
  async markAsIndexed(filePath) {
    return this.updateMemory(filePath, {
      vectorIndex: {
        indexed: true,
        indexedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Update the compression stage of a memory
   * @param {string} filePath - Path to the memory file
   * @param {string} stage - New compression stage (raw, v1, v2)
   * @returns {Promise<Object>} Updated memory object
   */
  async updateCompressionStage(filePath, stage) {
    const validStages = ['raw', 'v1', 'v2'];

    if (!validStages.includes(stage)) {
      throw new Error(`Invalid compression stage: ${stage}. Must be one of: ${validStages.join(', ')}`);
    }

    return this.updateMemory(filePath, {
      meta: {
        compressionStage: stage,
        compressedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Get memories pending compression for a user
   * @param {string} userId - The user ID
   * @param {string} stage - Current compression stage to filter by
   * @param {number} minDaysOld - Minimum age in days for compression eligibility
   * @returns {Promise<Array>} Array of memories pending compression
   */
  async getMemoriesPendingCompression(userId, stage, minDaysOld = 7) {
    try {
      memoryLogger.debug(`Finding memories pending compression for user ${userId}`, { stage, minDaysOld });

      const allMemories = await this.loadUserMemories(userId);
      const pendingMemories = [];
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - minDaysOld);

      for (const [partnerId, memories] of Object.entries(allMemories)) {
        for (const memory of memories) {
          // Check compression stage
          if (memory.meta?.compressionStage !== stage) continue;

          // Check age
          const createdAt = new Date(memory.meta?.createdAt);
          if (createdAt > cutoffDate) continue;

          // Check if already compressed
          if (memory.meta?.compressedAt) continue;

          pendingMemories.push({
            partnerId,
            memory,
            age: Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)),
          });
        }
      }

      memoryLogger.info(`Found ${pendingMemories.length} memories pending compression`, {
        userId,
        stage,
        minDaysOld,
      });

      return pendingMemories;
    } catch (error) {
      memoryLogger.error(`Failed to get memories pending compression: ${error.message}`, { error: error.stack });
      throw error;
    }
  }

  /**
   * Get memories that need vector indexing
   * @param {string} userId - The user ID
   * @returns {Promise<Array>} Array of memories needing indexing
   */
  async getMemoriesNeedingIndex(userId) {
    try {
      const allMemories = await this.loadUserMemories(userId);
      const needsIndex = [];

      for (const [partnerId, memories] of Object.entries(allMemories)) {
        for (const memory of memories) {
          if (memory.vectorIndex?.autoIndex && !memory.vectorIndex?.indexed) {
            needsIndex.push({
              partnerId,
              memory,
            });
          }
        }
      }

      memoryLogger.debug(`Found ${needsIndex.length} memories needing index for user ${userId}`);

      return needsIndex;
    } catch (error) {
      memoryLogger.error(`Failed to get memories needing index: ${error.message}`, { error: error.stack });
      throw error;
    }
  }

  /**
   * Delete a memory file
   * @param {string} filePath - Path to the memory file
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteMemory(filePath) {
    try {
      memoryLogger.info(`Deleting memory at ${filePath}`);

      await fsPromises.unlink(filePath);

      memoryLogger.info(`Memory deleted successfully`);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        memoryLogger.warn(`Memory file not found: ${filePath}`);
        return false;
      }
      memoryLogger.error(`Failed to delete memory: ${error.message}`, { error: error.stack });
      throw error;
    }
  }

  /**
   * Get memory statistics for a user
   * @param {string} userId - The user ID
   * @returns {Promise<Object>} Memory statistics
   */
  async getMemoryStats(userId) {
    try {
      const memories = await this.loadUserMemories(userId);

      const stats = {
        totalMemories: 0,
        totalPartners: Object.keys(memories).length,
        byCompressionStage: { raw: 0, v1: 0, v2: 0 },
        indexed: 0,
        pendingIndex: 0,
        oldestMemory: null,
        newestMemory: null,
        totalSizeBytes: 0,
      };

      for (const [partnerId, partnerMemories] of Object.entries(memories)) {
        for (const memory of partnerMemories) {
          stats.totalMemories++;

          // Count by compression stage
          const stage = memory.meta?.compressionStage || 'raw';
          if (stats.byCompressionStage[stage] !== undefined) {
            stats.byCompressionStage[stage]++;
          }

          // Count indexed
          if (memory.vectorIndex?.indexed) {
            stats.indexed++;
          } else if (memory.vectorIndex?.autoIndex) {
            stats.pendingIndex++;
          }

          // Track oldest/newest
          const createdAt = new Date(memory.meta?.createdAt);
          if (!stats.oldestMemory || createdAt < new Date(stats.oldestMemory)) {
            stats.oldestMemory = memory.meta?.createdAt;
          }
          if (!stats.newestMemory || createdAt > new Date(stats.newestMemory)) {
            stats.newestMemory = memory.meta?.createdAt;
          }

          // Estimate size
          stats.totalSizeBytes += JSON.stringify(memory).length;
        }
      }

      return stats;
    } catch (error) {
      memoryLogger.error(`Failed to get memory stats: ${error.message}`, { error: error.stack });
      throw error;
    }
  }

  /**
   * Deep merge two objects
   * Arrays are replaced, not merged
   * @param {Object} target - Target object
   * @param {Object} source - Source object with updates
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key of Object.keys(source)) {
      // If source value is null, use null
      if (source[key] === null) {
        result[key] = null;
      }
      // If both are plain objects (not arrays), merge recursively
      else if (
        source[key] instanceof Object &&
        !Array.isArray(source[key]) &&
        key in target &&
        target[key] instanceof Object &&
        !Array.isArray(target[key])
      ) {
        result[key] = this.deepMerge(target[key], source[key]);
      }
      // For arrays, primitives, or missing keys - replace entirely
      else {
        result[key] = source[key];
      }
    }

    return result;
  }
}

export default MemoryStore;
