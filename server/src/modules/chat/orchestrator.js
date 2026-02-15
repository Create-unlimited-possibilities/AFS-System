/**
 * LangGraph编排器
 * 管理对话流程的LangGraph实现
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import ConversationState from './state/ConversationState.js';
import { edges, conditionalEdges } from './edges/edges.js';
import { inputProcessorNode } from './nodes/inputProcessor.js';
import { relationConfirmNode } from './nodes/relationConfirm.js';
import { roleCardAssembleNode } from './nodes/roleCardAssemble.js';
import { ragRetrieverNode } from './nodes/ragRetriever.js';
import { sentimentAnalyzerNode } from './nodes/sentimentAnalyzer.js';
import { contextBuilderNode } from './nodes/contextBuilder.js';
import { responseGeneratorNode } from './nodes/responseGenerator.js';
import { memoryUpdaterNode } from './nodes/memoryUpdater.js';
import { outputFormatterNode } from './nodes/outputFormatter.js';
import ChatSession from './model.js';
import User from '../user/model.js';
import AssistRelation from '../assist/model.js';
import logger from '../../core/utils/logger.js';
import RolecardStorage from '../../core/storage/rolecard.js';

class ChatGraphOrchestrator {
  constructor() {
    this.nodes = {
      input_processor: inputProcessorNode,
      relation_confirm: relationConfirmNode,
      rolecard_assemble: roleCardAssembleNode,
      rag_retriever: ragRetrieverNode,
      sentiment_analyzer: sentimentAnalyzerNode,
      context_builder: contextBuilderNode,
      response_generator: responseGeneratorNode,
      memory_updater: memoryUpdaterNode,
      output_formatter: outputFormatterNode
    };

    this.activeSessions = new Map();
  }

  /**
   * 创建会话
   * @param {Object} options - 会话选项
   * @param {string} options.targetUserId - 目标用户ID
   * @param {string} options.interlocutorUserId - 对话者用户ID
   * @param {string} options.targetUniqueCode - 目标用户的唯一编码
   * @returns {Promise<Object>} 会话信息
   */
  async createSession(options) {
    try {
      const {
        targetUserId,
        interlocutorUserId,
        targetUniqueCode,
        roleCardMode = 'dynamic',
        systemPrompt: providedSystemPrompt
      } = options;

      logger.info(`[ChatGraphOrchestrator] 创建会话 - Target: ${targetUserId}, Interlocutor: ${interlocutorUserId}`);

      if (!['dynamic', 'static'].includes(roleCardMode)) {
        throw new Error('roleCardMode必须是dynamic或static');
      }

      const targetUser = await User.findById(targetUserId);
      const interlocutorUser = await User.findById(interlocutorUserId);

      if (!targetUser || !interlocutorUser) {
        throw new Error('用户不存在');
      }

      const sessionId = this.generateSessionId();

      let finalSystemPrompt = providedSystemPrompt;

      if (roleCardMode === 'static' && !finalSystemPrompt) {
        const rolecardStorage = new RolecardStorage();
        const rolecard = await rolecardStorage.getLatestRolecard(targetUserId);

        if (!rolecard) {
          throw new Error(`方法B模式：未提供systemPrompt，且未找到该用户的角色卡文件 - User: ${targetUserId}`);
        }

        finalSystemPrompt = rolecard.systemPrompt;
        logger.info(`[ChatGraphOrchestrator] 从文件加载角色卡 - User: ${targetUserId}, Version: ${rolecard.version}`);
      }

      const session = new ChatSession({
        sessionId,
        targetUserId,
        interlocutorUserId,
        relation: 'stranger',
        roleCardMode,
        systemPrompt: finalSystemPrompt,
        sentimentScore: 50,
        startedAt: new Date(),
        lastMessageAt: new Date(),
        isActive: true
      });

      await session.save();

      this.activeSessions.set(sessionId, {
        state: new ConversationState({
          userId: targetUserId,
          userName: targetUser.name,
          interlocutor: {
            id: interlocutorUserId,
            relationType: 'stranger'
          },
          messages: [],
          roleCardMode,
          systemPrompt: finalSystemPrompt,
          metadata: {
            sessionId
          }
        }),
        session
      });

      logger.info(`[ChatGraphOrchestrator] 会话创建成功 - Session: ${sessionId}`);

      return {
        sessionId,
        targetUser: {
          id: targetUser._id,
          name: targetUser.name,
          uniqueCode: targetUniqueCode
        },
        interlocutorUser: {
          id: interlocutorUser._id,
          name: interlocutorUser.name
        },
        relation: {
          type: 'stranger',
          roleCardMode
        }
      };
    } catch (error) {
      logger.error('[ChatGraphOrchestrator] 创建会话失败:', error);
      throw error;
    }
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

      const sessionData = this.activeSessions.get(sessionId);
      if (!sessionData) {
        throw new Error(`会话不存在: ${sessionId}`);
      }

      const { state } = sessionData;
      state.currentInput = message;

      const result = await this.executeGraph(state);

      state.addMessage('user', message);
      state.addMessage('assistant', result.message);

      return result;
    } catch (error) {
      logger.error('[ChatGraphOrchestrator] 发送消息失败:', error);
      throw error;
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

      while (currentNode && currentNode !== 'output_formatter') {
        const nodeFunction = this.nodes[currentNode];
        if (!nodeFunction) {
          throw new Error(`节点不存在: ${currentNode}`);
        }

        logger.info(`[ChatGraphOrchestrator] 执行节点: ${currentNode}`);

        await nodeFunction(state);
        executionHistory.push({
          node: currentNode,
          timestamp: new Date()
        });

        currentNode = this.getNextNode(currentNode, state);
      }

      if (currentNode === 'output_formatter') {
        const result = await this.nodes['output_formatter'](state);
        logger.info('[ChatGraphOrchestrator] LangGraph执行完成');
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
    if (conditionalEdges[currentNode]) {
      return conditionalEdges[currentNode](state);
    }
    return edges[currentNode];
  }

  /**
   * 结束会话
   * @param {string} sessionId - 会话ID
   * @returns {Promise<void>}
   */
  async endSession(sessionId) {
    try {
      logger.info(`[ChatGraphOrchestrator] 结束会话 - Session: ${sessionId}`);

      const sessionData = this.activeSessions.get(sessionId);
      if (!sessionData) {
        throw new Error(`会话不存在: ${sessionId}`);
      }

      const { session } = sessionData;

      session.endedAt = new Date();
      session.isActive = false;
      await session.save();

      this.activeSessions.delete(sessionId);

      logger.info('[ChatGraphOrchestrator] 会话结束成功');
    } catch (error) {
      logger.error('[ChatGraphOrchestrator] 结束会话失败:', error);
      throw error;
    }
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

      return {
        sessionId: session.sessionId,
        targetUserId: session.targetUserId,
        interlocutorUserId: session.interlocutorUserId,
        relation: session.relation,
        sentimentScore: session.sentimentScore,
        messages: session.messages,
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
