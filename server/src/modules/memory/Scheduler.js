/**
 * Scheduler - Memory Processing Scheduler
 * Handles scheduled tasks for memory compression and cleanup
 * Runs daily at 3:00 AM to compress old memories
 *
 * @author AFS Team
 * @version 2.0.0
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import MemoryStore from './MemoryStore.js';
import Compressor from './Compressor.js';
import VectorIndexService from '../../core/storage/vector.js';
import DualStorage from '../../core/storage/dual.js';
import logger from '../../core/utils/logger.js';

const memoryLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'SCHEDULER' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'SCHEDULER' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'SCHEDULER' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'SCHEDULER' }),
};

class Scheduler {
  constructor() {
    this.memoryStore = new MemoryStore();
    this.compressor = new Compressor();
    this.vectorService = new VectorIndexService();
    this.dualStorage = new DualStorage();

    this.isRunning = false;
    this.lastRunTime = null;
    this.nextRunTime = null;
    this.timerId = null;
    this.dailyRunHour = 3; // Run at 3:00 AM

    memoryLogger.info('Scheduler initialized');
  }

  /**
   * Start the scheduler
   * Schedules daily run at 3:00 AM
   */
  start() {
    if (this.isRunning) {
      memoryLogger.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;

    // Calculate time until next 3:00 AM
    const now = new Date();
    const nextRun = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      this.dailyRunHour,
      0,
      0,
      0
    );

    // If it's already past 3:00 AM today, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const delayMs = nextRun.getTime() - now.getTime();
    this.nextRunTime = nextRun.toISOString();

    memoryLogger.info('Scheduler started', {
      nextRunTime: this.nextRunTime,
      delayMs,
      delayHours: Math.round(delayMs / (1000 * 60 * 60) * 10) / 10
    });

    // Schedule first run
    this.timerId = setTimeout(() => {
      this.runDailyTask();
      // Then schedule every 24 hours
      this.timerId = setInterval(() => {
        this.runDailyTask();
      }, 24 * 60 * 60 * 1000);
    }, delayMs);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
    this.nextRunTime = null;

    memoryLogger.info('Scheduler stopped');
  }

  /**
   * Main daily task - process all users' memories
   */
  async runDailyTask() {
    const startTime = Date.now();
    this.lastRunTime = new Date().toISOString();

    memoryLogger.info('Starting daily memory compression task', {
      time: this.lastRunTime
    });

    const results = {
      usersProcessed: 0,
      totalMemoriesCompressed: 0,
      v1Compressions: 0,
      v2Compressions: 0,
      errors: [],
      skipped: 0
    };

    try {
      // Get all users with memories
      const userIds = await this.getAllUsersWithMemories();

      memoryLogger.info(`Found ${userIds.length} users with memories to process`);

      // Process each user
      for (const userId of userIds) {
        try {
          const userResult = await this.processUserMemories(userId);

          results.usersProcessed++;
          results.totalMemoriesCompressed += userResult.compressed;
          results.v1Compressions += userResult.v1Count;
          results.v2Compressions += userResult.v2Count;
          results.skipped += userResult.skipped;

        } catch (error) {
          results.errors.push({
            userId,
            error: error.message
          });
          memoryLogger.error(`Failed to process user memories`, {
            userId,
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;

      memoryLogger.info('Daily memory compression task completed', {
        ...results,
        durationMs: duration,
        durationSec: Math.round(duration / 1000)
      });

      return results;

    } catch (error) {
      memoryLogger.error('Daily task failed', {
        error: error.message,
        stack: error.stack
      });

      results.errors.push({
        type: 'global',
        error: error.message
      });

      return results;
    }
  }

  /**
   * Get all user IDs that have memory files
   * @returns {Promise<string[]>} Array of user IDs
   */
  async getAllUsersWithMemories() {
    try {
      const conversationsPath = path.join(this.memoryStore.basePath);

      // Check if base path exists
      if (!fs.existsSync(conversationsPath)) {
        memoryLogger.debug('Memory base path does not exist');
        return [];
      }

      const entries = await fsPromises.readdir(conversationsPath, { withFileTypes: true });
      const userIds = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Check if user has conversations folder
          const userConversationsPath = path.join(conversationsPath, entry.name, 'conversations');
          if (fs.existsSync(userConversationsPath)) {
            userIds.push(entry.name);
          }
        }
      }

      return userIds;

    } catch (error) {
      memoryLogger.error('Failed to get users with memories', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Process memories for a specific user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Processing results
   */
  async processUserMemories(userId) {
    memoryLogger.info(`Processing memories for user ${userId}`);

    const result = {
      compressed: 0,
      v1Count: 0,
      v2Count: 0,
      skipped: 0,
      errors: []
    };

    try {
      // Load user's role card for personality-driven compression
      const roleCard = await this.dualStorage.loadRoleCardV2(userId);

      // Load all memories for this user
      const allMemories = await this.memoryStore.loadUserMemories(userId);

      // Process each conversation partner's memories
      for (const [partnerId, memories] of Object.entries(allMemories)) {
        for (const memory of memories) {
          try {
            // Check if memory needs compression
            const compressionInfo = this.compressor.determineCompressionStage(memory);

            if (!compressionInfo || !compressionInfo.needsCompression) {
              continue;
            }

            const filePath = memory._filePath;
            if (!filePath) {
              memoryLogger.warn('Memory has no file path, skipping', {
                memoryId: memory.memoryId
              });
              result.skipped++;
              continue;
            }

            memoryLogger.debug(`Compressing memory`, {
              memoryId: memory.memoryId,
              targetStage: compressionInfo.targetStage,
              reason: compressionInfo.reason
            });

            // Perform compression
            const compressedData = await this.compressor.compress(
              memory,
              compressionInfo.targetStage,
              roleCard
            );

            // Check if compression was skipped
            if (compressedData.skipped) {
              result.skipped++;
              continue;
            }

            // Update memory file with compressed data
            const updates = this.buildMemoryUpdates(compressedData, compressionInfo.targetStage);
            await this.memoryStore.updateMemory(filePath, updates);

            // Update compression stage
            await this.memoryStore.updateCompressionStage(filePath, compressionInfo.targetStage);

            // Re-index in vector store
            try {
              await this.reindexMemory(userId, {
                ...memory,
                compression: updates.compression,
                meta: {
                  ...memory.meta,
                  compressionStage: compressionInfo.targetStage
                }
              });
            } catch (reindexError) {
              memoryLogger.warn('Failed to re-index memory after compression', {
                memoryId: memory.memoryId,
                error: reindexError.message
              });
            }

            result.compressed++;
            if (compressionInfo.targetStage === 'v1') {
              result.v1Count++;
            } else if (compressionInfo.targetStage === 'v2') {
              result.v2Count++;
            }

            memoryLogger.info(`Memory compressed successfully`, {
              memoryId: memory.memoryId,
              stage: compressionInfo.targetStage,
              partnerId
            });

          } catch (error) {
            result.errors.push({
              memoryId: memory.memoryId,
              error: error.message
            });
            memoryLogger.error('Failed to compress memory', {
              userId,
              memoryId: memory.memoryId,
              error: error.message
            });
          }
        }
      }

      memoryLogger.info(`Completed processing for user ${userId}`, {
        compressed: result.compressed,
        skipped: result.skipped,
        errors: result.errors.length
      });

      return result;

    } catch (error) {
      memoryLogger.error(`Failed to process user memories`, {
        userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Build memory updates based on compression stage
   * @param {Object} compressedData - Compressed data from compressor
   * @param {string} stage - Compression stage (v1 or v2)
   * @returns {Object} Updates object
   */
  buildMemoryUpdates(compressedData, stage) {
    if (stage === 'v1') {
      return {
        compression: {
          v1: {
            compressedContent: compressedData.compressedContent,
            compressionRatio: compressedData.compressionRatio,
            keyPoints: compressedData.keyPoints,
            emotionalHighlights: compressedData.emotionalHighlights,
            personalityAdjustment: compressedData.personalityAdjustment,
            compressedAt: compressedData.compressedAt
          },
          currentStage: 'v1'
        }
      };
    }

    if (stage === 'v2') {
      return {
        compression: {
          v2: {
            coreMemory: compressedData.coreMemory,
            coreMemoryPoints: compressedData.coreMemoryPoints,
            memoryTraces: compressedData.memoryTraces,
            forgotten: compressedData.forgotten,
            emotionalResidue: compressedData.emotionalResidue,
            personalityNotes: compressedData.personalityNotes,
            compressedAt: compressedData.compressedAt
          },
          currentStage: 'v2'
        }
      };
    }

    return {};
  }

  /**
   * Re-index a memory in the vector store after compression
   * @param {string} userId - User ID
   * @param {Object} memory - Updated memory object
   */
  async reindexMemory(userId, memory) {
    try {
      // Initialize vector service if needed
      await this.vectorService.initialize();

      // Build searchable text from compressed content
      let searchText = '';

      if (memory.compression?.v2?.coreMemory) {
        searchText = memory.compression.v2.coreMemory;
      } else if (memory.compression?.v1?.compressedContent) {
        searchText = memory.compression.v1.compressedContent;
      } else if (memory.content?.processed?.summary) {
        searchText = memory.content.processed.summary;
      }

      if (!searchText) {
        memoryLogger.debug('No searchable text for re-indexing', {
          memoryId: memory.memoryId
        });
        return;
      }

      // Update in vector store
      await this.vectorService.updateMemory(userId, memory.memoryId, {
        ...memory,
        searchableText: searchText
      });

      memoryLogger.debug('Memory re-indexed after compression', {
        memoryId: memory.memoryId,
        userId
      });

    } catch (error) {
      memoryLogger.error('Failed to re-index memory', {
        userId,
        memoryId: memory.memoryId,
        error: error.message
      });
      // Don't throw - re-indexing failure shouldn't stop compression
    }
  }

  /**
   * Manually trigger compression for a specific user (for testing)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Processing results
   */
  async triggerNow(userId) {
    memoryLogger.info('Manual compression trigger', { userId });

    try {
      const result = await this.processUserMemories(userId);
      return result;
    } catch (error) {
      memoryLogger.error('Manual trigger failed', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get scheduler status
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      nextRunTime: this.nextRunTime,
      dailyRunHour: this.dailyRunHour
    };
  }

  /**
   * Health check for the scheduler
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const compressorHealth = await this.compressor.healthCheck();

      return {
        status: this.isRunning && compressorHealth ? 'healthy' : 'degraded',
        isRunning: this.isRunning,
        compressorHealthy: compressorHealth,
        lastRunTime: this.lastRunTime,
        nextRunTime: this.nextRunTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

// Singleton instance
let schedulerInstance = null;

/**
 * Get or create scheduler instance
 * @returns {Scheduler}
 */
export function getScheduler() {
  if (!schedulerInstance) {
    schedulerInstance = new Scheduler();
  }
  return schedulerInstance;
}

export default Scheduler;
