/**
 * ProactiveMessagingManager - Manages proactive message generation
 * Generates personality-driven proactive messages based on pending topics
 *
 * @author AFS Team
 * @version 1.0.0
 */

import LLMClient from '../../core/llm/client.js';
import PendingTopicsManager from './PendingTopicsManager.js';
import DualStorage from '../../core/storage/dual.js';
import ChatSession from '../chat/model.js';
import {
  buildProactiveMessagePrompt,
  buildTimingDecisionPrompt,
  STYLE_DESCRIPTIONS
} from './prompts/proactiveMessage.js';
import logger from '../../core/utils/logger.js';

const proactiveLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'PROACTIVE_MSG' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'PROACTIVE_MSG' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'PROACTIVE_MSG' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'PROACTIVE_MSG' }),
};

class ProactiveMessagingManager {
  constructor() {
    this.llmClient = new LLMClient(process.env.OLLAMA_MODEL || 'deepseek-r1:14b', {
      temperature: 0.7, // Higher temperature for natural variation
      timeout: 30000
    });
    this.pendingTopicsManager = new PendingTopicsManager();
    this.dualStorage = new DualStorage();
  }

  /**
   * Format role card personality for prompts
   * @param {Object} roleCard - Role card object
   * @returns {string} Formatted personality description
   */
  formatPersonality(roleCard) {
    if (!roleCard) {
      return '普通性格，待人友善';
    }

    const parts = [];

    // Extract personality from core layer
    if (roleCard.coreLayer) {
      const core = roleCard.coreLayer;

      if (core.personalityTraits) {
        parts.push(`性格特点: ${core.personalityTraits}`);
      }
      if (core.communicationStyle) {
        parts.push(`说话风格: ${core.communicationStyle}`);
      }
      if (core.values) {
        parts.push(`价值观: ${core.values}`);
      }
    }

    // Extract from legacy role card format
    if (roleCard.profile) {
      if (roleCard.profile.personality) {
        parts.push(`性格: ${roleCard.profile.personality}`);
      }
      if (roleCard.profile.communicationStyle) {
        parts.push(`说话风格: ${roleCard.profile.communicationStyle}`);
      }
    }

    // Include conversation guidelines if available
    if (roleCard.conversationGuidelines) {
      parts.push(`对话准则: ${roleCard.conversationGuidelines}`);
    }

    return parts.length > 0 ? parts.join('\n') : '普通性格，待人友善';
  }

  /**
   * Get highest urgency level from topics
   * @param {Array} topics - List of topics
   * @returns {string} Highest urgency level
   */
  getHighestUrgency(topics) {
    if (!topics || topics.length === 0) {
      return 'low';
    }

    const urgencyOrder = { high: 3, medium: 2, low: 1 };
    let highest = 'low';

    for (const topic of topics) {
      if (urgencyOrder[topic.urgency] > urgencyOrder[highest]) {
        highest = topic.urgency;
      }
    }

    return highest;
  }

  /**
   * Get days since last chat session
   * @param {string} userId - User ID
   * @param {string} withUserId - Partner user ID
   * @returns {Promise<number>} Days since last chat
   */
  async getDaysSinceLastChat(userId, withUserId) {
    try {
      // Find the most recent chat session between these users
      const lastSession = await ChatSession.findOne({
        $or: [
          { targetUserId: userId, interlocutorUserId: withUserId },
          { targetUserId: withUserId, interlocutorUserId: userId }
        ],
        isActive: false
      }).sort({ endedAt: -1 });

      if (!lastSession || !lastSession.endedAt) {
        // No previous session found
        return 999; // Large number indicating never chatted
      }

      const lastChatDate = new Date(lastSession.endedAt);
      const now = new Date();
      const diffMs = now.getTime() - lastChatDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      return Math.max(0, diffDays);
    } catch (error) {
      proactiveLogger.error(`Failed to get days since last chat: ${error.message}`, {
        userId,
        withUserId
      });
      return 0; // Default to 0 if error
    }
  }

  /**
   * Parse JSON response from LLM
   * @param {string} response - Raw LLM response
   * @returns {Object|null} Parsed JSON or null
   */
  parseResponse(response) {
    if (!response) return null;

    try {
      // Try direct JSON parse
      return JSON.parse(response);
    } catch (e) {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e2) {
          proactiveLogger.warn(`Failed to parse extracted JSON: ${e2.message}`);
        }
      }

      proactiveLogger.warn(`Failed to parse LLM response as JSON`, {
        response: response.substring(0, 200)
      });
      return null;
    }
  }

  /**
   * Decide whether to send a proactive message
   * @param {string} userId - User ID (role card owner)
   * @param {string} withUserId - Partner user ID
   * @returns {Promise<Object>} Timing decision
   */
  async shouldSendProactive(userId, withUserId) {
    try {
      proactiveLogger.debug(`Checking proactive timing`, { userId, withUserId });

      // Get role card
      const roleCard = await this.dualStorage.loadRoleCardV2(userId);

      if (!roleCard) {
        return {
          shouldSend: false,
          reasoning: 'No role card found for user',
          confidence: 1.0
        };
      }

      // Get pending topics
      const topics = await this.pendingTopicsManager.getTopicsForPartner(userId, withUserId);

      if (topics.length === 0) {
        return {
          shouldSend: false,
          reasoning: 'No pending topics to follow up on',
          confidence: 1.0
        };
      }

      // Get days since last chat
      const daysSinceLastChat = await this.getDaysSinceLastChat(userId, withUserId);
      const highestUrgency = this.getHighestUrgency(topics);
      const personality = this.formatPersonality(roleCard);

      // Build timing decision prompt
      const prompt = buildTimingDecisionPrompt({
        roleCardPersonality: personality,
        daysSinceLastChat,
        pendingTopicCount: topics.length,
        urgency: highestUrgency
      });

      // Get LLM decision
      const response = await this.llmClient.generate(prompt);
      const decision = this.parseResponse(response);

      if (!decision) {
        // Fallback decision logic
        const shouldSend = daysSinceLastChat >= 1 && (highestUrgency === 'high' || daysSinceLastChat >= 3);
        return {
          shouldSend,
          reasoning: 'Fallback logic: based on days since chat and urgency',
          bestTiming: shouldSend ? 'now' : 'in 1-2 days',
          confidence: 0.5
        };
      }

      proactiveLogger.info(`Proactive timing decision`, {
        userId,
        withUserId,
        shouldSend: decision.shouldSend,
        confidence: decision.confidence
      });

      return {
        shouldSend: decision.shouldSend ?? false,
        reasoning: decision.reasoning || '',
        bestTiming: decision.bestTiming || 'now',
        confidence: decision.confidence ?? 0.5
      };
    } catch (error) {
      proactiveLogger.error(`Failed to check proactive timing: ${error.message}`, {
        userId,
        withUserId
      });
      return {
        shouldSend: false,
        reasoning: `Error: ${error.message}`,
        confidence: 0
      };
    }
  }

  /**
   * Generate a proactive message
   * @param {string} userId - User ID (role card owner)
   * @param {string} withUserId - Partner user ID
   * @returns {Promise<Object>} Generated message result
   */
  async generateProactiveMessage(userId, withUserId) {
    try {
      proactiveLogger.info(`Generating proactive message`, { userId, withUserId });

      // Get role card
      const roleCard = await this.dualStorage.loadRoleCardV2(userId);

      if (!roleCard) {
        return {
          success: false,
          error: 'No role card found for user'
        };
      }

      // Get a random topic to mention
      const topic = await this.pendingTopicsManager.getRandomTopicToMention(userId, withUserId, 0.5);

      if (!topic) {
        return {
          success: false,
          error: 'No suitable pending topic found'
        };
      }

      // Get days since last chat
      const daysSinceLastChat = await this.getDaysSinceLastChat(userId, withUserId);
      const personality = this.formatPersonality(roleCard);

      // Build proactive message prompt
      const prompt = buildProactiveMessagePrompt({
        roleCardPersonality: personality,
        pendingTopic: topic,
        daysSinceLastChat
      });

      // Generate message with LLM
      const response = await this.llmClient.generate(prompt);
      const messageData = this.parseResponse(response);

      if (!messageData || !messageData.message) {
        // Fallback to suggested follow-up
        const fallbackMessage = topic.suggestedFollowUp ||
          `最近怎么样？上次聊到的${topic.topic}有什么新情况吗？`;

        return {
          success: true,
          message: fallbackMessage,
          style: 'casual',
          reasoning: 'Fallback to suggested follow-up',
          topicId: topic.id,
          topic: topic.topic,
          topicIntroduced: true,
          isFallback: true
        };
      }

      // Mark topic as checked
      await this.pendingTopicsManager.markAsChecked(userId, topic.id);

      proactiveLogger.info(`Generated proactive message`, {
        userId,
        withUserId,
        topicId: topic.id,
        style: messageData.style,
        messageLength: messageData.message?.length
      });

      return {
        success: true,
        message: messageData.message,
        style: messageData.style || 'casual',
        styleDescription: STYLE_DESCRIPTIONS[messageData.style] || '随意轻松',
        reasoning: messageData.reasoning || '',
        topicId: topic.id,
        topic: topic.topic,
        topicIntroduced: messageData.topicIntroduced ?? true,
        alternativeMessages: messageData.alternativeMessages || [],
        isFallback: false
      };
    } catch (error) {
      proactiveLogger.error(`Failed to generate proactive message: ${error.message}`, {
        userId,
        withUserId
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get proactive messaging status for a user
   * @param {string} userId - User ID
   * @param {string} withUserId - Partner user ID
   * @returns {Promise<Object>} Status information
   */
  async getProactiveStatus(userId, withUserId) {
    try {
      const topics = await this.pendingTopicsManager.getTopicsForPartner(userId, withUserId);
      const daysSinceLastChat = await this.getDaysSinceLastChat(userId, withUserId);
      const roleCard = await this.dualStorage.loadRoleCardV2(userId);

      return {
        hasRoleCard: !!roleCard,
        pendingTopicsCount: topics.length,
        highestUrgency: this.getHighestUrgency(topics),
        daysSinceLastChat,
        topics: topics.map(t => ({
          id: t.id,
          topic: t.topic,
          urgency: t.urgency,
          createdAt: t.createdAt,
          checkCount: t.checkCount
        }))
      };
    } catch (error) {
      proactiveLogger.error(`Failed to get proactive status: ${error.message}`, {
        userId,
        withUserId
      });
      throw error;
    }
  }
}

export default ProactiveMessagingManager;
