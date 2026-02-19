/**
 * Memory Controller
 * Handles API endpoints for memory indexing status and management
 *
 * @author AFS Team
 * @version 1.0.0
 */

import MemoryStore from './MemoryStore.js';
import Indexer from './Indexer.js';
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

export default {
  getIndexStatus,
  checkBusy,
  getPendingTopics,
  clearPendingTopic,
  triggerIndexing,
  getMemoryStats
};
