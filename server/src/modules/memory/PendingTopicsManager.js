/**
 * PendingTopicsManager - Manages unfinished conversation topics
 * Tracks and manages topics that need follow-up in conversations
 *
 * @author AFS Team
 * @version 2.0.0
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import logger from '../../core/utils/logger.js';

const memoryLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'PENDING_TOPICS' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'PENDING_TOPICS' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'PENDING_TOPICS' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'PENDING_TOPICS' }),
};

// Topic expiration period in days
const TOPIC_EXPIRATION_DAYS = 7;

class PendingTopicsManager {
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
        this.basePath = path.join(cwd, 'storage', 'userdata');
      } else {
        this.basePath = path.join(cwd, 'server', 'storage', 'userdata');
      }
    }

    memoryLogger.info('PendingTopicsManager initialized', { basePath: this.basePath });
  }

  /**
   * Get the file path for pending topics
   * @param {string} userId - User ID
   * @returns {string} File path
   */
  getFilePath(userId) {
    return path.join(this.basePath, String(userId), 'pending_topics.json');
  }

  /**
   * Generate a unique topic ID
   * @returns {string} Topic ID
   */
  generateTopicId() {
    return `topic_${crypto.randomUUID()}`;
  }

  /**
   * Load pending topics file
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Topics data
   */
  async loadTopicsFile(userId) {
    const filePath = this.getFilePath(userId);

    try {
      const data = await fsPromises.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return empty structure
        return {
          userId: String(userId),
          pendingTopics: []
        };
      }
      throw error;
    }
  }

  /**
   * Save pending topics file
   * @param {string} userId - User ID
   * @param {Object} data - Topics data
   */
  async saveTopicsFile(userId, data) {
    const filePath = this.getFilePath(userId);
    const dirPath = path.dirname(filePath);

    // Ensure directory exists
    await fsPromises.mkdir(dirPath, { recursive: true });

    await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    memoryLogger.debug(`Saved pending topics file`, { userId, filePath });
  }

  /**
   * Get all pending topics for a user
   * Filters out topics older than expiration period
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of pending topics
   */
  async getPendingTopics(userId) {
    try {
      const data = await this.loadTopicsFile(userId);
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - TOPIC_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

      // Filter out expired topics
      const validTopics = data.pendingTopics.filter(topic => {
        const createdAt = new Date(topic.createdAt);
        return createdAt >= cutoffDate;
      });

      // If some topics were expired, update the file
      if (validTopics.length !== data.pendingTopics.length) {
        data.pendingTopics = validTopics;
        await this.saveTopicsFile(userId, data);
        memoryLogger.info(`Removed expired topics`, {
          userId,
          removed: data.pendingTopics.length - validTopics.length
        });
      }

      memoryLogger.debug(`Retrieved pending topics`, {
        userId,
        count: validTopics.length
      });

      return validTopics;
    } catch (error) {
      memoryLogger.error(`Failed to get pending topics: ${error.message}`, { userId });
      throw error;
    }
  }

  /**
   * Add a new pending topic
   * @param {string} userId - User ID
   * @param {Object} topicData - Topic data
   * @param {string} topicData.topic - Topic description
   * @param {string} topicData.context - Context of the topic
   * @param {string} topicData.suggestedFollowUp - Suggested follow-up message
   * @param {string} topicData.withUserId - Partner user ID
   * @param {string} topicData.conversationId - Conversation ID
   * @param {string} topicData.urgency - Urgency level (low, medium, high)
   * @returns {Promise<Object>} Created topic
   */
  async addTopic(userId, topicData) {
    try {
      const data = await this.loadTopicsFile(userId);

      const topic = {
        id: this.generateTopicId(),
        topic: topicData.topic,
        context: topicData.context || '',
        suggestedFollowUp: topicData.suggestedFollowUp || '',
        withUserId: topicData.withUserId,
        conversationId: topicData.conversationId || null,
        urgency: topicData.urgency || 'medium',
        createdAt: new Date().toISOString(),
        lastChecked: null,
        checkCount: 0,
        status: 'pending'
      };

      data.pendingTopics.push(topic);
      await this.saveTopicsFile(userId, data);

      memoryLogger.info(`Added pending topic`, {
        userId,
        topicId: topic.id,
        topic: topic.topic.substring(0, 50),
        withUserId: topic.withUserId
      });

      return topic;
    } catch (error) {
      memoryLogger.error(`Failed to add topic: ${error.message}`, { userId });
      throw error;
    }
  }

  /**
   * Clear/remove a specific topic
   * @param {string} userId - User ID
   * @param {string} topicId - Topic ID to clear
   * @returns {Promise<boolean>} Whether topic was found and removed
   */
  async clearTopic(userId, topicId) {
    try {
      const data = await this.loadTopicsFile(userId);
      const initialLength = data.pendingTopics.length;

      data.pendingTopics = data.pendingTopics.filter(t => t.id !== topicId);

      if (data.pendingTopics.length < initialLength) {
        await this.saveTopicsFile(userId, data);
        memoryLogger.info(`Cleared pending topic`, { userId, topicId });
        return true;
      }

      memoryLogger.debug(`Topic not found for clearing`, { userId, topicId });
      return false;
    } catch (error) {
      memoryLogger.error(`Failed to clear topic: ${error.message}`, { userId, topicId });
      throw error;
    }
  }

  /**
   * Mark a topic as checked (reviewed)
   * @param {string} userId - User ID
   * @param {string} topicId - Topic ID
   * @returns {Promise<Object|null>} Updated topic or null if not found
   */
  async markAsChecked(userId, topicId) {
    try {
      const data = await this.loadTopicsFile(userId);
      const topic = data.pendingTopics.find(t => t.id === topicId);

      if (!topic) {
        memoryLogger.debug(`Topic not found for marking as checked`, { userId, topicId });
        return null;
      }

      topic.lastChecked = new Date().toISOString();
      topic.checkCount = (topic.checkCount || 0) + 1;

      await this.saveTopicsFile(userId, data);

      memoryLogger.debug(`Marked topic as checked`, {
        userId,
        topicId,
        checkCount: topic.checkCount
      });

      return topic;
    } catch (error) {
      memoryLogger.error(`Failed to mark topic as checked: ${error.message}`, { userId, topicId });
      throw error;
    }
  }

  /**
   * Get topics for a specific partner
   * @param {string} userId - User ID
   * @param {string} withUserId - Partner user ID
   * @returns {Promise<Array>} Topics for the partner
   */
  async getTopicsForPartner(userId, withUserId) {
    try {
      const topics = await this.getPendingTopics(userId);
      const partnerTopics = topics.filter(t => t.withUserId === withUserId);

      memoryLogger.debug(`Retrieved topics for partner`, {
        userId,
        withUserId,
        count: partnerTopics.length
      });

      return partnerTopics;
    } catch (error) {
      memoryLogger.error(`Failed to get topics for partner: ${error.message}`, { userId, withUserId });
      throw error;
    }
  }

  /**
   * Get a random topic to mention (probabilistic selection)
   * @param {string} userId - User ID
   * @param {string} withUserId - Partner user ID
   * @param {number} probability - Probability of returning a topic (0-1)
   * @returns {Promise<Object|null>} Random topic or null
   */
  async getRandomTopicToMention(userId, withUserId, probability = 0.3) {
    try {
      const topics = await this.getTopicsForPartner(userId, withUserId);

      if (topics.length === 0) {
        return null;
      }

      // Probabilistic check
      if (Math.random() > probability) {
        memoryLogger.debug(`Skipping topic mention due to probability check`, {
          userId,
          withUserId,
          probability
        });
        return null;
      }

      // Prefer high urgency topics (70% chance if available)
      const highUrgencyTopics = topics.filter(t => t.urgency === 'high');

      if (highUrgencyTopics.length > 0 && Math.random() < 0.7) {
        const randomIndex = Math.floor(Math.random() * highUrgencyTopics.length);
        const selectedTopic = highUrgencyTopics[randomIndex];

        memoryLogger.info(`Selected high urgency topic to mention`, {
          userId,
          withUserId,
          topicId: selectedTopic.id,
          topic: selectedTopic.topic.substring(0, 30)
        });

        return selectedTopic;
      }

      // Random selection from all topics
      const randomIndex = Math.floor(Math.random() * topics.length);
      const selectedTopic = topics[randomIndex];

      memoryLogger.info(`Selected random topic to mention`, {
        userId,
        withUserId,
        topicId: selectedTopic.id,
        topic: selectedTopic.topic.substring(0, 30)
      });

      return selectedTopic;
    } catch (error) {
      memoryLogger.error(`Failed to get random topic: ${error.message}`, { userId, withUserId });
      return null;
    }
  }

  /**
   * Get topic statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Statistics
   */
  async getTopicStats(userId) {
    try {
      const topics = await this.getPendingTopics(userId);

      const stats = {
        total: topics.length,
        byUrgency: {
          high: 0,
          medium: 0,
          low: 0
        },
        byStatus: {
          pending: 0,
          addressed: 0
        },
        byPartner: {}
      };

      for (const topic of topics) {
        // Count by urgency
        if (stats.byUrgency[topic.urgency] !== undefined) {
          stats.byUrgency[topic.urgency]++;
        }

        // Count by status
        if (stats.byStatus[topic.status] !== undefined) {
          stats.byStatus[topic.status]++;
        }

        // Count by partner
        if (!stats.byPartner[topic.withUserId]) {
          stats.byPartner[topic.withUserId] = 0;
        }
        stats.byPartner[topic.withUserId]++;
      }

      return stats;
    } catch (error) {
      memoryLogger.error(`Failed to get topic stats: ${error.message}`, { userId });
      throw error;
    }
  }

  /**
   * Update topic status
   * @param {string} userId - User ID
   * @param {string} topicId - Topic ID
   * @param {string} status - New status
   * @returns {Promise<Object|null>} Updated topic or null
   */
  async updateTopicStatus(userId, topicId, status) {
    try {
      const data = await this.loadTopicsFile(userId);
      const topic = data.pendingTopics.find(t => t.id === topicId);

      if (!topic) {
        return null;
      }

      topic.status = status;
      await this.saveTopicsFile(userId, data);

      memoryLogger.info(`Updated topic status`, {
        userId,
        topicId,
        newStatus: status
      });

      return topic;
    } catch (error) {
      memoryLogger.error(`Failed to update topic status: ${error.message}`, { userId, topicId });
      throw error;
    }
  }
}

export default PendingTopicsManager;
