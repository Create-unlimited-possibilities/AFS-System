/**
 * LangGraph Orchestrator V2
 * Manages conversation flow using LangGraph implementation
 *
 * @author AFS Team
 * @version 2.1.0
 */

import ConversationState from './state/ConversationState.js';
import { edges, conditionalEdges } from './edges/edges.js';
import { inputProcessorNode } from './nodes/inputProcessor.js';
import { tokenMonitorNode } from './nodes/tokenMonitor.js';
import { memoryCheckNode } from './nodes/memoryCheck.js';
import { ragRetrieverNode } from './nodes/ragRetriever.js';
import { contextBuilderNode } from './nodes/contextBuilder.js';
import { responseGeneratorNode } from './nodes/responseGenerator.js';
import { tokenResponseNode } from './nodes/tokenResponse.js';
import { outputFormatterNode } from './nodes/outputFormatter.js';
import ChatSession from './model.js';
import User from '../user/model.js';
import AssistRelation from '../assist/model.js';
import DualStorage from '../../core/storage/dual.js';
import { PromptAssembler } from '../rolecard/v2/index.js';
import { MemoryStore, MemoryExtractor } from '../memory/index.js';
import TopicChunker from '../memory/TopicChunker.js';
import UnreadMessage from './models/UnreadMessage.js';
import logger from '../../core/utils/logger.js';

class ChatGraphOrchestrator {
  constructor() {
    this.nodes = {
      input_processor: inputProcessorNode,
      token_monitor: tokenMonitorNode,
      memory_check: memoryCheckNode,
      rag_retriever: ragRetrieverNode,
      context_builder: contextBuilderNode,
      response_generator: responseGeneratorNode,
      token_response: tokenResponseNode,
      output_formatter: outputFormatterNode
    };

    this.activeSessions = new Map();
    this.dualStorage = new DualStorage();
    this.promptAssembler = new PromptAssembler();
    this.memoryStore = new MemoryStore();
    this.memoryExtractor = new MemoryExtractor();
    this.topicChunker = new TopicChunker();
  }

  // ==================== Indexing Wait Mechanism ====================

  /**
   * Set session to indexing mode (70% threshold reached)
   * Called when force offline is triggered
   * @param {String} sessionId - Session ID
   * @returns {Promise<Object>} Result
   */
  async setSessionIndexing(sessionId) {
    try {
      logger.info(`[ChatGraphOrchestrator] Setting session to indexing mode: ${sessionId}`);

      const session = await ChatSession.setIndexing(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Update in-memory session if exists
      const sessionData = this.activeSessions.get(sessionId);
      if (sessionData) {
        sessionData.session.sessionStatus = 'indexing';
        sessionData.session.indexingStartedAt = new Date();
      }

      logger.info(`[ChatGraphOrchestrator] Session ${sessionId} is now in indexing mode`);

      return {
        success: true,
        sessionId,
        status: 'indexing',
        message: 'Session is now in indexing mode. Incoming messages will be stored as pending.'
      };
    } catch (error) {
      logger.error('[ChatGraphOrchestrator] Failed to set indexing mode:', error);
      throw error;
    }
  }

  /**
   * Set session back to active mode (indexing completed)
   * @param {String} sessionId - Session ID
   * @returns {Promise<Object>} Result with pending messages
   */
  async setSessionActive(sessionId) {
    try {
      logger.info(`[ChatGraphOrchestrator] Setting session back to active: ${sessionId}`);

      const session = await ChatSession.setActive(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Update in-memory session if exists
      const sessionData = this.activeSessions.get(sessionId);
      if (sessionData) {
        sessionData.session.sessionStatus = 'active';
        sessionData.session.indexingStartedAt = undefined;
      }

      // Get pending messages for this session
      const pendingMessages = await UnreadMessage.find({
        sessionId,
        status: 'pending'
      }).sort({ timestamp: 1 });

      logger.info(`[ChatGraphOrchestrator] Session ${sessionId} is now active. ${pendingMessages.length} pending messages.`);

      return {
        success: true,
        sessionId,
        status: 'active',
        pendingMessageCount: pendingMessages.length,
        pendingMessages
      };
    } catch (error) {
      logger.error('[ChatGraphOrchestrator] Failed to set active mode:', error);
      throw error;
    }
  }

  /**
   * Check if session is in indexing mode
   * @param {String} sessionId - Session ID
   * @returns {Promise<Boolean>} True if indexing
   */
  async isSessionIndexing(sessionId) {
    try {
      // Check in-memory first for performance
      const sessionData = this.activeSessions.get(sessionId);
      if (sessionData?.session?.sessionStatus === 'indexing') {
        return true;
      }

      // Fall back to database check
      return await ChatSession.isIndexing(sessionId);
    } catch (error) {
      logger.error('[ChatGraphOrchestrator] Failed to check indexing status:', error);
      return false;
    }
  }

  /**
   * Store message as pending when session is indexing
   * @param {String} sessionId - Session ID
   * @param {String} message - Message content
   * @param {Object} sessionData - Session data with user IDs
   * @returns {Promise<Object>} Created pending message
   */
  async storePendingMessage(sessionId, message, sessionData) {
    try {
      const pendingMessage = await UnreadMessage.createPending({
        sessionId,
        targetUserId: sessionData.session.targetUserId,
        interlocutorUserId: sessionData.session.interlocutorUserId,
        content: message
      });

      logger.info(`[ChatGraphOrchestrator] Stored pending message for session ${sessionId}`);

      return {
        success: true,
        pending: true,
        messageId: pendingMessage._id,
        message: 'Session is indexing. Message stored as pending.'
      };
    } catch (error) {
      logger.error('[ChatGraphOrchestrator] Failed to store pending message:', error);
      throw error;
    }
  }

  /**
   * Process pending messages after indexing completes
   * @param {String} sessionId - Session ID
   * @returns {Promise<Object>} Processing result
   */
  async processPendingMessages(sessionId) {
    try {
      logger.info(`[ChatGraphOrchestrator] Processing pending messages for session ${sessionId}`);

      // First, set session back to active
      await this.setSessionActive(sessionId);

      const pendingMessages = await UnreadMessage.find({
        sessionId,
        status: 'pending'
      }).sort({ timestamp: 1 });

      if (pendingMessages.length === 0) {
        return {
          success: true,
          processedCount: 0,
          message: 'No pending messages to process'
        };
      }

      const results = [];
      const messageIds = [];

      for (const pendingMsg of pendingMessages) {
        messageIds.push(pendingMsg._id);

        // Process each pending message through the normal flow
        // Session is now active, so sendMessage will process normally
        try {
          const result = await this.sendMessage(sessionId, pendingMsg.content);
          results.push({
            messageId: pendingMsg._id,
            success: result.success,
            response: result.message
          });
        } catch (msgError) {
          logger.error(`[ChatGraphOrchestrator] Failed to process pending message ${pendingMsg._id}:`, msgError);
          results.push({
            messageId: pendingMsg._id,
            success: false,
            error: msgError.message
          });
        }
      }

      // Mark all as indexed
      await UnreadMessage.markAsIndexed(messageIds);

      logger.info(`[ChatGraphOrchestrator] Processed ${results.length} pending messages`);

      return {
        success: true,
        processedCount: results.length,
        results
      };
    } catch (error) {
      logger.error('[ChatGraphOrchestrator] Failed to process pending messages:', error);
      throw error;
    }
  }

  /**
   * Get session status for external queries
   * @param {String} sessionId - Session ID
   * @returns {Promise<Object>} Session status info
   */
  async getSessionStatus(sessionId) {
    try {
      const session = await ChatSession.findOne({ sessionId });
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const pendingCount = await UnreadMessage.countDocuments({
        sessionId,
        status: 'pending'
      });

      return {
        sessionId,
        status: session.sessionStatus,
        isActive: session.isActive,
        indexingStartedAt: session.indexingStartedAt,
        pendingMessageCount: pendingCount
      };
    } catch (error) {
      logger.error('[ChatGraphOrchestrator] Failed to get session status:', error);
      throw error;
    }
  }

  // ==================== End Indexing Wait Mechanism ====================

  /**
   * 生成周期ID
   * @returns {string} 周期ID
   */
  generateCycleId() {
    return `cycle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 创建新周期
   * @param {Object} session - 会话文档
   * @returns {Object} 新周期对象
   */
  createNewCycle(session) {
    const cycleId = this.generateCycleId();
    const newCycle = {
      cycleId,
      startedAt: new Date(),
      messages: []
    };

    // 初始化cycles数组（如果不存在）
    if (!session.cycles) {
      session.cycles = [];
    }

    session.cycles.push(newCycle);
    session.currentCycleId = cycleId;

    return newCycle;
  }

  /**
   * 获取当前周期
   * @param {Object} session - 会话文档
   * @returns {Object|null} 当前周期对象
   */
  getCurrentCycle(session) {
    if (!session.cycles || !session.currentCycleId) {
      return null;
    }
    return session.cycles.find(c => c.cycleId === session.currentCycleId);
  }

  /**
   * 获取当前周期的消息
   * @param {Object} session - 会话文档
   * @returns {Array} 当前周期的消息
   */
  getCurrentCycleMessages(session) {
    const currentCycle = this.getCurrentCycle(session);
    return currentCycle?.messages || [];
  }

  /**
   * 获取所有周期的消息（用于前端显示）
   * @param {Object} session - 会话文档
   * @returns {Array} 所有消息（按时间排序）
   */
  getAllCycleMessages(session) {
    if (!session.cycles || session.cycles.length === 0) {
      // 向后兼容：使用旧的messages字段
      return session.messages || [];
    }

    const allMessages = [];
    for (const cycle of session.cycles) {
      if (cycle.messages && cycle.messages.length > 0) {
        // 为每条消息添加周期信息
        const messagesWithCycle = cycle.messages.map(msg => ({
          ...msg.toObject ? msg.toObject() : msg,
          cycleId: cycle.cycleId
        }));
        allMessages.push(...messagesWithCycle);
      }
    }

    return allMessages;
  }

  /**
   * 预加载会话数据
   * 在用户点击联系人时调用，提前加载角色卡和复杂关系层
   *
   * @param {Object} options - 预加载选项
   * @param {string} options.targetUserId - 目标用户ID（角色卡主人）
   * @param {string} options.interlocutorUserId - 对话者ID（协助者）
   * @returns {Promise<Object>} 预加载结果
   */
  async preloadSession(options) {
    try {
      const { targetUserId, interlocutorUserId } = options;

      logger.info(`[ChatGraphOrchestrator] 预加载会话 - Target: ${targetUserId}, Interlocutor: ${interlocutorUserId}`);

      // 1. 查找或创建会话
      let session = await ChatSession.findOne({
        targetUserId,
        interlocutorUserId,
        isActive: true
      });

      const targetUser = await User.findById(targetUserId);
      const interlocutorUser = await User.findById(interlocutorUserId);

      if (!targetUser || !interlocutorUser) {
        throw new Error('用户不存在');
      }

      // 2. 检查协助关系
      logger.info(`[ChatGraphOrchestrator] 查询协助关系 - assistantId: ${interlocutorUserId}, targetId: ${targetUserId}`);
      const assistRelation = await AssistRelation.findOne({
        assistantId: interlocutorUserId,
        targetId: targetUserId,
        isActive: true
      });

      logger.info(`[ChatGraphOrchestrator] 协助关系查询结果: ${assistRelation ? '找到' : '未找到'}, assistRelation: ${JSON.stringify(assistRelation?._id)}`);

      const relationType = assistRelation?.relationshipType || 'stranger';
      const specificRelation = assistRelation?.specificRelation || '';

      logger.info(`[ChatGraphOrchestrator] 关系类型: ${relationType}, 具体关系: ${specificRelation}`);

      // 3. 加载角色卡核心层
      const roleCardV2 = await this.dualStorage.loadRoleCardV2(targetUserId);

      if (!roleCardV2) {
        logger.warn(`[ChatGraphOrchestrator] 用户未生成V2角色卡: ${targetUserId}`);
      }

      // 4. 加载复杂关系层（如果不是陌生人）
      let complexRelationLayer = null;
      if (assistRelation && relationType !== 'stranger') {
        const relationLayers = await this.dualStorage.loadAllRelationLayers(targetUserId);

        // 找到对应协助者的复杂关系层
        for (const relationId of Object.keys(relationLayers)) {
          const layer = relationLayers[relationId];
          if (layer.assistantId === interlocutorUserId ||
              layer.assistantId?.toString() === interlocutorUserId) {
            complexRelationLayer = layer;
            break;
          }
        }

        logger.info(`[ChatGraphOrchestrator] ${complexRelationLayer ? '已加载' : '未找到'}复杂关系层`);
      }

      // 5. 构建系统提示词 (systemPrompt)
      let systemPrompt = '';
      if (roleCardV2) {
        try {
          const relationLayers = await this.dualStorage.loadAllRelationLayers(targetUserId);

          // 构建简化的 dynamicData，确保 participants 数组存在
          const dynamicData = {
            participants: [{
              id: interlocutorUserId,
              name: interlocutorUser.name,
              nickname: interlocutorUser.name,
              relationshipWithOwner: {
                specificRelation: complexRelationLayer?.relationMeta?.specificRelation || specificRelation || relationType,
                intimacyLevel: complexRelationLayer?.relationMeta?.intimacyLevel || 'moderate',
                hasRelationLayer: !!complexRelationLayer,
                relationLayerId: complexRelationLayer?.relationId || null  // 修复：使用 relationId 而不是 id
              },
              assistantPersonality: null
            }],
            roleCardOwner: {
              id: targetUserId,
              name: targetUser.name,
              nickname: targetUser.name
            }
          };

          logger.info(`[ChatGraphOrchestrator] 关系信息 - specificRelation: ${dynamicData.participants[0].relationshipWithOwner.specificRelation}, relationLayerId: ${dynamicData.participants[0].relationshipWithOwner.relationLayerId}`);

          const assembleResult = this.promptAssembler.assemble({
            coreLayer: roleCardV2.coreLayer,
            relationLayers: relationLayers,
            guardrails: roleCardV2.safetyGuardrails,
            dynamicData: dynamicData,
            calibration: roleCardV2.calibration
          });
          systemPrompt = assembleResult.systemPrompt;
          logger.info(`[ChatGraphOrchestrator] 系统提示词已构建 - 长度: ${systemPrompt.length}`);
        } catch (assembleError) {
          logger.warn(`[ChatGraphOrchestrator] 系统提示词构建失败，使用默认: ${assembleError.message}`);
          systemPrompt = `你是${targetUser.name}，一位友善的长者。请以亲切、自然的方式与对话者交流。`;
        }
      } else {
        // 如果没有角色卡，使用默认提示词
        systemPrompt = `你是${targetUser.name}，一位友善的长者。请以亲切、自然的方式与对话者交流。`;
        logger.info(`[ChatGraphOrchestrator] 使用默认系统提示词`);
      }

      // 6. 如果没有会话，创建新会话
      if (!session) {
        const sessionId = this.generateSessionId();
        const initialCycleId = this.generateCycleId();

        session = new ChatSession({
          sessionId,
          targetUserId,
          interlocutorUserId,
          relation: relationType,
          sentimentScore: 50,
          startedAt: new Date(),
          lastMessageAt: new Date(),
          isActive: true,
          cycles: [{
            cycleId: initialCycleId,
            startedAt: new Date(),
            messages: []
          }],
          currentCycleId: initialCycleId
        });
        await session.save();
        logger.info(`[ChatGraphOrchestrator] 创建新会话: ${sessionId}, 初始周期: ${initialCycleId}`);
      } else {
        // 确保现有会话有周期结构
        if (!session.cycles || session.cycles.length === 0) {
          // 迁移旧数据：将现有消息移入第一个周期
          const initialCycleId = this.generateCycleId();
          session.cycles = [{
            cycleId: initialCycleId,
            startedAt: session.startedAt || new Date(),
            messages: session.messages || []
          }];
          session.currentCycleId = initialCycleId;
          await session.save();
          logger.info(`[ChatGraphOrchestrator] 迁移会话到周期结构: ${session.sessionId}`);
        } else if (!session.currentCycleId) {
          // 确保有当前周期ID
          session.currentCycleId = session.cycles[session.cycles.length - 1].cycleId;
          await session.save();
        }
      }

      // 7. 创建对话状态并缓存
      // 使用当前周期的消息作为上下文
      const currentCycleMessages = this.getCurrentCycleMessages(session);

      const state = new ConversationState({
        userId: targetUserId,
        userName: targetUser.name,
        systemPrompt: systemPrompt,
        interlocutor: {
          id: interlocutorUserId,
          name: interlocutorUser.name,
          relationType,
          specificRelation: complexRelationLayer?.relationMeta?.specificRelation || specificRelation || relationType,
          specificId: interlocutorUserId  // 修复：使用用户ID而不是MongoDB ObjectId
        },
        messages: currentCycleMessages,
        metadata: {
          sessionId: session.sessionId,
          currentCycleId: session.currentCycleId,
          preloaded: true,
          hasComplexRelationLayer: !!complexRelationLayer,
          roleCardLoaded: !!roleCardV2
        }
      });

      // 存储预加载数据
      this.activeSessions.set(session.sessionId, {
        state,
        session,
        roleCard: roleCardV2,
        complexRelationLayer,
        preloadedAt: new Date()
      });

      logger.info(`[ChatGraphOrchestrator] 预加载完成 - Session: ${session.sessionId}, Cycle: ${session.currentCycleId}`);

      // 获取所有周期的消息用于判断是否有历史
      const allMessages = this.getAllCycleMessages(session);

      return {
        sessionId: session.sessionId,
        currentCycleId: session.currentCycleId,
        cycleCount: session.cycles?.length || 0,
        targetUser: {
          id: targetUser._id,
          name: targetUser.name,
          uniqueCode: targetUser.uniqueCode
        },
        interlocutorUser: {
          id: interlocutorUser._id,
          name: interlocutorUser.name
        },
        relation: {
          type: relationType,
          specific: specificRelation
        },
        preloaded: true,
        hasComplexRelationLayer: !!complexRelationLayer,
        hasHistory: allMessages.length > 0
      };

    } catch (error) {
      logger.error('[ChatGraphOrchestrator] 预加载失败:', error);
      throw error;
    }
  }

  /**
   * 创建会话（兼容旧API，内部调用预加载）
   */
  async createSession(options) {
    return this.preloadSession(options);
  }

  /**
   * 发送消息
   * @param {string} sessionId - 会话ID
   * @param {string} message - 消息内容
   * @returns {Promise<Object>} 对话结果
   */
  async sendMessage(sessionId, message) {
    try {
      logger.info(`[ChatGraphOrchestrator] 发送消息 - Session: ${sessionId}`);

      let sessionData = this.activeSessions.get(sessionId);

      // 如果会话不在内存中，尝试从数据库恢复
      if (!sessionData) {
        const session = await ChatSession.findOne({ sessionId, isActive: true });
        if (!session) {
          throw new Error(`会话不存在: ${sessionId}`);
        }

        // 恢复会话状态
        const targetUser = await User.findById(session.targetUserId);
        const interlocutorUser = await User.findById(session.interlocutorUserId);

        // 确保会话有周期结构
        if (!session.cycles || session.cycles.length === 0) {
          // 迁移旧数据：将现有消息移入第一个周期
          const initialCycleId = this.generateCycleId();
          session.cycles = [{
            cycleId: initialCycleId,
            startedAt: session.startedAt || new Date(),
            messages: session.messages || []
          }];
          session.currentCycleId = initialCycleId;
          await session.save();
          logger.info(`[ChatGraphOrchestrator] 恢复时迁移会话到周期结构: ${sessionId}`);
        } else if (!session.currentCycleId) {
          session.currentCycleId = session.cycles[session.cycles.length - 1].cycleId;
          await session.save();
        }

        // 尝试加载角色卡并构建系统提示词
        let systemPrompt = '';
        try {
          const roleCardV2 = await this.dualStorage.loadRoleCardV2(session.targetUserId);
          if (roleCardV2) {
            const relationLayers = await this.dualStorage.loadAllRelationLayers(session.targetUserId);

            // 构建简化的 dynamicData
            const dynamicData = {
              participants: [{
                id: session.interlocutorUserId,
                name: interlocutorUser?.name || '对话者',
                nickname: interlocutorUser?.name || '对话者',
                relationshipWithOwner: {
                  specificRelation: session.relation || '朋友',
                  intimacyLevel: 'moderate',
                  hasRelationLayer: false,
                  relationLayerId: null
                },
                assistantPersonality: null
              }],
              roleCardOwner: {
                id: session.targetUserId,
                name: targetUser?.name || '用户',
                nickname: targetUser?.name || '用户'
              }
            };

            const assembleResult = this.promptAssembler.assemble({
              coreLayer: roleCardV2.coreLayer,
              relationLayers: relationLayers,
              guardrails: roleCardV2.safetyGuardrails,
              dynamicData: dynamicData,
              calibration: roleCardV2.calibration
            });
            systemPrompt = assembleResult.systemPrompt;
          }
        } catch (assembleError) {
          logger.warn(`[ChatGraphOrchestrator] 恢复会话时系统提示词构建失败: ${assembleError.message}`);
        }

        // 如果没有构建成功，使用默认提示词
        if (!systemPrompt) {
          systemPrompt = `你是${targetUser?.name || '一位长者'}，请以亲切、自然的方式与对话者交流。`;
        }

        // 使用当前周期的消息
        const currentCycleMessages = this.getCurrentCycleMessages(session);

        sessionData = {
          state: new ConversationState({
            userId: session.targetUserId,
            userName: targetUser?.name || '未知用户',
            systemPrompt: systemPrompt,
            interlocutor: {
              id: session.interlocutorUserId,
              relationType: session.relation,
              specificId: session.interlocutorUserId  // 修复：使用用户ID
            },
            messages: currentCycleMessages,
            metadata: {
              sessionId,
              currentCycleId: session.currentCycleId
            }
          }),
          session
        };

        this.activeSessions.set(sessionId, sessionData);
      }

      // Check if session is in indexing mode - store message as pending
      if (sessionData.session.sessionStatus === 'indexing') {
        logger.info(`[ChatGraphOrchestrator] Session ${sessionId} is indexing, storing message as pending`);
        return await this.storePendingMessage(sessionId, message, sessionData);
      }

      const { state } = sessionData;
      state.currentInput = message;

      const result = await this.executeGraph(state);

      // 检查执行是否成功
      if (result.success === false) {
        // LLM 生成失败，不保存消息
        logger.warn(`[ChatGraphOrchestrator] 消息生成失败，不保存 - Error: ${result.error}`);
        return {
          success: false,
          error: result.error || 'LLM 生成失败'
        };
      }

      const aiResponse = result.message;

      // 将AI回复分割为句子（以。！？为分隔符）
      const sentences = aiResponse.split(/([。！？])/).filter(s => s.trim());

      // 组合句子和标点符号
      const combinedSentences = [];
      for (let i = 0; i < sentences.length; i += 2) {
        const sentence = sentences[i] + (sentences[i + 1] || '');
        if (sentence.trim()) {
          combinedSentences.push(sentence.trim());
        }
      }

      // 获取当前周期ID
      const currentCycleId = sessionData.session.currentCycleId;

      // 如果只有一句或为空，直接保存
      if (combinedSentences.length <= 1) {
        state.addMessage('user', message);
        state.addMessage('assistant', aiResponse);

        // 保存到当前周期
        await ChatSession.findOneAndUpdate(
          { sessionId, 'cycles.cycleId': currentCycleId },
          {
            $push: {
              'cycles.$.messages': [
                { role: 'user', content: message, timestamp: new Date() },
                { role: 'assistant', content: aiResponse, timestamp: new Date() }
              ]
            },
            lastMessageAt: new Date()
          }
        );
      } else {
        // 分割保存：用户消息 + 多条AI句子
        state.addMessage('user', message);
        for (const sentence of combinedSentences) {
          state.addMessage('assistant', sentence);
        }

        // 数据库：用户消息 + 多条AI句子，保存到当前周期
        const messagesToSave = [
          { role: 'user', content: message, timestamp: new Date() }
        ];
        for (const sentence of combinedSentences) {
          messagesToSave.push({
            role: 'assistant',
            content: sentence,
            timestamp: new Date()
          });
        }

        await ChatSession.findOneAndUpdate(
          { sessionId, 'cycles.cycleId': currentCycleId },
          {
            $push: { 'cycles.$.messages': { $each: messagesToSave } },
            lastMessageAt: new Date()
          }
        );
      }

      // Check for end session triggers (force offline or normal end intent)
      let cycleEnded = false;
      let forceOffline = false;

      if (state.metadata?.shouldEndSession) {
        // Determine if this was a forced offline (70% threshold)
        forceOffline = state.metadata?.forceOffline || false;

        logger.info(`[ChatGraphOrchestrator] 检测到结束意图，保存记忆并开启新周期 - Force Offline: ${forceOffline}`);

        // Save conversation memory with interruption flag
        await this.saveConversationMemory(sessionId, state, forceOffline);

        // If force offline, set session to indexing mode
        if (forceOffline) {
          await this.setSessionIndexing(sessionId);
        }

        // End current cycle and start new cycle
        cycleEnded = await this.startNewCycle(sessionId, sessionData);
      }

      return {
        success: true,
        message: aiResponse,
        sentences: combinedSentences,  // Return split sentences for frontend use
        shouldEndSession: state.metadata?.shouldEndSession || false,
        forceOffline: forceOffline,
        showFatiguePrompt: state.metadata?.showFatiguePrompt || false,
        fatiguePromptType: state.metadata?.fatiguePromptType || null,
        usagePercent: state.metadata?.usagePercent || 0,
        cycleEnded,  // Tell frontend if cycle ended
        currentCycleId: sessionData.session.currentCycleId,  // Return current cycle ID
        sessionStatus: sessionData.session.sessionStatus  // Return session status
      };
    } catch (error) {
      logger.error('[ChatGraphOrchestrator] 发送消息失败:', error);
      // 返回失败结果而不是抛出异常
      return {
        success: false,
        error: error.message || '发送消息失败'
      };
    }
  }

  /**
   * 结束当前周期并开启新周期
   * @param {string} sessionId - 会话ID
   * @param {Object} sessionData - 会话数据
   * @returns {Promise<boolean>} 是否成功开启新周期
   */
  async startNewCycle(sessionId, sessionData) {
    try {
      const { session, state } = sessionData;
      const oldCycleId = session.currentCycleId;

      // 结束当前周期
      await ChatSession.findOneAndUpdate(
        { sessionId, 'cycles.cycleId': oldCycleId },
        { 'cycles.$.endedAt': new Date() }
      );

      // 创建新周期
      const newCycleId = this.generateCycleId();
      const newCycle = {
        cycleId: newCycleId,
        startedAt: new Date(),
        messages: []
      };

      // 添加新周期并更新当前周期ID
      await ChatSession.findOneAndUpdate(
        { sessionId },
        {
          $push: { cycles: newCycle },
          $set: { currentCycleId: newCycleId }
        }
      );

      // 更新内存中的会话数据
      session.cycles.push(newCycle);
      session.currentCycleId = newCycleId;

      // 清空状态中的消息历史，开启新上下文
      state.messages = [];
      state.metadata.currentCycleId = newCycleId;

      logger.info(`[ChatGraphOrchestrator] 周期切换成功 - 旧周期: ${oldCycleId}, 新周期: ${newCycleId}`);

      return true;
    } catch (error) {
      logger.error('[ChatGraphOrchestrator] 开启新周期失败:', error);
      return false;
    }
  }

  /**
   * 结束会话并更新记忆
   * @param {string} sessionId - 会话ID
   * @returns {Promise<Object>} 结束结果
   */
  async endSession(sessionId) {
    try {
      logger.info(`[ChatGraphOrchestrator] 结束会话 - Session: ${sessionId}`);

      const sessionData = this.activeSessions.get(sessionId);
      if (!sessionData) {
        throw new Error(`会话不存在: ${sessionId}`);
      }

      const { session, state } = sessionData;

      // 保存对话记忆
      await this.saveConversationMemory(sessionId, state);

      // 更新会话状态
      session.endedAt = new Date();
      session.isActive = false;
      await session.save();

      this.activeSessions.delete(sessionId);

      logger.info(`[ChatGraphOrchestrator] 会话结束成功`);

      return {
        success: true,
        sessionId,
        messageCount: state.messages?.length || 0
      };
    } catch (error) {
      logger.error('[ChatGraphOrchestrator] 结束会话失败:', error);
      throw error;
    }
  }

  /**
   * 保存对话记忆
   * @param {string} sessionId - 会话ID
   * @param {Object} state - 对话状态
   * @param {boolean} wasInterrupted - Whether conversation was interrupted (e.g., by force offline)
   */
  async saveConversationMemory(sessionId, state, wasInterrupted = false) {
    try {
      const messages = state.messages || [];
      if (messages.length < 2) {
        logger.info(`[ChatGraphOrchestrator] 消息数量不足，跳过记忆存储`);
        return;
      }

      const targetUserId = state.userId;
      const interlocutorId = state.interlocutor?.id;

      if (!targetUserId || !interlocutorId) {
        logger.warn(`[ChatGraphOrchestrator] 缺少用户ID，跳过记忆存储`);
        return;
      }

      logger.info(`[ChatGraphOrchestrator] 开始保存对话记忆 - Target: ${targetUserId}, Interlocutor: ${interlocutorId}, Interrupted: ${wasInterrupted}`);

      // Get role card
      const roleCardV2 = await this.dualStorage.loadRoleCardV2(targetUserId);

      // Format conversation messages
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        isOwner: msg.role === 'assistant'
      }));

      // Use MemoryExtractor with TopicChunker for topic-based memory storage
      if (roleCardV2) {
        try {
          // Extract with chunking - uses TopicChunker internally
          const chunkedResult = await this.memoryExtractor.extractWithChunking({
            roleCard: roleCardV2,
            roleCardOwnerName: state.userName || '用户',
            interlocutorName: state.interlocutor?.name || '对话者',
            relationType: state.interlocutor?.relationType || 'stranger',
            messages: formattedMessages,
            wasInterrupted
          });

          logger.info(`[ChatGraphOrchestrator] 记忆分块提取完成 - Chunks: ${chunkedResult.totalChunks}, Incomplete: ${chunkedResult.hasIncompleteTopics}`);

          // Save each chunk as separate memory
          const savedMemories = [];
          for (const chunk of chunkedResult.chunks) {
            const memoryData = {
              content: {
                raw: JSON.stringify(chunk.messages),
                processed: {
                  summary: chunk.summary,
                  topicSummary: chunk.topicSummary,
                  keyTopics: chunk.keyTopics,
                  facts: chunk.facts,
                  emotionalJourney: chunk.emotionalJourney,
                  memorableMoments: chunk.memorableMoments
                }
              },
              pendingTopics: {
                hasUnfinished: chunk.isIncomplete,
                topics: chunk.isIncomplete ? [{
                  topic: chunk.topicSummary,
                  context: chunk.summary,
                  suggestedFollowUp: chunk.suggestedFollowUp,
                  urgency: 'medium'
                }] : []
              },
              personalityFiltered: chunk.personalityFiltered,
              tags: [...(chunk.tags || []), chunk.isIncomplete ? 'incomplete_topic' : 'complete'],
              meta: {
                chunkId: chunk.chunkId || chunk.id,
                chunkIndex: chunk.chunkIndex,
                totalChunks: chunkedResult.totalChunks,
                completenessScore: chunk.completenessScore
              }
            };

            const saved = await this.memoryStore.saveBidirectional({
              userAId: targetUserId,
              userBId: interlocutorId,
              conversationData: memoryData.content,
              userAMemory: {
                processed: memoryData.content.processed,
                tags: memoryData.tags,
                pendingTopics: memoryData.pendingTopics,
                personalityFiltered: memoryData.personalityFiltered,
                meta: memoryData.meta
              }
            });
            savedMemories.push(saved);
          }

          logger.info(`[ChatGraphOrchestrator] 对话记忆保存成功 - Saved ${savedMemories.length} chunks`);

          return {
            success: true,
            totalChunks: chunkedResult.totalChunks,
            hasIncompleteTopics: chunkedResult.hasIncompleteTopics,
            savedMemories
          };

        } catch (chunkError) {
          logger.warn(`[ChatGraphOrchestrator] 分块记忆提取失败，使用单块模式: ${chunkError.message}`);

          // Fallback: Use single extraction without chunking
          const extractedMemory = await this.memoryExtractor.extract({
            roleCard: roleCardV2,
            roleCardOwnerName: state.userName || '用户',
            interlocutorName: state.interlocutor?.name || '对话者',
            relationType: state.interlocutor?.relationType || 'stranger',
            messages: formattedMessages
          });

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

          logger.info(`[ChatGraphOrchestrator] 对话记忆保存成功 (fallback模式)`);

          return {
            success: true,
            fallback: true,
            error: chunkError.message
          };
        }
      } else {
        // No role card - save basic memory
        await this.memoryStore.saveBidirectional({
          userAId: targetUserId,
          userBId: interlocutorId,
          conversationData: {
            raw: JSON.stringify(formattedMessages),
            messageCount: messages.length
          },
          userAMemory: null
        });

        logger.info(`[ChatGraphOrchestrator] 对话记忆保存成功 (无角色卡)`);

        return { success: true, noRoleCard: true };
      }

    } catch (error) {
      logger.error('[ChatGraphOrchestrator] 保存对话记忆失败:', error);
      // Don't throw error to avoid disrupting main flow
      return { success: false, error: error.message };
    }
  }

  /**
   * 执行LangGraph
   * @param {ConversationState} state - 对话状态
   * @returns {Promise<Object>} 执行结果
   */
  async executeGraph(state) {
    try {
      logger.info('[ChatGraphOrchestrator] 开始执行LangGraph');

      let currentNode = 'input_processor';
      const executionHistory = [];
      const nodeTimings = {}; // 记录每个节点的耗时
      const totalStartTime = Date.now();

      while (currentNode && currentNode !== 'output_formatter') {
        const nodeFunction = this.nodes[currentNode];
        if (!nodeFunction) {
          throw new Error(`节点不存在: ${currentNode}`);
        }

        const nodeStartTime = Date.now();
        logger.info(`[ChatGraphOrchestrator] 执行节点: ${currentNode}`);

        await nodeFunction(state);

        const nodeEndTime = Date.now();
        const nodeDuration = nodeEndTime - nodeStartTime;
        nodeTimings[currentNode] = nodeDuration;

        logger.info(`[ChatGraphOrchestrator] 节点 ${currentNode} 完成，耗时: ${nodeDuration}ms`);

        executionHistory.push({
          node: currentNode,
          timestamp: new Date(),
          duration: nodeDuration
        });

        currentNode = this.getNextNode(currentNode, state);
      }

      if (currentNode === 'output_formatter') {
        const nodeStartTime = Date.now();
        const result = await this.nodes['output_formatter'](state);
        const nodeDuration = Date.now() - nodeStartTime;
        nodeTimings['output_formatter'] = nodeDuration;

        const totalDuration = Date.now() - totalStartTime;

        // 输出详细的性能报告
        logger.info('='.repeat(60));
        logger.info('[ChatGraphOrchestrator] 性能报告:');
        for (const [node, duration] of Object.entries(nodeTimings)) {
          const percentage = ((duration / totalDuration) * 100).toFixed(1);
          logger.info(`  ${node}: ${duration}ms (${percentage}%)`);
        }
        logger.info(`[ChatGraphOrchestrator] 总耗时: ${totalDuration}ms`);
        logger.info('='.repeat(60));

        return result;
      }

      throw new Error('LangGraph执行流程异常');
    } catch (error) {
      logger.error('[ChatGraphOrchestrator] LangGraph执行失败:', error);
      state.addError(error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取下一个节点
   * @param {string} currentNode - 当前节点
   * @param {Object} state - 对话状态
   * @returns {string} 下一个节点
   */
  getNextNode(currentNode, state) {
    let nextNode = edges[currentNode];

    // 如果当前节点有条件边，使用条件边
    if (conditionalEdges[currentNode]) {
      nextNode = conditionalEdges[currentNode](state);
    }

    return nextNode;
  }

  /**
   * 获取会话历史
   * @param {string} sessionId - 会话ID
   * @returns {Promise<Object>} 会话历史
   */
  async getSessionHistory(sessionId) {
    try {
      const session = await ChatSession.findOne({ sessionId });
      if (!session) {
        throw new Error(`会话不存在: ${sessionId}`);
      }

      // 获取所有周期的消息
      const allMessages = this.getAllCycleMessages(session);

      return {
        sessionId: session.sessionId,
        targetUserId: session.targetUserId,
        interlocutorUserId: session.interlocutorUserId,
        relation: session.relation,
        sentimentScore: session.sentimentScore,
        messages: allMessages,  // 返回所有周期的消息
        cycles: session.cycles,  // 返回周期信息
        currentCycleId: session.currentCycleId,
        cycleCount: session.cycles?.length || 0,
        startedAt: session.startedAt,
        lastMessageAt: session.lastMessageAt,
        endedAt: session.endedAt,
        isActive: session.isActive
      };
    } catch (error) {
      logger.error('[ChatGraphOrchestrator] 获取会话历史失败:', error);
      throw error;
    }
  }

  /**
   * 生成会话ID
   * @returns {string} 会话ID
   */
  generateSessionId() {
    return `chat_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

export default ChatGraphOrchestrator;
