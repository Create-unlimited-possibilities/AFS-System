/**
 * ActivityLogService
 * Business logic for managing activity logs
 *
 * @author AFS Team
 * @version 1.0.0
 */

import ActivityLog from '../models/activityLog.js';
import logger from '../../../core/utils/logger.js';

const log = logger.child({ module: 'ActivityLogService' });

class ActivityLogService {
  /**
   * Log an activity
   * @param {Object} data - Activity data
   * @returns {Promise<Object>} Created log entry
   */
  async log(data) {
    try {
      const logEntry = await ActivityLog.create({
        operation: data.operation,
        category: data.category,
        actorId: data.actorId,
        actorName: data.actorName,
        targetType: data.targetType,
        targetId: data.targetId,
        targetName: data.targetName,
        description: data.description,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        success: data.success !== false,
        errorMessage: data.errorMessage
      });

      log.debug('Activity logged', {
        operation: data.operation,
        category: data.category,
        actorId: data.actorId
      });

      return logEntry;
    } catch (error) {
      log.error('Failed to log activity', {
        error: error.message,
        data
      });
      throw error;
    }
  }

  /**
   * Get logs with filters and pagination
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Paginated logs
   */
  async getLogs(filters = {}) {
    const {
      page = 1,
      limit = 20,
      category,
      operation,
      actorId,
      targetId,
      success,
      startDate,
      endDate,
      search
    } = filters;

    const query = {};

    if (category) {
      query.category = category;
    }

    if (operation) {
      query.operation = { $regex: operation, $options: 'i' };
    }

    if (actorId) {
      query.actorId = actorId;
    }

    if (targetId) {
      query.targetId = targetId;
    }

    if (success !== undefined && success !== '') {
      query.success = success === 'true' || success === true;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { targetName: { $regex: search, $options: 'i' } },
        { actorName: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      ActivityLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('actorId', 'name email')
        .lean(),
      ActivityLog.countDocuments(query)
    ]);

    return {
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    };
  }

  /**
   * Get log by ID
   * @param {string} id - Log ID
   * @returns {Promise<Object|null>} Log entry
   */
  async getById(id) {
    try {
      return await ActivityLog.findById(id)
        .populate('actorId', 'name email')
        .lean();
    } catch (error) {
      log.error('Failed to get log by ID', { id, error: error.message });
      return null;
    }
  }

  /**
   * Get log statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Statistics
   */
  async getStats(filters = {}) {
    const { startDate, endDate } = filters;

    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const [categoryStats, operationStats, successStats, total] = await Promise.all([
      // Count by category
      ActivityLog.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      // Count by operation
      ActivityLog.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$operation', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]),
      // Count by success
      ActivityLog.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$success', count: { $sum: 1 } } }
      ]),
      // Total count
      ActivityLog.countDocuments(matchQuery)
    ]);

    return {
      total,
      byCategory: categoryStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byOperation: operationStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      bySuccess: successStats.reduce((acc, item) => {
        acc[item._id ? 'succeeded' : 'failed'] = item.count;
        return acc;
      }, { succeeded: 0, failed: 0 })
    };
  }

  /**
   * Export logs
   * @param {Object} filters - Filter options
   * @param {string} format - Export format ('json' or 'csv')
   * @returns {Promise<Object>} Export data
   */
  async exportLogs(filters = {}, format = 'json') {
    const logs = await this.getLogs({ ...filters, limit: 10000 });

    if (format === 'csv') {
      // Convert to CSV
      const headers = ['timestamp', 'category', 'operation', 'actor', 'target', 'description', 'success'];
      const rows = logs.logs.map(log => [
        log.createdAt,
        log.category,
        log.operation,
        log.actorName || log.actorId?.name || '',
        log.targetName || '',
        (log.description || '').replace(/"/g, '""'),
        log.success ? 'yes' : 'no'
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      return { data: csv, format: 'csv' };
    }

    return { data: logs.logs, format: 'json' };
  }

  /**
   * Get recent activity for dashboard
   * @param {number} limit - Number of entries
   * @returns {Promise<Array>} Recent activities
   */
  async getRecentActivity(limit = 10) {
    return ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actorId', 'name email')
      .lean();
  }

  /**
   * Clean up old logs
   * @param {number} daysToKeep - Days to keep
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOldLogs(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await ActivityLog.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    log.info('Cleaned up old activity logs', {
      deletedCount: result.deletedCount,
      daysToKeep
    });

    return {
      success: true,
      deletedCount: result.deletedCount
    };
  }
}

export default new ActivityLogService();
