/**
 * RecycleBinService
 * Business logic for managing soft-deleted items
 *
 * @author AFS Team
 * @version 1.0.0
 */

import RecycleBin from '../models/recycleBin.js';
import ActivityLog from '../models/activityLog.js';
import Answer from '../../qa/models/answer.js';
import MemoryStore from '../../memory/MemoryStore.js';
import ChromaDBService from '../../../core/storage/chroma.js';
import logger from '../../../core/utils/logger.js';
import mongoose from 'mongoose';

const log = logger.child({ module: 'RecycleBinService' });

// Days until permanent deletion
const PURGE_DAYS = 30;

class RecycleBinService {
  constructor() {
    this.memoryStore = new MemoryStore();
  }

  /**
   * Add item to recycle bin
   * @param {Object} data - Item data
   * @returns {Promise<Object>} Created recycle bin entry
   */
  async addToRecycleBin(data) {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + PURGE_DAYS);

      const entry = await RecycleBin.create({
        itemType: data.itemType,
        originalId: data.originalId,
        userId: data.userId,
        targetUserId: data.targetUserId,
        partnerId: data.partnerId,
        deletedBy: data.deletedBy,
        expiresAt,
        snapshot: data.snapshot,
        filePaths: data.filePaths || [],
        vectorIndexIds: data.vectorIndexIds || [],
        relatedEntries: data.relatedEntries || []
      });

      log.info('Item added to recycle bin', {
        itemType: data.itemType,
        originalId: data.originalId,
        entryId: entry._id
      });

      return entry;
    } catch (error) {
      log.error('Failed to add item to recycle bin', {
        error: error.message,
        data
      });
      throw error;
    }
  }

  /**
   * Get recycle bin items with filters and pagination
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Paginated items
   */
  async getItems(filters = {}) {
    const {
      page = 1,
      limit = 20,
      itemType,
      userId,
      status = 'pending_purge',
      search,
      startDate,
      endDate
    } = filters;

    const query = { status };

    if (itemType) {
      query.itemType = itemType;
    }

    if (userId) {
      query.userId = userId;
    }

    if (startDate || endDate) {
      query.deletedAt = {};
      if (startDate) query.deletedAt.$gte = new Date(startDate);
      if (endDate) query.deletedAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [items, total] = await Promise.all([
      RecycleBin.find(query)
        .sort({ deletedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('userId', 'name email uniqueCode')
        .populate('deletedBy', 'name email')
        .populate('targetUserId', 'name email')
        .populate('partnerId', 'name email')
        .lean(),
      RecycleBin.countDocuments(query)
    ]);

    return {
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    };
  }

  /**
   * Get item by ID
   * @param {string} id - Item ID
   * @returns {Promise<Object|null>} Item details
   */
  async getItemById(id) {
    try {
      return await RecycleBin.findById(id)
        .populate('userId', 'name email uniqueCode')
        .populate('deletedBy', 'name email')
        .populate('targetUserId', 'name email')
        .populate('partnerId', 'name email')
        .populate('relatedEntries')
        .lean();
    } catch (error) {
      log.error('Failed to get recycle bin item', { id, error: error.message });
      return null;
    }
  }

  /**
   * Restore an item from recycle bin
   * @param {string} id - Entry ID
   * @param {string} adminId - Admin who is restoring
   * @returns {Promise<Object>} Restoration result
   */
  async restoreItem(id, adminId) {
    const entry = await RecycleBin.findById(id);

    if (!entry) {
      throw new Error('Recycle bin entry not found');
    }

    if (entry.status !== 'pending_purge') {
      throw new Error(`Cannot restore item with status: ${entry.status}`);
    }

    if (new Date() > entry.expiresAt) {
      throw new Error('Cannot restore expired item');
    }

    let restored = false;
    const errors = [];

    try {
      // Restore based on item type
      if (entry.itemType === 'questionnaire_answer') {
        restored = await this.restoreQuestionnaireAnswer(entry);
      } else if (entry.itemType === 'conversation_memory') {
        restored = await this.restoreConversationMemory(entry);
      }

      // Mark entry as restored
      entry.status = 'restored';
      entry.restoredBy = adminId;
      entry.restoredAt = new Date();
      await entry.save();

      // Restore related entries
      if (entry.relatedEntries && entry.relatedEntries.length > 0) {
        for (const relatedId of entry.relatedEntries) {
          try {
            await this.restoreItem(relatedId, adminId);
          } catch (err) {
            log.warn('Failed to restore related entry', {
              relatedId: relatedId.toString(),
              error: err.message
            });
          }
        }
      }

      // Log activity
      await ActivityLog.logActivity({
        operation: 'memory_restored',
        category: 'memory',
        actorId: adminId,
        targetType: entry.itemType,
        targetId: entry.originalId,
        description: `Restored ${entry.itemType} from recycle bin`,
        details: { recycleBinId: id },
        success: true
      });

      log.info('Item restored from recycle bin', {
        entryId: id,
        itemType: entry.itemType
      });

      return { success: true, restored, entry };
    } catch (error) {
      errors.push(error.message);

      // Log failed restoration
      await ActivityLog.logActivity({
        operation: 'memory_restore_failed',
        category: 'memory',
        actorId: adminId,
        targetType: entry.itemType,
        targetId: entry.originalId,
        description: `Failed to restore ${entry.itemType} from recycle bin`,
        details: { recycleBinId: id, errors },
        success: false,
        errorMessage: error.message
      });

      throw error;
    }
  }

  /**
   * Restore questionnaire answer
   * @param {Object} entry - Recycle bin entry
   * @returns {Promise<boolean>} Success status
   */
  async restoreQuestionnaireAnswer(entry) {
    if (!entry.snapshot) {
      throw new Error('No snapshot available for restoration');
    }

    // Restore the answer document
    await Answer.findByIdAndUpdate(
      entry.originalId,
      { ...entry.snapshot, deletedAt: null },
      { upsert: true }
    );

    return true;
  }

  /**
   * Restore conversation memory
   * @param {Object} entry - Recycle bin entry
   * @returns {Promise<boolean>} Success status
   */
  async restoreConversationMemory(entry) {
    if (!entry.snapshot) {
      throw new Error('No snapshot available for restoration');
    }

    // Restore memory file
    if (entry.filePaths && entry.filePaths.length > 0) {
      const fs = await import('fs/promises');
      for (const filePath of entry.filePaths) {
        if (entry.snapshot.fileContent) {
          await fs.writeFile(filePath, JSON.stringify(entry.snapshot.fileContent, null, 2), 'utf-8');
        }
      }
    }

    // Re-index in ChromaDB
    if (entry.vectorIndexIds && entry.vectorIndexIds.length > 0) {
      try {
        const chromaService = new ChromaDBService();
        await chromaService.initialize();

        for (const vectorId of entry.vectorIndexIds) {
          if (entry.snapshot.vectorData) {
            await chromaService.addMemory(vectorId.userId, {
              id: vectorId.memoryId,
              ...entry.snapshot.vectorData
            });
          }
        }
      } catch (err) {
        log.warn('Failed to restore vector index', { error: err.message });
      }
    }

    return true;
  }

  /**
   * Permanently delete an item
   * @param {string} id - Entry ID
   * @param {string} adminId - Admin who is purging (or 'system_cron')
   * @returns {Promise<Object>} Purge result
   */
  async purgeItem(id, adminId = 'admin_manual') {
    const entry = await RecycleBin.findById(id);

    if (!entry) {
      throw new Error('Recycle bin entry not found');
    }

    try {
      // Delete associated files
      if (entry.filePaths && entry.filePaths.length > 0) {
        const fs = await import('fs/promises');
        for (const filePath of entry.filePaths) {
          try {
            await fs.unlink(filePath);
          } catch (err) {
            if (err.code !== 'ENOENT') {
              log.warn('Failed to delete file during purge', { filePath, error: err.message });
            }
          }
        }
      }

      // Delete vector indexes
      if (entry.vectorIndexIds && entry.vectorIndexIds.length > 0) {
        try {
          const chromaService = new ChromaDBService();
          await chromaService.initialize();

          for (const vectorId of entry.vectorIndexIds) {
            await chromaService.deleteMemory(vectorId.userId, vectorId.memoryId);
          }
        } catch (err) {
          log.warn('Failed to delete vector index during purge', { error: err.message });
        }
      }

      // Mark entry as purged
      entry.status = 'purged';
      entry.purgedBy = adminId;
      entry.purgedAt = new Date();
      await entry.save();

      // Log activity
      await ActivityLog.logActivity({
        operation: 'memory_purged',
        category: 'memory',
        actorId: adminId === 'system_cron' ? null : adminId,
        actorName: adminId === 'system_cron' ? 'System Cron' : undefined,
        targetType: entry.itemType,
        targetId: entry.originalId,
        description: `Permanently deleted ${entry.itemType}`,
        details: { recycleBinId: id },
        success: true
      });

      log.info('Item permanently deleted', {
        entryId: id,
        itemType: entry.itemType,
        purgedBy: adminId
      });

      return { success: true, entry };
    } catch (error) {
      log.error('Failed to purge item', {
        entryId: id,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Batch restore items
   * @param {Array} ids - Entry IDs
   * @param {string} adminId - Admin who is restoring
   * @returns {Promise<Object>} Batch result
   */
  async batchRestore(ids, adminId) {
    const results = {
      succeeded: 0,
      failed: 0,
      errors: []
    };

    for (const id of ids) {
      try {
        await this.restoreItem(id, adminId);
        results.succeeded++;
      } catch (error) {
        results.failed++;
        results.errors.push({ id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Batch purge items
   * @param {Array} ids - Entry IDs
   * @param {string} adminId - Admin who is purging
   * @returns {Promise<Object>} Batch result
   */
  async batchPurge(ids, adminId) {
    const results = {
      succeeded: 0,
      failed: 0,
      errors: []
    };

    for (const id of ids) {
      try {
        await this.purgeItem(id, adminId);
        results.succeeded++;
      } catch (error) {
        results.failed++;
        results.errors.push({ id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get recycle bin statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStats() {
    const stats = await RecycleBin.getStatistics();

    // Get expiring soon count (within 7 days)
    const expiringSoon = await RecycleBin.countDocuments({
      status: 'pending_purge',
      expiresAt: {
        $gte: new Date(),
        $lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    return {
      ...stats,
      expiringSoon
    };
  }

  /**
   * Get expired items for cron job
   * @returns {Promise<Array>} Expired items
   */
  async getExpiredItems() {
    return RecycleBin.findExpired();
  }

  /**
   * Process expired items (for cron job)
   * @returns {Promise<Object>} Processing results
   */
  async processExpiredItems() {
    const expiredItems = await this.getExpiredItems();

    const results = {
      processed: 0,
      failed: 0,
      errors: []
    };

    for (const item of expiredItems) {
      try {
        await this.purgeItem(item._id, 'system_cron');
        results.processed++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          id: item._id,
          error: error.message
        });
      }
    }

    log.info('Processed expired recycle bin items', results);
    return results;
  }
}

export default new RecycleBinService();
