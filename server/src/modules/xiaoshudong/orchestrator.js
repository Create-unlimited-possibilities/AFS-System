/**
 * XiaoShuDong Orchestrator v2.1
 * 智能渐进式对话编排
 *
 * 设计理念：
 * - 像心理咨询师一样先倾听和引导
 * - 通过多轮对话收集信息
 * - 当用户准备好时，进入深度分析阶段
 *
 * 工作流程：
 * 1. ConversationManager - 评估对话状态并生成回复（倾听阶段直接输出）
 * 2. ChartRetriever -> RAG -> FortuneGenerator -> PsychologistResponse - 分析阶段
 *
 * v2.1 优化：
 * - 倾听阶段：ConversationManager 合并评估和回复，1次LLM调用
 * - 分析阶段：保持不变
 *
 * @author AFS Team
 * @version 2.1.0
 */

import XiaoShuDongState from './state/XiaoShuDongState.js';
import { conversationManagerNode } from './nodes/conversationManager.js';
// listeningResponseNode removed in v2.1 - conversationManager now handles response generation
import { conversationCompressorNode } from './nodes/conversationCompressor.js';
import { chartRetrieverNode } from './nodes/chartRetriever.js';
import { ragRetrieverNode } from './nodes/ragRetriever.js';
import { fortuneGeneratorNode } from './nodes/fortuneGenerator.js';
import { psychologistResponseNode } from './nodes/psychologistResponse.js';
import { getNextNode, shouldContinue, getWorkflowPath } from './edges.js';
import { MemoryStore } from '../memory/index.js';
import logger from '../../core/utils/logger.js';

const orchestrationLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'XIAOSHUDONG_ORCH' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'XIAOSHUDONG_ORCH' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'XIAOSHUDONG_ORCH' }),
};

/**
 * Maximum session age in milliseconds (24 hours)
 */
const MAX_SESSION_AGE = 24 * 60 * 60 * 1000;

/**
 * Maximum concurrent sessions
 */
const MAX_SESSIONS = 1000;

/**
 * Turn count threshold for auto-saving conversation memory
 */
const MEMORY_SAVE_TURN_THRESHOLD = 10;

class XiaoShuDongOrchestrator {
  constructor() {
    // Define all workflow nodes
    // v2.1: listening_response removed - conversationManager generates response directly
    this.nodes = {
      'conversation_manager': conversationManagerNode,
      'conversation_compressor': conversationCompressorNode,
      'chart_retriever': chartRetrieverNode,
      'rag_retriever': ragRetrieverNode,
      'fortune_generator': fortuneGeneratorNode,
      'psychologist_response': psychologistResponseNode,
    };

    // Active sessions: Map<userId, {state: XiaoShuDongState, lastAccess: number}>
    this.activeSessions = new Map();

    // Memory store for saving conversations
    this.memoryStore = new MemoryStore();
  }

  /**
   * Process a message through the workflow
   *
   * @param {string} userId - User ID
   * @param {string} message - User message
   * @param {Object} options - Additional options
   * @param {Object} options.userData - User data for birth info
   * @param {boolean} options.newSession - Force new session
   * @param {boolean} options.forceAnalysis - Skip listening phase, force analysis
   * @returns {Promise<Object>} Response object
   */
  async processMessage(userId, message, options = {}) {
    const startTime = Date.now();

    try {
      orchestrationLogger.info(`[XiaoShuDong] 处理用户消息: ${userId}`);

      // Clean up old sessions periodically
      this.cleanupOldSessions();

      // Get or create session state
      let sessionData = this.activeSessions.get(userId);
      if (!sessionData || options.newSession) {
        sessionData = this.createSession(userId, options.userData);
        this.activeSessions.set(userId, sessionData);
        orchestrationLogger.info(`[XiaoShuDong] 创建新会话: ${userId}`);
      }

      // Update last access time
      sessionData.lastAccess = Date.now();
      const state = sessionData.state;

      // Set current input
      state.currentInput = message;
      state.metadata.processingTime = 0;

      // 如果强制进入分析阶段
      if (options.forceAnalysis) {
        state.metadata.skipListening = true;
        state.conversationPhase = {
          current: 'analysis',
          turnCount: (state.conversationPhase?.turnCount || 0) + 1
        };
      }

      // Execute workflow
      let currentNode = 'conversation_manager';
      let nodeCount = 0;
      const maxNodes = 10; // Safety limit

      while (shouldContinue(currentNode) && nodeCount < maxNodes) {
        const nodeFunction = this.nodes[currentNode];
        if (!nodeFunction) {
          throw new Error('Node not found: ' + currentNode);
        }

        const workflowPath = getWorkflowPath(state);
        orchestrationLogger.info(`[XiaoShuDong] 执行节点: ${currentNode} | 路径: ${workflowPath}`);

        await nodeFunction(state);

        // Get next node based on state
        currentNode = getNextNode(currentNode, state);
        nodeCount += 1;
      }

      if (nodeCount >= maxNodes) {
        orchestrationLogger.warn('[XiaoShuDong] 达到最大节点限制');
      }

      // Calculate processing time
      state.metadata.processingTime = Date.now() - startTime;

      // Add messages to history
      state.addMessage('user', message);
      state.addMessage('assistant', state.finalResponse);

      // Check for memory save triggers
      const turnCount = state.conversationPhase?.turnCount || 0;
      const shouldSaveMemory = turnCount > 0 && turnCount % MEMORY_SAVE_TURN_THRESHOLD === 0;

      if (shouldSaveMemory) {
        // Save conversation memory asynchronously (don't block response)
        this.saveConversationMemory(userId, state).catch(error => {
          orchestrationLogger.error('[XiaoShuDong] 保存记忆失败:', error);
        });
      }

      // Get workflow summary
      const workflowPath = getWorkflowPath(state);
      orchestrationLogger.info(
        `[XiaoShuDong] 完成 | 路径: ${workflowPath} | 耗时: ${state.metadata.processingTime}ms`
      );

      return {
        success: true,
        response: state.finalResponse,
        intent: state.getIntentSummary?.() || '对话',
        phase: state.conversationPhase?.current || 'listening',
        metadata: {
          processingTime: state.metadata.processingTime,
          workflowPath,
          turnCount: state.conversationPhase?.turnCount || 0,
          chartRetrieved: state.metadata.chartRetrieved || false,
          ragRetrieved: state.metadata.ragRetrieved || false,
          fortuneGenerated: state.metadata.fortuneGenerated || false,
          polished: state.metadata.polished || false,
          sessionId: state.metadata.sessionId
        }
      };

    } catch (error) {
      orchestrationLogger.error('[XiaoShuDong] 处理失败:', error);

      return {
        success: false,
        error: error.message,
        response: '抱歉，我现在有点累了，请稍后再和我聊天吧。',
        phase: 'error'
      };
    }
  }

  /**
   * Create a new session
   */
  createSession(userId, userData = null) {
    const sessionId = 'xsd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const state = new XiaoShuDongState({
      userId: userId,
      sessionId: sessionId,
      metadata: {
        userData: userData || null
      }
    });

    // 初始化对话阶段
    state.conversationPhase = {
      current: 'listening',
      turnCount: 0,
      informationGathered: {}
    };

    return {
      state: state,
      lastAccess: Date.now()
    };
  }

  /**
   * Get current session state for user
   */
  getSession(userId) {
    const sessionData = this.activeSessions.get(userId);
    return sessionData ? sessionData.state : null;
  }

  /**
   * Get conversation history for user
   */
  getHistory(userId, limit = 50) {
    const state = this.getSession(userId);
    if (!state) {
      return [];
    }
    return state.messages.slice(-limit);
  }

  /**
   * End session for user
   * Saves conversation memory before ending session
   */
  async endSession(userId) {
    const sessionData = this.activeSessions.get(userId);

    // Save conversation memory before ending
    if (sessionData) {
      try {
        await this.saveConversationMemory(userId, sessionData.state);
        orchestrationLogger.info(`[XiaoShuDong] 会话记忆已保存: ${userId}`);
      } catch (error) {
        orchestrationLogger.error('[XiaoShuDong] 保存会话记忆失败:', error);
        // Continue with session end even if save fails
      }
    }

    const deleted = this.activeSessions.delete(userId);
    if (deleted) {
      orchestrationLogger.info(`[XiaoShuDong] 会话结束: ${userId}`);
    }
    return deleted;
  }

  /**
   * Clean up old sessions
   */
  cleanupOldSessions() {
    const now = Date.now();
    const toDelete = [];

    for (const [userId, sessionData] of this.activeSessions.entries()) {
      if (now - sessionData.lastAccess > MAX_SESSION_AGE) {
        toDelete.push(userId);
      }
    }

    for (const userId of toDelete) {
      this.activeSessions.delete(userId);
    }

    if (toDelete.length > 0) {
      orchestrationLogger.info(`[XiaoShuDong] 清理过期会话: ${toDelete.length} 个`);
    }

    // Enforce max sessions limit
    if (this.activeSessions.size > MAX_SESSIONS) {
      const entries = Array.from(this.activeSessions.entries());
      entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
      const toRemove = entries.slice(0, this.activeSessions.size - MAX_SESSIONS);
      for (const [userId] of toRemove) {
        this.activeSessions.delete(userId);
      }
      orchestrationLogger.info(`[XiaoShuDong] 清理超出限制会话: ${toRemove.length} 个`);
    }
  }

  /**
   * Get current session count
   */
  getSessionCount() {
    return this.activeSessions.size;
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      activeSessions: this.activeSessions.size,
      maxSessions: MAX_SESSIONS,
      version: '2.1.0'
    };
  }

  /**
   * 获取用户当前对话阶段
   */
  getUserPhase(userId) {
    const state = this.getSession(userId);
    return state?.conversationPhase?.current || null;
  }

  /**
   * 强制用户进入分析阶段
   */
  forceAnalysisPhase(userId) {
    const sessionData = this.activeSessions.get(userId);
    if (sessionData) {
      sessionData.state.conversationPhase = {
        ...sessionData.state.conversationPhase,
        current: 'analysis'
      };
      sessionData.state.metadata.readyForAnalysis = true;
      return true;
    }
    return false;
  }

  /**
   * 保存小树洞对话记忆
   * 参考 ChatGraphOrchestrator.saveConversationMemory() 实现
   *
   * @param {string} userId - 用户ID
   * @param {XiaoShuDongState} state - 对话状态
   * @returns {Promise<Object>} 保存结果
   */
  async saveConversationMemory(userId, state) {
    try {
      const messages = state.messages || [];
      // 检查是否有用户消息（避免只保存欢迎消息）
      const hasUserMessage = messages.some(m => m.role === 'user');
      if (!hasUserMessage) {
        orchestrationLogger.info(`[XiaoShuDong] 没有用户消息，跳过记忆存储`);
        return { success: true, skipped: true, reason: 'no_user_message' };
      }
      if (messages.length < 2) {
        orchestrationLogger.info(`[XiaoShuDong] 消息数量不足，跳过记忆存储`);
        return { success: true, skipped: true, reason: 'not_enough_messages' };
      }

      orchestrationLogger.info(`[XiaoShuDong] 开始保存对话记忆 - User: ${userId}, Messages: ${messages.length}`);

      // Format conversation messages
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }));

      // Extract conversation summary for processed content
      const summary = this.extractConversationSummary(state);

      // Identify key topics from conversation
      const keyTopics = this.extractKeyTopics(state);

      // Build memory data structure
      const memoryData = {
        memoryId: `xsd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        meta: {
          createdAt: new Date().toISOString(),
          participants: [userId, 'xiaoshudong'],
          participantRoles: {
            [userId]: 'user',
            xiaoshudong: 'ai_psychologist'
          },
          messageCount: messages.length,
          compressionStage: 'raw',
          sessionId: state.sessionId || state.metadata.sessionId
        },
        content: {
          raw: JSON.stringify(formattedMessages),
          processed: {
            summary: summary,
            keyTopics: keyTopics,
            emotionalJourney: this.extractEmotionalJourney(state),
            phase: state.conversationPhase?.current || 'listening',
            hasBirthInfo: !!state.natalChart,
            hasHoroscope: !!state.horoscope
          }
        },
        tags: [
          'xiaoshudong',
          'psychological_counseling',
          state.conversationPhase?.current || 'listening',
          ...(keyTopics.map(t => `topic:${t}`))
        ],
        category: 'xiaoshudong'
      };

      // Save to with_xiaoshudong directory
      const result = await this.memoryStore.saveMemory(userId, 'xiaoshudong', memoryData, true);

      orchestrationLogger.info(`[XiaoShuDong] 对话记忆保存成功 - MemoryID: ${result.memoryId}`);

      return {
        success: true,
        memoryId: result.memoryId,
        filePath: result.filePath,
        messageCount: messages.length
      };

    } catch (error) {
      orchestrationLogger.error('[XiaoShuDong] 保存对话记忆失败:', error);
      // Don't throw error to avoid disrupting main flow
      return { success: false, error: error.message };
    }
  }

  /**
   * 提取对话摘要
   * @param {XiaoShuDongState} state - 对话状态
   * @returns {string} 对话摘要
   */
  extractConversationSummary(state) {
    const messages = state.messages || [];
    if (messages.length === 0) return '空对话';

    // Get first user message as topic starter
    const firstUserMsg = messages.find(m => m.role === 'user');
    const topicStarter = firstUserMsg?.content?.substring(0, 50) || '对话';

    // Count emotional turns
    const emotionalTurns = state.emotionalTurns || 0;
    const phase = state.conversationPhase?.current || 'listening';

    // Build summary
    const summaryParts = [
      `${topicStarter}${firstUserMsg?.content?.length > 50 ? '...' : ''}`,
      `${messages.length}轮对话`,
      `阶段: ${phase === 'listening' ? '倾听' : phase === 'analysis' ? '分析' : phase}`,
      emotionalTurns > 0 ? `情感交流${emotionalTurns}次` : ''
    ].filter(Boolean);

    return summaryParts.join(' | ');
  }

  /**
   * 提取关键话题
   * @param {XiaoShuDongState} state - 对话状态
   * @returns {Array<string>} 关键话题列表
   */
  extractKeyTopics(state) {
    const topics = [];

    // Check for common psychological topics
    const messages = state.messages || [];
    const allText = messages.map(m => m.content || '').join(' ');

    const topicPatterns = {
      '情绪': ['难过', '开心', '焦虑', '抑郁', '压力', '愤怒', '委屈'],
      '感情': ['恋爱', '分手', '暗恋', '婚姻', '前任', '表白'],
      '事业': ['工作', '辞职', '升职', '面试', '创业', '职场'],
      '学业': ['考试', '学习', '学校', '专业', '毕业', '考研'],
      '家庭': ['父母', '家庭', '亲情', '子女', '婆媳'],
      '健康': ['生病', '健康', '失眠', '疲劳'],
      '运势': ['命盘', '运势', '流年', '紫微', '八字']
    };

    for (const [topic, patterns] of Object.entries(topicPatterns)) {
      if (patterns.some(p => allText.includes(p))) {
        topics.push(topic);
      }
    }

    // Add phase-specific topics
    if (state.conversationPhase?.current === 'analysis') {
      topics.push('命理分析');
    }

    return topics.length > 0 ? topics : ['日常对话'];
  }

  /**
   * 提取情感历程
   * @param {XiaoShuDongState} state - 对话状态
   * @returns {string} 情感历程描述
   */
  extractEmotionalJourney(state) {
    const phase = state.conversationPhase?.current || 'listening';
    const emotionalTurns = state.emotionalTurns || 0;
    const innerVoiceDetected = state.innerVoiceDetected || false;

    if (phase === 'listening') {
      if (emotionalTurns > 3) {
        return '深入情感倾诉阶段';
      } else if (emotionalTurns > 0) {
        return '初步情感交流';
      }
      return '倾听了解阶段';
    } else if (phase === 'analysis') {
      if (innerVoiceDetected) {
        return '深入自我探索与命理分析';
      }
      return '命理分析与建议阶段';
    }

    return '对话交流中';
  }
}

// Export singleton instance
export default new XiaoShuDongOrchestrator();
