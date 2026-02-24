/**
 * Scheduler - Memory Processing Scheduler
 * Handles scheduled tasks for memory compression and cleanup
 * Runs daily at 3:00 AM to compress old memories
 * Runs every 5 minutes to check for timed-out sessions
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
import ChatSession from '../chat/model.js';
import User from '../user/model.js';
import ConversationState from '../chat/state/ConversationState.js';
import MemoryExtractor from './MemoryExtractor.js';
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
    this.memoryExtractor = new MemoryExtractor();

    // Daily compression task settings
    this.isRunning = false;
    this.lastRunTime = null;
    this.nextRunTime = null;
    this.timerId = null;
    this.dailyRunHour = 3; // Run at 3:00 AM

    // Timeout detection settings
    this.timeoutCheckIntervalMs = 5 * 60 * 1000; // 5 minutes
    this.timeoutThresholdMs = (parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 30) * 60 * 1000; // Default 30 minutes
    this.timeoutTimerId = null;
    this.isTimeoutCheckerRunning = false;
    this.lastTimeoutCheckTime = null;

    memoryLogger.info('Scheduler initialized', {
      timeoutThresholdMinutes: this.timeoutThresholdMs / 60000
    });
  }

  /**
   * Start the scheduler
   * Schedules daily run at 3:00 AM
   * Also starts the timeout detection checker
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

    // Start timeout detection checker
    this.startTimeoutChecker();
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

    // Stop timeout checker
    this.stopTimeoutChecker();

    this.isRunning = false;
    this.nextRunTime = null;

    memoryLogger.info('Scheduler stopped');
  }

  // ==================== TIMEOUT DETECTION SYSTEM ====================

  /**
   * Start the session timeout checker
   * Runs every 5 minutes to detect inactive sessions
   */
  startTimeoutChecker() {
    if (this.isTimeoutCheckerRunning) {
      memoryLogger.warn('Timeout checker is already running');
      return;
    }

    this.isTimeoutCheckerRunning = true;

    memoryLogger.info('Session timeout checker started', {
      checkIntervalMinutes: this.timeoutCheckIntervalMs / 60000,
      timeoutThresholdMinutes: this.timeoutThresholdMs / 60000
    });

    // Run first check immediately
    this.checkSessionTimeouts();

    // Then schedule periodic checks
    this.timeoutTimerId = setInterval(() => {
      this.checkSessionTimeouts();
    }, this.timeoutCheckIntervalMs);
  }

  /**
   * Stop the session timeout checker
   */
  stopTimeoutChecker() {
    if (this.timeoutTimerId) {
      clearInterval(this.timeoutTimerId);
      this.timeoutTimerId = null;
    }
    this.isTimeoutCheckerRunning = false;

    memoryLogger.info('Session timeout checker stopped');
  }

  /**
   * Check for timed-out sessions and process them
   * @returns {Promise<Object>} Check results
   */
  async checkSessionTimeouts() {
    const checkStartTime = Date.now();
    this.lastTimeoutCheckTime = new Date().toISOString();

    memoryLogger.debug('Checking for timed-out sessions', {
      time: this.lastTimeoutCheckTime
    });

    const results = {
      checked: 0,
      timedOut: 0,
      processed: 0,
      errors: []
    };

    try {
      // Calculate timeout threshold
      const timeoutThreshold = new Date(Date.now() - this.timeoutThresholdMs);

      // Find active sessions that have timed out
      const timedOutSessions = await ChatSession.find({
        isActive: true,
        lastMessageAt: { $lt: timeoutThreshold }
      });

      results.checked = timedOutSessions.length;

      if (timedOutSessions.length === 0) {
        memoryLogger.debug('No timed-out sessions found');
        return results;
      }

      memoryLogger.info(`Found ${timedOutSessions.length} timed-out session(s)`, {
        threshold: timeoutThreshold.toISOString()
      });

      // Process each timed-out session
      for (const session of timedOutSessions) {
        results.timedOut++;

        try {
          const processed = await this.processTimedOutSession(session);
          if (processed) {
            results.processed++;
          }
        } catch (error) {
          results.errors.push({
            sessionId: session.sessionId,
            error: error.message
          });
          memoryLogger.error('Failed to process timed-out session', {
            sessionId: session.sessionId,
            error: error.message
          });
          // Continue processing other sessions - don't crash the checker
        }
      }

      const duration = Date.now() - checkStartTime;

      memoryLogger.info('Timeout check completed', {
        ...results,
        durationMs: duration
      });

      return results;

    } catch (error) {
      memoryLogger.error('Timeout check failed', {
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
   * Process a single timed-out session
   * Saves memory and starts a new cycle
   * @param {Object} session - ChatSession document
   * @returns {Promise<boolean>} Success status
   */
  async processTimedOutSession(session) {
    const sessionId = session.sessionId;

    memoryLogger.info('Processing timed-out session', {
      sessionId,
      targetUserId: session.targetUserId?.toString(),
      interlocutorUserId: session.interlocutorUserId?.toString(),
      lastMessageAt: session.lastMessageAt?.toISOString()
    });

    try {
      // Get current cycle messages
      const currentCycle = session.cycles?.find(
        c => c.cycleId === session.currentCycleId
      );
      const messages = currentCycle?.messages || [];

      // Skip if no messages to save
      if (messages.length < 2) {
        memoryLogger.debug('Session has insufficient messages, skipping memory save', {
          sessionId,
          messageCount: messages.length
        });

        // Still start a new cycle to reset context
        await this.startNewCycleForSession(session);
        return true;
      }

      // Load user data
      const targetUser = await User.findById(session.targetUserId);
      const interlocutorUser = await User.findById(session.interlocutorUserId);

      if (!targetUser || !interlocutorUser) {
        memoryLogger.warn('Users not found for session, skipping', {
          sessionId,
          targetUserId: session.targetUserId?.toString(),
          interlocutorUserId: session.interlocutorUserId?.toString()
        });
        return false;
      }

      // Load role card
      const roleCardV2 = await this.dualStorage.loadRoleCardV2(
        session.targetUserId.toString()
      );

      // Build minimal conversation state for memory extraction
      const state = new ConversationState({
        userId: session.targetUserId.toString(),
        userName: targetUser.name,
        systemPrompt: '', // Not needed for memory extraction
        interlocutor: {
          id: session.interlocutorUserId.toString(),
          name: interlocutorUser.name,
          relationType: session.relation || 'stranger',
          specificId: session.interlocutorUserId.toString()
        },
        messages: messages,
        metadata: {
          sessionId,
          currentCycleId: session.currentCycleId,
          timeoutDetected: true
        }
      });

      // Save conversation memory
      await this.saveConversationMemoryForSession(session, state, roleCardV2);

      // Start new cycle
      await this.startNewCycleForSession(session);

      memoryLogger.info('Timed-out session processed successfully', {
        sessionId,
        messageCount: messages.length
      });

      return true;

    } catch (error) {
      memoryLogger.error('Error processing timed-out session', {
        sessionId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Save conversation memory for a session
   * @param {Object} session - ChatSession document
   * @param {Object} state - ConversationState object
   * @param {Object} roleCardV2 - Role card data
   */
  async saveConversationMemoryForSession(session, state, roleCardV2) {
    try {
      const messages = state.messages || [];
      const targetUserId = state.userId;
      const interlocutorId = state.interlocutor?.id;

      if (!targetUserId || !interlocutorId) {
        memoryLogger.warn('Missing user IDs, skipping memory save', {
          sessionId: session.sessionId
        });
        return;
      }

      memoryLogger.debug('Saving conversation memory', {
        sessionId: session.sessionId,
        targetUserId,
        interlocutorId,
        messageCount: messages.length
      });

      // Format messages
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        isOwner: msg.role === 'assistant'
      }));

      // Extract memory
      let extractedMemory = null;
      if (roleCardV2) {
        try {
          extractedMemory = await this.memoryExtractor.extract({
            roleCard: roleCardV2,
            roleCardOwnerName: state.userName || 'User',
            interlocutorName: state.interlocutor?.name || 'Interlocutor',
            relationType: state.interlocutor?.relationType || 'stranger',
            messages: formattedMessages
          });
          memoryLogger.debug('Memory extracted for timed-out session', {
            sessionId: session.sessionId,
            summaryLength: extractedMemory.summary?.length || 0
          });
        } catch (extractError) {
          memoryLogger.warn('Memory extraction failed for timed-out session', {
            sessionId: session.sessionId,
            error: extractError.message
          });
        }
      }

      // Save memory
      await this.memoryStore.saveBidirectional({
        userAId: targetUserId,
        userBId: interlocutorId,
        conversationData: {
          raw: JSON.stringify(formattedMessages),
          messageCount: messages.length
        },
        userAMemory: extractedMemory ? {
          processed: {
            summary: extractedMemory.summary,
            keyTopics: extractedMemory.keyTopics,
            facts: extractedMemory.facts
          },
          tags: extractedMemory.tags
        } : null
      });

      memoryLogger.info('Conversation memory saved for timed-out session', {
        sessionId: session.sessionId
      });

    } catch (error) {
      memoryLogger.error('Failed to save conversation memory', {
        sessionId: session.sessionId,
        error: error.message
      });
      // Don't throw - memory save failure shouldn't stop new cycle creation
    }
  }

  /**
   * Start a new cycle for a session
   * Handles both legacy sessions (no cycles) and modern sessions
   * @param {Object} session - ChatSession document
   * @returns {Promise<boolean>} Success status
   */
  async startNewCycleForSession(session) {
    try {
      const sessionId = session.sessionId;
      const oldCycleId = session.currentCycleId;
      const hasCycles = session.cycles && Array.isArray(session.cycles) && session.cycles.length > 0;

      // Generate new cycle ID
      const newCycleId = `cycle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // End current cycle if it exists (handle legacy sessions without cycles)
      if (oldCycleId && hasCycles) {
        // Find and end the current cycle using positional operator
        const endResult = await ChatSession.findOneAndUpdate(
          { sessionId, 'cycles.cycleId': oldCycleId },
          { $set: { 'cycles.$.endedAt': new Date() } }
        );

        if (!endResult) {
          memoryLogger.warn('Could not find cycle to end, continuing with new cycle creation', {
            sessionId,
            oldCycleId
          });
        }
      } else {
        memoryLogger.debug('Session has no current cycle to end (legacy or new session)', {
          sessionId,
          hasCycles,
          oldCycleId
        });
      }

      // Create new cycle
      const newCycle = {
        cycleId: newCycleId,
        startedAt: new Date(),
        messages: []
      };

      // Update session with new cycle
      // Use $push with $each to handle both cases (existing cycles array or not)
      await ChatSession.findOneAndUpdate(
        { sessionId },
        {
          $push: { cycles: newCycle },
          $set: { currentCycleId: newCycleId }
        },
        { upsert: false }
      );

      memoryLogger.info('New cycle started for timed-out session', {
        sessionId,
        oldCycleId: oldCycleId || 'none',
        newCycleId,
        wasLegacySession: !hasCycles
      });

      return true;

    } catch (error) {
      memoryLogger.error('Failed to start new cycle for session', {
        sessionId: session.sessionId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
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
      dailyRunHour: this.dailyRunHour,
      // Timeout checker status
      timeoutChecker: {
        isRunning: this.isTimeoutCheckerRunning,
        lastCheckTime: this.lastTimeoutCheckTime,
        checkIntervalMinutes: this.timeoutCheckIntervalMs / 60000,
        timeoutThresholdMinutes: this.timeoutThresholdMs / 60000
      }
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
        nextRunTime: this.nextRunTime,
        // Timeout checker health
        timeoutChecker: {
          isRunning: this.isTimeoutCheckerRunning,
          lastCheckTime: this.lastTimeoutCheckTime
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Manually trigger timeout check (for testing)
   * @returns {Promise<Object>} Check results
   */
  async triggerTimeoutCheck() {
    memoryLogger.info('Manual timeout check triggered');
    return this.checkSessionTimeouts();
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
