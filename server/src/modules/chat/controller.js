/**
 * 对话控制器
 * 处理对话相关的API请求
 *
 * @author AFS Team
 * @version 1.0.0
 */

import ChatGraphOrchestrator from './orchestrator.js';
import ChatSession from './model.js';
import User from '../user/model.js';
import AssistRelation from '../assist/model.js';
import logger from '../../core/utils/logger.js';

const orchestrator = new ChatGraphOrchestrator();

class ChatController {
  /**
   * 通过uniqueCode创建会话
   */
  async createSessionByCode(req, res) {
    try {
      const { targetUniqueCode } = req.body;
      const interlocutorUserId = req.user.id;

      if (!targetUniqueCode) {
        return res.status(400).json({
          success: false,
          error: '目标用户唯一编码不能为空'
        });
      }

      const targetUser = await User.findOne({ uniqueCode: targetUniqueCode });
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: '目标用户不存在'
        });
      }

      const targetUserId = targetUser._id;

      const assistRelation = await AssistRelation.findOne({
        targetUserId,
        assistantUserId: interlocutorUserId
      });

      const session = await orchestrator.createSession({
        targetUserId,
        interlocutorUserId,
        targetUniqueCode
      });

      if (assistRelation) {
        session.relation = {
          type: assistRelation.relationType,
          assistRelationId: assistRelation._id,
          specificRelation: assistRelation.specificRelation,
          assistantName: req.user.name
        };

        await ChatSession.findOneAndUpdate(
          { sessionId: session.sessionId },
          {
            relation: assistRelation.relationType,
            assistRelationId: assistRelation._id,
            specificRelation: assistRelation.specificRelation
          }
        );
      }

      logger.info(`[ChatController] 会话创建成功 - Session: ${session.sessionId}, Interlocutor: ${interlocutorUserId}`);

      res.json({
        success: true,
        session
      });
    } catch (error) {
      logger.error('[ChatController] 创建会话失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(req, res) {
    try {
      const { sessionId } = req.params;
      const { message } = req.body;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: '消息内容不能为空'
        });
      }

      const result = await orchestrator.sendMessage(sessionId, message);

      logger.info(`[ChatController] 消息发送成功 - Session: ${sessionId}`);

      res.json(result);
    } catch (error) {
      logger.error('[ChatController] 发送消息失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取会话消息历史
   */
  async getSessionMessages(req, res) {
    try {
      const { sessionId } = req.params;

      const history = await orchestrator.getSessionHistory(sessionId);

      res.json({
        success: true,
        session: history
      });
    } catch (error) {
      logger.error('[ChatController] 获取会话历史失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 结束会话
   */
  async endSession(req, res) {
    try {
      const { sessionId } = req.params;

      await orchestrator.endSession(sessionId);

      logger.info(`[ChatController] 会话结束成功 - Session: ${sessionId}`);

      res.json({
        success: true,
        message: '会话已结束'
      });
    } catch (error) {
      logger.error('[ChatController] 结束会话失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取活跃会话
   */
  async getActiveSessions(req, res) {
    try {
      const userId = req.user.id;

      const sessions = await ChatSession.find({
        $or: [
          { targetUserId: userId },
          { interlocutorUserId: userId }
        ],
        isActive: true
      }).sort({ lastMessageAt: -1 });

      res.json({
        success: true,
        sessions: sessions.map(session => ({
          sessionId: session.sessionId,
          targetUserId: session.targetUserId,
          interlocutorUserId: session.interlocutorUserId,
          relation: session.relation,
          sentimentScore: session.sentimentScore,
          startedAt: session.startedAt,
          lastMessageAt: session.lastMessageAt
        }))
      });
    } catch (error) {
      logger.error('[ChatController] 获取活跃会话失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取对话统计
   */
  async getStats(req, res) {
    try {
      const userId = req.user.id;

      const totalSessions = await ChatSession.countDocuments({
        targetUserId: userId
      });

      const activeSessions = await ChatSession.countDocuments({
        targetUserId: userId,
        isActive: true
      });

      const sessions = await ChatSession.find({
        targetUserId: userId
      });

      const totalMessages = sessions.reduce((sum, session) => {
        return sum + (session.messages?.length || 0);
      }, 0);

      const averageSentiment = sessions.reduce((sum, session) => {
        return sum + (session.sentimentScore || 50);
      }, 0) / (sessions.length || 1);

      res.json({
        success: true,
        stats: {
          totalSessions,
          activeSessions,
          totalMessages,
          averageSentiment: parseFloat(averageSentiment.toFixed(2))
        }
      });
    } catch (error) {
      logger.error('[ChatController] 获取对话统计失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取陌生人的好感度
   */
  async getStrangerSentiment(req, res) {
    try {
      const { strangerId } = req.params;
      const targetUserId = req.user.id;

      const targetUser = await User.findById(targetUserId);
      if (!targetUser || !targetUser.companionChat?.strangerSentiments) {
        return res.status(404).json({
          success: false,
          error: '用户未设置好感度系统'
        });
      }

      const sentiment = targetUser.companionChat.strangerSentiments.find(
        s => s.strangerId?.toString() === strangerId
      );

      if (!sentiment) {
        return res.status(404).json({
          success: false,
          error: '未找到该陌生人的好感度记录'
        });
      }

      res.json({
        success: true,
        sentiment: {
          strangerId: sentiment.strangerId,
          currentScore: sentiment.currentScore,
          initialScore: sentiment.initialScore,
          history: sentiment.history.slice(-10),
          totalConversations: sentiment.totalConversations,
          totalMessages: sentiment.totalMessages,
          lastConversationAt: sentiment.lastConversationAt
        }
      });
    } catch (error) {
      logger.error('[ChatController] 获取好感度失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取所有联系人（家人/朋友 + 有会话的陌生人）
   */
  async getContacts(req, res) {
    try {
      const userId = req.user.id;

      // 1. 获取家人/朋友关系
      const relations = await AssistRelation.find({
        assistantId: userId,
        isActive: true
      }).populate('targetId', 'name uniqueCode');

      // 2. 获取所有会话（包含陌生人）
      const sessions = await ChatSession.find({
        interlocutorUserId: userId
      }).populate('targetUserId', 'name uniqueCode');

      // 3. 构建联系人 Map（去重）
      const contactMap = new Map();

      // 处理家人/朋友
      for (const rel of relations) {
        if (!rel.targetId) continue;
        const targetId = rel.targetId._id.toString();
        const session = sessions.find(s => s.targetUserId?._id?.toString() === targetId);

        contactMap.set(targetId, {
          targetUserId: targetId,
          targetUserName: rel.targetId.name,
          targetUniqueCode: rel.targetId.uniqueCode,
          relationType: rel.relationshipType,
          specificRelation: rel.specificRelation || '',
          sessionId: session?.sessionId || null,
          lastMessage: session?.messages?.slice(-1)[0]?.content || null,
          lastMessageAt: session?.lastMessageAt || null,
          sentimentScore: session?.sentimentScore || 50
        });
      }

      // 处理陌生人（只添加不在 relations 中的）
      for (const session of sessions) {
        if (!session.targetUserId) continue;
        const targetId = session.targetUserId._id.toString();

        if (!contactMap.has(targetId)) {
          contactMap.set(targetId, {
            targetUserId: targetId,
            targetUserName: session.targetUserId.name,
            targetUniqueCode: session.targetUserId.uniqueCode,
            relationType: 'stranger',
            specificRelation: '',
            sessionId: session.sessionId,
            lastMessage: session.messages?.slice(-1)[0]?.content || null,
            lastMessageAt: session.lastMessageAt || null,
            sentimentScore: session.sentimentScore || 50
          });
        }
      }

      // 4. 转为数组并排序（有消息的在前，按时间降序）
      const contacts = Array.from(contactMap.values()).sort((a, b) => {
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
      });

      res.json({ success: true, contacts });
    } catch (error) {
      logger.error('[ChatController] 获取联系人失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 预加载会话
   * 用户点击联系人时调用，提前加载角色卡和复杂关系层
   */
  async preloadSession(req, res) {
    try {
      const { targetUserId } = req.params;
      const interlocutorUserId = req.user.id;

      logger.info(`[ChatController] 预加载会话 - Target: ${targetUserId}, Interlocutor: ${interlocutorUserId}`);

      const result = await orchestrator.preloadSession({
        targetUserId,
        interlocutorUserId
      });

      res.json({
        success: true,
        session: result
      });
    } catch (error) {
      logger.error('[ChatController] 预加载会话失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 结束会话
   */
  async endChatSession(req, res) {
    try {
      const { sessionId } = req.params;

      logger.info(`[ChatController] 结束会话 - Session: ${sessionId}`);

      const result = await orchestrator.endSession(sessionId);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[ChatController] 结束会话失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // ==================== Indexing Wait Mechanism Endpoints ====================

  /**
   * Get session status (for checking if indexing)
   */
  async getSessionStatus(req, res) {
    try {
      const { sessionId } = req.params;

      const status = await orchestrator.getSessionStatus(sessionId);

      res.json({
        success: true,
        ...status
      });
    } catch (error) {
      logger.error('[ChatController] 获取会话状态失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Process pending messages after indexing completes
   * Called by frontend when indexing is done
   */
  async processPendingMessages(req, res) {
    try {
      const { sessionId } = req.params;

      logger.info(`[ChatController] 处理待处理消息 - Session: ${sessionId}`);

      const result = await orchestrator.processPendingMessages(sessionId);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[ChatController] 处理待处理消息失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Set session to indexing mode (internal use, triggered by token threshold)
   */
  async setSessionIndexing(req, res) {
    try {
      const { sessionId } = req.params;

      logger.info(`[ChatController] 设置会话为索引模式 - Session: ${sessionId}`);

      const result = await orchestrator.setSessionIndexing(sessionId);

      res.json(result);
    } catch (error) {
      logger.error('[ChatController] 设置索引模式失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Set session back to active mode
   */
  async setSessionActive(req, res) {
    try {
      const { sessionId } = req.params;

      logger.info(`[ChatController] 设置会话为活跃模式 - Session: ${sessionId}`);

      const result = await orchestrator.setSessionActive(sessionId);

      res.json(result);
    } catch (error) {
      logger.error('[ChatController] 设置活跃模式失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new ChatController();
