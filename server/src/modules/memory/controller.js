/**
 * Memory Controller
 * Handles API endpoints for memory indexing status and management
 *
 * @author AFS Team
 * @version 2.0.0
 */

import MemoryStore from './MemoryStore.js';
import Indexer from './Indexer.js';
import PendingTopicsManager from './PendingTopicsManager.js';
import ProactiveMessagingManager from './ProactiveMessagingManager.js';
import logger from '../../core/utils/logger.js';

// Create module-specific logger
const ctrlLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'MEMORY_CTRL' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'MEMORY_CTRL' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'MEMORY_CTRL' }),
};

// Singleton instances
const memoryStore = new MemoryStore();
const indexer = new Indexer();
const pendingTopicsManager = new PendingTopicsManager();
const proactiveManager = new ProactiveMessagingManager();

/**
 * Get indexing status for the current user
 * GET /api/memory/index/status
 */
export async function getIndexStatus(req, res) {
  try {
    const userId = req.user.id || req.user._id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    // Get indexing status
    const indexStatus = indexer.getIndexingStatus(userId);

    // Get memory statistics
    const memoryStats = await memoryStore.getMemoryStats(userId);

    // Get count of memories needing indexing
    const needsIndex = await memoryStore.getMemoriesNeedingIndex(userId);

    ctrlLogger.info(`Retrieved index status for user ${userId}`);

    return res.json({
      success: true,
      data: {
        indexing: indexStatus,
        memory: {
          total: memoryStats.totalMemories,
          indexed: memoryStats.indexed,
          pendingIndex: memoryStats.pendingIndex,
          byStage: memoryStats.byCompressionStage
        },
        needsIndexCount: needsIndex.length
      }
    });
  } catch (error) {
    ctrlLogger.error(`Failed to get index status: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get index status',
      error: error.message
    });
  }
}

/**
 * Check if the memory system is busy (indexing or processing)
 * GET /api/memory/busy
 */
export async function checkBusy(req, res) {
  try {
    const userId = req.user.id || req.user._id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    const isIndexing = indexer.isIndexing(userId);
    const status = indexer.getIndexingStatus(userId);

    return res.json({
      success: true,
      data: {
        busy: isIndexing,
        status: status.status,
        currentMemory: status.currentMemory,
        queuedCount: status.queuedCount
      }
    });
  } catch (error) {
    ctrlLogger.error(`Failed to check busy status: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to check busy status',
      error: error.message
    });
  }
}

/**
 * Get pending topics for the current user
 * GET /api/memory/pending-topics
 */
export async function getPendingTopics(req, res) {
  try {
    const userId = req.user.id || req.user._id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    // Load all memories and extract pending topics
    const memories = await memoryStore.loadUserMemories(userId);
    const pendingTopics = [];

    for (const [partnerId, partnerMemories] of Object.entries(memories)) {
      for (const memory of partnerMemories) {
        if (memory.pendingTopics?.hasUnfinished && memory.pendingTopics?.topics?.length > 0) {
          pendingTopics.push({
            memoryId: memory.memoryId,
            partnerId,
            topics: memory.pendingTopics.topics,
            createdAt: memory.meta?.createdAt
          });
        }
      }
    }

    ctrlLogger.info(`Retrieved ${pendingTopics.length} pending topics for user ${userId}`);

    return res.json({
      success: true,
      data: {
        total: pendingTopics.length,
        topics: pendingTopics
      }
    });
  } catch (error) {
    ctrlLogger.error(`Failed to get pending topics: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get pending topics',
      error: error.message
    });
  }
}

/**
 * Clear a specific pending topic
 * DELETE /api/memory/pending-topics/:topicId
 */
export async function clearPendingTopic(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { topicId } = req.params;
    const { memoryId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    if (!memoryId) {
      return res.status(400).json({
        success: false,
        message: 'memoryId is required in request body'
      });
    }

    // Load memories and find the one with this memoryId
    const memories = await memoryStore.loadUserMemories(userId);
    let targetMemory = null;
    let targetFilePath = null;

    for (const [, partnerMemories] of Object.entries(memories)) {
      for (const memory of partnerMemories) {
        if (memory.memoryId === memoryId) {
          targetMemory = memory;
          targetFilePath = memory._filePath;
          break;
        }
      }
      if (targetMemory) break;
    }

    if (!targetMemory) {
      return res.status(404).json({
        success: false,
        message: 'Memory not found'
      });
    }

    if (!targetFilePath) {
      return res.status(500).json({
        success: false,
        message: 'Memory file path not found'
      });
    }

    // Remove the specific topic from pending topics
    if (targetMemory.pendingTopics?.topics) {
      const topicIndex = targetMemory.pendingTopics.topics.findIndex(
        t => t.id === topicId || t.topic === topicId
      );

      if (topicIndex !== -1) {
        targetMemory.pendingTopics.topics.splice(topicIndex, 1);

        // Update hasUnfinished flag
        targetMemory.pendingTopics.hasUnfinished =
          targetMemory.pendingTopics.topics.length > 0;

        // Save updated memory
        await memoryStore.updateMemory(targetFilePath, {
          pendingTopics: targetMemory.pendingTopics
        });

        ctrlLogger.info(`Cleared pending topic ${topicId} from memory ${memoryId}`);

        return res.json({
          success: true,
          data: {
            topicId,
            memoryId,
            remainingTopics: targetMemory.pendingTopics.topics.length
          }
        });
      }
    }

    return res.status(404).json({
      success: false,
      message: 'Topic not found in memory'
    });
  } catch (error) {
    ctrlLogger.error(`Failed to clear pending topic: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear pending topic',
      error: error.message
    });
  }
}

/**
 * Trigger indexing for all pending memories
 * POST /api/memory/index/trigger
 */
export async function triggerIndexing(req, res) {
  try {
    const userId = req.user.id || req.user._id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    // Check if already indexing
    if (indexer.isIndexing(userId)) {
      return res.status(409).json({
        success: false,
        message: 'Indexing already in progress',
        data: indexer.getIndexingStatus(userId)
      });
    }

    // Get memories needing indexing
    const needsIndex = await memoryStore.getMemoriesNeedingIndex(userId);

    if (needsIndex.length === 0) {
      return res.json({
        success: true,
        message: 'No memories need indexing',
        data: {
          indexed: 0
        }
      });
    }

    // Start batch indexing asynchronously
    const memories = needsIndex.map(item => item.memory);

    // Don't await - let it run in background
    indexer.indexBatch(userId, memories, (progress) => {
      ctrlLogger.info(`Indexing progress for user ${userId}: ${progress.current}/${progress.total}`);
    }).then(result => {
      ctrlLogger.info(`Batch indexing completed for user ${userId}`, result);
    }).catch(error => {
      ctrlLogger.error(`Batch indexing failed for user ${userId}: ${error.message}`);
    });

    return res.json({
      success: true,
      message: 'Indexing started',
      data: {
        pendingCount: memories.length,
        status: indexer.getIndexingStatus(userId)
      }
    });
  } catch (error) {
    ctrlLogger.error(`Failed to trigger indexing: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to trigger indexing',
      error: error.message
    });
  }
}

/**
 * Get memory statistics for the current user
 * GET /api/memory/stats
 */
export async function getMemoryStats(req, res) {
  try {
    const userId = req.user.id || req.user._id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    const stats = await memoryStore.getMemoryStats(userId);

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    ctrlLogger.error(`Failed to get memory stats: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get memory stats',
      error: error.message
    });
  }
}

/**
 * Check if should send a proactive message
 * GET /api/memory/proactive/check/:withUserId
 */
export async function checkProactive(req, res) {
  try {
    const userId = (req.user.id || req.user._id)?.toString();
    const { withUserId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    if (!withUserId) {
      return res.status(400).json({
        success: false,
        message: 'withUserId parameter is required'
      });
    }

    const decision = await proactiveManager.shouldSendProactive(userId, withUserId);

    ctrlLogger.info(`Checked proactive timing for user ${userId} with ${withUserId}`, {
      shouldSend: decision.shouldSend
    });

    return res.json({
      success: true,
      data: decision
    });
  } catch (error) {
    ctrlLogger.error(`Failed to check proactive: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to check proactive timing',
      error: error.message
    });
  }
}

/**
 * Generate a proactive message
 * POST /api/memory/proactive/generate/:withUserId
 */
export async function generateProactive(req, res) {
  try {
    const userId = (req.user.id || req.user._id)?.toString();
    const { withUserId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    if (!withUserId) {
      return res.status(400).json({
        success: false,
        message: 'withUserId parameter is required'
      });
    }

    const result = await proactiveManager.generateProactiveMessage(userId, withUserId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to generate proactive message'
      });
    }

    ctrlLogger.info(`Generated proactive message for user ${userId} with ${withUserId}`);

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    ctrlLogger.error(`Failed to generate proactive message: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate proactive message',
      error: error.message
    });
  }
}

/**
 * Get proactive messaging status
 * GET /api/memory/proactive/status/:withUserId
 */
export async function getProactiveStatus(req, res) {
  try {
    const userId = (req.user.id || req.user._id)?.toString();
    const { withUserId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    if (!withUserId) {
      return res.status(400).json({
        success: false,
        message: 'withUserId parameter is required'
      });
    }

    const status = await proactiveManager.getProactiveStatus(userId, withUserId);

    return res.json({
      success: true,
      data: status
    });
  } catch (error) {
    ctrlLogger.error(`Failed to get proactive status: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get proactive status',
      error: error.message
    });
  }
}

/**
 * Get pending topics from dedicated manager
 * GET /api/memory/pending-topics/v2
 */
export async function getPendingTopicsV2(req, res) {
  try {
    const userId = (req.user.id || req.user._id)?.toString();

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    const topics = await pendingTopicsManager.getPendingTopics(userId);
    const stats = await pendingTopicsManager.getTopicStats(userId);

    return res.json({
      success: true,
      data: {
        topics,
        stats
      }
    });
  } catch (error) {
    ctrlLogger.error(`Failed to get pending topics v2: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get pending topics',
      error: error.message
    });
  }
}

/**
 * Add a new pending topic
 * POST /api/memory/pending-topics
 */
export async function addPendingTopic(req, res) {
  try {
    const userId = (req.user.id || req.user._id)?.toString();
    const { topic, context, suggestedFollowUp, withUserId, conversationId, urgency } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    if (!topic || !withUserId) {
      return res.status(400).json({
        success: false,
        message: 'topic and withUserId are required'
      });
    }

    const newTopic = await pendingTopicsManager.addTopic(userId, {
      topic,
      context,
      suggestedFollowUp,
      withUserId,
      conversationId,
      urgency
    });

    ctrlLogger.info(`Added pending topic for user ${userId}`);

    return res.json({
      success: true,
      data: newTopic
    });
  } catch (error) {
    ctrlLogger.error(`Failed to add pending topic: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to add pending topic',
      error: error.message
    });
  }
}

/**
 * Clear a pending topic from dedicated manager
 * DELETE /api/memory/pending-topics/v2/:topicId
 */
export async function clearPendingTopicV2(req, res) {
  try {
    const userId = (req.user.id || req.user._id)?.toString();
    const { topicId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    if (!topicId) {
      return res.status(400).json({
        success: false,
        message: 'topicId parameter is required'
      });
    }

    const cleared = await pendingTopicsManager.clearTopic(userId, topicId);

    if (!cleared) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    ctrlLogger.info(`Cleared pending topic ${topicId} for user ${userId}`);

    return res.json({
      success: true,
      data: { topicId, cleared: true }
    });
  } catch (error) {
    ctrlLogger.error(`Failed to clear pending topic v2: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear pending topic',
      error: error.message
    });
  }
}

export default {
  getIndexStatus,
  checkBusy,
  getPendingTopics,
  clearPendingTopic,
  triggerIndexing,
  getMemoryStats,
  checkProactive,
  generateProactive,
  getProactiveStatus,
  getPendingTopicsV2,
  addPendingTopic,
  clearPendingTopicV2
};
