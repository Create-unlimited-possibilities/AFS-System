/**
 * 对话控制器
 * 处理对话相关的API请求
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import ChatGraphOrchestrator from '../services/chat/ChatGraphOrchestrator.js';
import ChatSession from '../models/ChatSession.js';
import User from '../models/User.js';
import AssistRelation from '../models/AssistRelation.js';
import logger from '../utils/logger.js';

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
}

export default new ChatController();
