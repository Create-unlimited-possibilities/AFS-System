/**
 * Indexer - Real-Time Memory Indexing
 * Handles real-time vector indexing for conversation memories
 * with queue management for concurrent indexing requests
 *
 * @author AFS Team
 * @version 1.0.0
 */

import VectorIndexService from '../../core/storage/vector.js';
import logger from '../../core/utils/logger.js';

// Create module-specific logger
const indexLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'INDEXER' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'INDEXER' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'INDEXER' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'INDEXER' }),
};

class Indexer {
  constructor() {
    this.vectorService = new VectorIndexService();
    this.indexingQueue = new Map(); // userId -> { status, memories, currentMemory }
  }

  /**
   * Index a single memory into the vector store
   * @param {string} userId - User ID
   * @param {Object} memory - Memory object to index
   * @returns {Promise<Object>} Indexing result
   */
  async indexMemory(userId, memory) {
    try {
      indexLogger.info(`Indexing memory ${memory.memoryId} for user ${userId}`);

      // Validate memory has required fields
      if (!memory.memoryId) {
        throw new Error('Memory must have a memoryId');
      }

      // Build text and metadata
      const text = this.vectorService.buildMemoryText(memory);
      if (!text || text.trim().length === 0) {
        indexLogger.warn(`Memory ${memory.memoryId} has no searchable content, skipping`);
        return {
          success: false,
          memoryId: memory.memoryId,
          error: 'No searchable content'
        };
      }

      // Generate embedding and add to collection
      const collection = await this.vectorService.getCollection(userId);
      const embedding = await this.vectorService.embeddingService.embedQuery(text);
      const metadata = this.vectorService.buildMetadata(memory);

      await collection.add({
        ids: [memory.memoryId],
        embeddings: [embedding],
        documents: [text],
        metadatas: [metadata]
      });

      indexLogger.info(`Successfully indexed memory ${memory.memoryId}`);

      return {
        success: true,
        memoryId: memory.memoryId,
        indexed: true,
        indexedAt: new Date().toISOString()
      };
    } catch (error) {
      indexLogger.error(`Failed to index memory ${memory.memoryId}: ${error.message}`);
      return {
        success: false,
        memoryId: memory.memoryId,
        error: error.message
      };
    }
  }

  /**
   * Index multiple memories with progress tracking
   * @param {string} userId - User ID
   * @param {Array} memories - Array of memory objects
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Promise<Object>} Batch indexing result
   */
  async indexBatch(userId, memories, progressCallback) {
    const startTime = Date.now();
    const results = {
      total: memories.length,
      indexed: 0,
      failed: 0,
      errors: [],
      memoryIds: []
    };

    try {
      indexLogger.info(`Starting batch indexing for user ${userId}: ${memories.length} memories`);

      // Process in batches of 10 to avoid overwhelming the embedding service
      const batchSize = 10;

      for (let i = 0; i < memories.length; i += batchSize) {
        const batch = memories.slice(i, i + batchSize);

        // Process batch in parallel
        const batchResults = await Promise.all(
          batch.map(memory => this.indexMemory(userId, memory))
        );

        // Aggregate results
        for (const result of batchResults) {
          if (result.success) {
            results.indexed++;
            results.memoryIds.push(result.memoryId);
          } else {
            results.failed++;
            results.errors.push({
              memoryId: result.memoryId,
              error: result.error
            });
          }
        }

        // Report progress
        if (progressCallback) {
          progressCallback({
            current: Math.min(i + batchSize, memories.length),
            total: memories.length,
            indexed: results.indexed,
            failed: results.failed
          });
        }
      }

      const duration = Date.now() - startTime;
      indexLogger.info(`Batch indexing completed for user ${userId}`, {
        total: results.total,
        indexed: results.indexed,
        failed: results.failed,
        duration: `${duration}ms`
      });

      return {
        success: true,
        ...results,
        duration
      };
    } catch (error) {
      indexLogger.error(`Batch indexing failed for user ${userId}: ${error.message}`);
      return {
        success: false,
        ...results,
        error: error.message
      };
    }
  }

  /**
   * Get indexing status for a user
   * @param {string} userId - User ID
   * @returns {Object} Status object
   */
  getIndexingStatus(userId) {
    const status = this.indexingQueue.get(userId);
    if (!status) {
      return {
        status: 'idle',
        userId,
        queuedCount: 0
      };
    }

    return {
      status: status.status,
      userId,
      currentMemory: status.currentMemory || null,
      queuedCount: status.memories?.length || 0,
      error: status.error || null
    };
  }

  /**
   * Check if indexing is in progress for a user
   * @param {string} userId - User ID
   * @returns {boolean} True if indexing
   */
  isIndexing(userId) {
    const status = this.indexingQueue.get(userId);
    return status?.status === 'indexing';
  }

  /**
   * Set indexing status for a user
   * @param {string} userId - User ID
   * @param {string} status - Status value (idle, indexing, complete, error)
   * @param {Object} data - Additional data
   */
  setIndexingStatus(userId, status, data = {}) {
    const current = this.indexingQueue.get(userId) || { memories: [] };
    this.indexingQueue.set(userId, {
      ...current,
      status,
      ...data,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Clear indexing status for a user
   * @param {string} userId - User ID
   */
  clearIndexingStatus(userId) {
    this.indexingQueue.delete(userId);
    indexLogger.debug(`Cleared indexing status for user ${userId}`);
  }

  /**
   * Queue a memory for indexing
   * @param {string} userId - User ID
   * @param {Object} memory - Memory to queue
   * @private
   */
  queueMemory(userId, memory) {
    const current = this.indexingQueue.get(userId) || { memories: [], status: 'idle' };
    current.memories.push(memory);
    this.indexingQueue.set(userId, current);
    indexLogger.debug(`Queued memory ${memory.memoryId} for user ${userId}`);
  }

  /**
   * Process the indexing queue for a user
   * @param {string} userId - User ID
   * @private
   */
  async processQueue(userId) {
    const status = this.indexingQueue.get(userId);
    if (!status || status.memories.length === 0) {
      this.setIndexingStatus(userId, 'complete');
      return;
    }

    // Get next memory from queue
    const memory = status.memories.shift();
    this.setIndexingStatus(userId, 'indexing', { currentMemory: memory.memoryId });

    try {
      const result = await this.indexMemory(userId, memory);

      if (result.success) {
        // Mark as indexed in file storage
        const MemoryStore = (await import('./MemoryStore.js')).default;
        const memoryStore = new MemoryStore();
        if (memory._filePath) {
          await memoryStore.markAsIndexed(memory._filePath);
        }
      }

      // Continue processing queue
      await this.processQueue(userId);
    } catch (error) {
      indexLogger.error(`Queue processing error for user ${userId}: ${error.message}`);
      this.setIndexingStatus(userId, 'error', { error: error.message });
    }
  }

  /**
   * Main entry point for indexing a conversation memory
   * Handles queuing if already indexing
   * @param {string} userId - User ID
   * @param {Object} memory - Memory object to index
   * @returns {Promise<Object>} Indexing result
   */
  async indexConversationMemory(userId, memory) {
    try {
      // Check if already indexing
      if (this.isIndexing(userId)) {
        indexLogger.info(`Queueing memory ${memory.memoryId} - user ${userId} is currently indexing`);
        this.queueMemory(userId, memory);
        return {
          success: true,
          queued: true,
          memoryId: memory.memoryId,
          message: 'Memory queued for indexing',
          queuePosition: this.indexingQueue.get(userId).memories.length
        };
      }

      // Initialize status
      this.setIndexingStatus(userId, 'indexing', { currentMemory: memory.memoryId });

      // Perform indexing
      const result = await this.indexMemory(userId, memory);

      if (result.success) {
        // Mark as indexed in file storage
        const MemoryStore = (await import('./MemoryStore.js')).default;
        const memoryStore = new MemoryStore();
        if (memory._filePath) {
          await memoryStore.markAsIndexed(memory._filePath);
        }

        this.setIndexingStatus(userId, 'complete');
      } else {
        this.setIndexingStatus(userId, 'error', { error: result.error });
      }

      // Process any queued memories
      const queueStatus = this.indexingQueue.get(userId);
      if (queueStatus && queueStatus.memories.length > 0) {
        // Process queue asynchronously
        this.processQueue(userId).catch(err => {
          indexLogger.error(`Queue processing failed: ${err.message}`);
        });
      }

      return result;
    } catch (error) {
      indexLogger.error(`indexConversationMemory failed: ${error.message}`);
      this.setIndexingStatus(userId, 'error', { error: error.message });
      return {
        success: false,
        memoryId: memory.memoryId,
        error: error.message
      };
    }
  }

  /**
   * Get statistics about the indexer
   * @returns {Object} Indexer stats
   */
  getStats() {
    const stats = {
      activeUsers: this.indexingQueue.size,
      queues: []
    };

    for (const [userId, status] of this.indexingQueue.entries()) {
      stats.queues.push({
        userId,
        status: status.status,
        queuedCount: status.memories?.length || 0
      });
    }

    return stats;
  }
}

export default Indexer;
