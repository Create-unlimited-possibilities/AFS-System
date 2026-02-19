/**
 * SessionManager - Chat Session Timeout Handler
 * Manages session lifecycle with 30-minute inactivity timeout
 * Automatically saves conversation as memory on timeout
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { MemoryStore, MemoryExtractor } from '../memory/index.js';
import ChatSession from './model.js';
import User from '../user/model.js';
import RolecardStorage from '../../core/storage/rolecard.js';
import logger from '../../core/utils/logger.js';

const sessionLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'SESSION_MANAGER' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'SESSION_MANAGER' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'SESSION_MANAGER' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'SESSION_MANAGER' }),
};

class SessionManager {
  constructor() {
    // Active sessions map: sessionId -> { lastActivity, timeoutHandle, sessionData }
    this.activeSessions = new Map();

    // 30 minute timeout
    this.TIMEOUT_MS = 30 * 60 * 1000;

    // Memory management
    this.memoryStore = new MemoryStore();
    this.memoryExtractor = new MemoryExtractor();

    sessionLogger.info('SessionManager initialized', {
      timeoutMinutes: this.TIMEOUT_MS / 60000
    });
  }

  /**
   * Register activity for a session, resetting the timeout
   * @param {string} sessionId - Session ID
   * @returns {boolean} Whether the session was found and updated
   */
  registerActivity(sessionId) {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      sessionLogger.debug(`[SessionManager] Session not found for activity: ${sessionId}`);
      return false;
    }

    // Clear existing timeout
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
    }

    // Update last activity time
    session.lastActivity = Date.now();

    // Set new timeout
    session.timeoutHandle = setTimeout(() => {
      this.handleTimeout(sessionId);
    }, this.TIMEOUT_MS);

    sessionLogger.debug(`[SessionManager] Activity registered, timeout reset`, {
      sessionId,
      nextTimeoutIn: `${this.TIMEOUT_MS / 60000} minutes`
    });

    return true;
  }

  /**
   * Start tracking a session with timeout
   * @param {string} sessionId - Session ID
   * @param {Object} sessionData - Session data including user info
   * @returns {void}
   */
  startSession(sessionId, sessionData) {
    // Don't start if already tracking
    if (this.activeSessions.has(sessionId)) {
      sessionLogger.warn(`[SessionManager] Session already being tracked: ${sessionId}`);
      this.registerActivity(sessionId); // Reset timeout
      return;
    }

    // Store session data
    this.activeSessions.set(sessionId, {
      lastActivity: Date.now(),
      timeoutHandle: setTimeout(() => {
        this.handleTimeout(sessionId);
      }, this.TIMEOUT_MS),
      sessionData
    });

    sessionLogger.info(`[SessionManager] Session started with timeout`, {
      sessionId,
      targetUserId: sessionData?.targetUserId,
      interlocutorUserId: sessionData?.interlocutorUserId,
      timeoutMinutes: this.TIMEOUT_MS / 60000
    });
  }

  /**
   * Stop tracking a session (manual end)
   * @param {string} sessionId - Session ID
   * @param {boolean} saveMemory - Whether to save conversation as memory
   * @returns {Promise<boolean>} Whether session was found and stopped
   */
  async stopSession(sessionId, saveMemory = false) {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      sessionLogger.debug(`[SessionManager] Session not found for stopping: ${sessionId}`);
      return false;
    }

    // Clear timeout
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
    }

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    // Save memory if requested
    if (saveMemory && session.sessionData) {
      try {
        await this.saveConversationMemory(session.sessionData);
        sessionLogger.info(`[SessionManager] Session stopped and memory saved`, { sessionId });
      } catch (error) {
        sessionLogger.error(`[SessionManager] Failed to save memory on stop`, {
          sessionId,
          error: error.message
        });
      }
    } else {
      sessionLogger.info(`[SessionManager] Session stopped (no memory save)`, { sessionId });
    }

    return true;
  }

  /**
   * Handle session timeout
   * @param {string} sessionId - Session ID that timed out
   * @returns {Promise<void>}
   */
  async handleTimeout(sessionId) {
    sessionLogger.info(`[SessionManager] Session timeout triggered`, { sessionId });

    const session = this.activeSessions.get(sessionId);

    if (!session) {
      sessionLogger.warn(`[SessionManager] Session not found on timeout: ${sessionId}`);
      return;
    }

    try {
      // Get full session from database
      const chatSession = await ChatSession.findOne({ sessionId });

      if (!chatSession) {
        sessionLogger.error(`[SessionManager] ChatSession not found in DB: ${sessionId}`);
        this.activeSessions.delete(sessionId);
        return;
      }

      // Check if session is still active (might have been ended manually)
      if (!chatSession.isActive) {
        sessionLogger.debug(`[SessionManager] Session already ended, skipping timeout handling`, { sessionId });
        this.activeSessions.delete(sessionId);
        return;
      }

      // Save conversation as memory
      await this.saveConversationMemory({
        ...session.sessionData,
        chatSession
      });

      // Mark session as ended due to timeout
      chatSession.endedAt = new Date();
      chatSession.isActive = false;
      chatSession.terminationReason = 'timeout';
      await chatSession.save();

      // Remove from active tracking
      this.activeSessions.delete(sessionId);

      sessionLogger.info(`[SessionManager] Session timeout handled successfully`, {
        sessionId,
        messageCount: chatSession.messages?.length || 0
      });

    } catch (error) {
      sessionLogger.error(`[SessionManager] Error handling timeout`, {
        sessionId,
        error: error.message,
        stack: error.stack
      });

      // Still remove from active sessions to prevent repeated attempts
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Save conversation as bidirectional memory
   * @param {Object} sessionData - Session data with chatSession
   * @returns {Promise<Object>} Save result
   */
  async saveConversationMemory(sessionData) {
    const { chatSession, targetUserId, interlocutorUserId } = sessionData;

    if (!chatSession) {
      throw new Error('No chatSession provided for memory save');
    }

    const messages = chatSession.messages || [];
    const messageCount = messages.length;

    sessionLogger.info(`[SessionManager] Saving conversation memory`, {
      targetUserId: targetUserId || chatSession.targetUserId,
      interlocutorUserId: interlocutorUserId || chatSession.interlocutorUserId,
      messageCount
    });

    // Skip if no messages
    if (messageCount === 0) {
      sessionLogger.warn(`[SessionManager] No messages to save, skipping`);
      return { saved: false, reason: 'no_messages' };
    }

    const finalTargetUserId = targetUserId || chatSession.targetUserId?.toString();
    const finalInterlocutorUserId = interlocutorUserId || chatSession.interlocutorUserId?.toString();

    // Get user info
    const [targetUser, interlocutorUser] = await Promise.all([
      User.findById(finalTargetUserId),
      User.findById(finalInterlocutorUserId)
    ]);

    if (!targetUser || !interlocutorUser) {
      throw new Error('Users not found for memory save');
    }

    // Get role cards for both users
    const rolecardStorage = new RolecardStorage();
    const [targetRoleCard, interlocutorRoleCard] = await Promise.all([
      rolecardStorage.getLatestRolecard(finalTargetUserId),
      rolecardStorage.getLatestRolecard(finalInterlocutorUserId)
    ]);

    // Format conversation for memory extraction
    const formattedConversation = this.formatConversationForMemory(messages, targetUser.name, interlocutorUser.name);

    // Extract memories for both users (with personality filtering)
    let userAMemory = null;
    let userBMemory = null;

    // User A (target) always gets extracted memory if they have a role card
    if (targetRoleCard) {
      try {
        userAMemory = await this.memoryExtractor.extract({
          roleCard: targetRoleCard,
          roleCardOwnerName: targetUser.name,
          interlocutorName: interlocutorUser.name,
          relationType: chatSession.relation || 'stranger',
          messages: formattedConversation
        });
        sessionLogger.debug(`[SessionManager] Memory extracted for target user`, {
          userId: finalTargetUserId,
          summary: userAMemory.summary?.substring(0, 50)
        });
      } catch (error) {
        sessionLogger.error(`[SessionManager] Failed to extract memory for target user`, {
          error: error.message
        });
      }
    }

    // User B (interlocutor) gets extracted memory only if they have a role card
    if (interlocutorRoleCard) {
      try {
        userBMemory = await this.memoryExtractor.extract({
          roleCard: interlocutorRoleCard,
          roleCardOwnerName: interlocutorUser.name,
          interlocutorName: targetUser.name,
          relationType: chatSession.relation || 'stranger',
          messages: formattedConversation.map(m => ({
            ...m,
            isOwner: !m.isOwner // Flip ownership for other perspective
          }))
        });
        sessionLogger.debug(`[SessionManager] Memory extracted for interlocutor user`, {
          userId: finalInterlocutorUserId,
          summary: userBMemory.summary?.substring(0, 50)
        });
      } catch (error) {
        sessionLogger.error(`[SessionManager] Failed to extract memory for interlocutor user`, {
          error: error.message
        });
      }
    }

    // Save bidirectional memory
    const result = await this.memoryStore.saveBidirectional({
      userAId: finalTargetUserId,
      userBId: finalInterlocutorUserId,
      conversationData: {
        raw: JSON.stringify(formattedConversation),
        messageCount
      },
      userAMemory: userAMemory ? {
        processed: {
          summary: userAMemory.summary,
          topicSummary: userAMemory.topicSummary,
          keyTopics: userAMemory.keyTopics,
          facts: userAMemory.facts,
          emotionalJourney: userAMemory.emotionalJourney,
          memorableMoments: userAMemory.memorableMoments
        },
        pendingTopics: {
          hasUnfinished: (userAMemory.pendingTopics?.length || 0) > 0,
          topics: userAMemory.pendingTopics || []
        },
        personalityFiltered: userAMemory.personalityFiltered,
        tags: userAMemory.tags
      } : null,
      userBMemory: userBMemory ? {
        processed: {
          summary: userBMemory.summary,
          topicSummary: userBMemory.topicSummary,
          keyTopics: userBMemory.keyTopics,
          facts: userBMemory.facts,
          emotionalJourney: userBMemory.emotionalJourney,
          memorableMoments: userBMemory.memorableMoments
        },
        pendingTopics: {
          hasUnfinished: (userBMemory.pendingTopics?.length || 0) > 0,
          topics: userBMemory.pendingTopics || []
        },
        personalityFiltered: userBMemory.personalityFiltered,
        tags: userBMemory.tags
      } : null,
      userBHasRoleCard: !!interlocutorRoleCard
    });

    sessionLogger.info(`[SessionManager] Conversation memory saved bidirectionally`, {
      userAMemoryId: result.userA?.memoryId,
      userBMemoryId: result.userB?.memoryId
    });

    return result;
  }

  /**
   * Format messages array for memory extraction
   * @param {Array} messages - Chat messages
   * @param {string} ownerName - Role card owner name
   * @param {string} partnerName - Conversation partner name
   * @returns {Array} Formatted messages
   */
  formatConversationForMemory(messages, ownerName, partnerName) {
    return messages.map(msg => ({
      content: msg.content,
      isOwner: msg.role === 'assistant', // Assistant = role card owner's responses
      speaker: msg.role === 'assistant' ? ownerName : partnerName,
      timestamp: msg.timestamp
    }));
  }

  /**
   * Check if a session is currently active
   * @param {string} sessionId - Session ID
   * @returns {boolean} Whether session is active
   */
  isActive(sessionId) {
    return this.activeSessions.has(sessionId);
  }

  /**
   * Get time until timeout for a session
   * @param {string} sessionId - Session ID
   * @returns {number|null} Milliseconds until timeout, or null if not tracked
   */
  getTimeUntilTimeout(sessionId) {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return null;
    }

    const elapsed = Date.now() - session.lastActivity;
    const remaining = this.TIMEOUT_MS - elapsed;

    return Math.max(0, remaining);
  }

  /**
   * Get all active session IDs
   * @returns {string[]} Array of active session IDs
   */
  getActiveSessionIds() {
    return Array.from(this.activeSessions.keys());
  }

  /**
   * Get count of active sessions
   * @returns {number} Number of active sessions
   */
  getActiveSessionCount() {
    return this.activeSessions.size;
  }

  /**
   * Clean up all sessions (for server shutdown)
   * @returns {Promise<void>}
   */
  async cleanup() {
    sessionLogger.info(`[SessionManager] Cleaning up ${this.activeSessions.size} active sessions`);

    const savePromises = [];

    for (const [sessionId, session] of this.activeSessions.entries()) {
      // Clear timeout
      if (session.timeoutHandle) {
        clearTimeout(session.timeoutHandle);
      }

      // Save memory for each session
      if (session.sessionData) {
        savePromises.push(
          this.saveConversationMemory(session.sessionData)
            .catch(error => {
              sessionLogger.error(`[SessionManager] Failed to save memory during cleanup`, {
                sessionId,
                error: error.message
              });
            })
        );
      }
    }

    // Wait for all saves to complete
    await Promise.allSettled(savePromises);

    // Clear all sessions
    this.activeSessions.clear();

    sessionLogger.info(`[SessionManager] Cleanup completed`);
  }
}

// Export singleton instance
let sessionManagerInstance = null;

export function getSessionManager() {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}

export default SessionManager;
