/**
 * XiaoShuDong Controller
 * Handles HTTP requests for the XiaoShuDong (小树洞) chat feature
 *
 * @author AFS Team
 * @version 1.0.0
 */

import orchestrator from './orchestrator.js';
import logger from '../../core/utils/logger.js';
import { splitIntoSentences } from '../../core/utils/sentenceSplitter.js';

class XiaoShuDongController {
  /**
   * Send message to XiaoShuDong
   * POST /api/xiaoshudong/message
   *
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async sendMessage(req, res) {
    try {
      const userId = req.user.id;
      const { message } = req.body;

      // Validate message
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({
          success: false,
          error: '消息不能为空'
        });
      }

      // Get user data for birth info if available
      const userData = req.user.birthCalendar ? {
        birthCalendar: req.user.birthCalendar,
        birthHourIndex: req.user.birthHourIndex,
        gender: req.user.gender
      } : null;

      // Process message through orchestrator
      const result = await orchestrator.processMessage(userId, message.trim(), { userData });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || '处理消息失败'
        });
      }

      logger.info('[XiaoShuDongController] Message processed - User: ' + userId + ', Intent: ' + result.intent);

      // 分割句子用于逐句显示
      const sentences = splitIntoSentences(result.response);

      return res.json({
        success: true,
        response: result.response,
        sentences: sentences,
        intent: result.intent,
        metadata: result.metadata
      });

    } catch (error) {
      logger.error('[XiaoShuDongController] sendMessage error:', error);
      return res.status(500).json({
        success: false,
        error: '发送消息失败'
      });
    }
  }

  /**
   * Get conversation history
   * GET /api/xiaoshudong/history
   *
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async getHistory(req, res) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 50;

      const history = orchestrator.getHistory(userId, limit);

      return res.json({
        success: true,
        history: history,
        count: history.length
      });

    } catch (error) {
      logger.error('[XiaoShuDongController] getHistory error:', error);
      return res.status(500).json({
        success: false,
        error: '获取历史记录失败'
      });
    }
  }

  /**
   * Get current session state
   * GET /api/xiaoshudong/session
   *
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async getSession(req, res) {
    try {
      const userId = req.user.id;
      const state = orchestrator.getSession(userId);

      if (!state) {
        return res.json({
          success: true,
          hasSession: false,
          session: null
        });
      }

      // Return safe session data (exclude internal state)
      return res.json({
        success: true,
        hasSession: true,
        session: {
          sessionId: state.metadata.sessionId,
          messageCount: state.messages.length,
          hasBirthInfo: !!state.metadata.userData
        }
      });

    } catch (error) {
      logger.error('[XiaoShuDongController] getSession error:', error);
      return res.status(500).json({
        success: false,
        error: '获取会话信息失败'
      });
    }
  }

  /**
   * End current session
   * POST /api/xiaoshudong/end
   *
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async endSession(req, res) {
    try {
      const userId = req.user.id;
      const ended = orchestrator.endSession(userId);

      logger.info('[XiaoShuDongController] Session ended - User: ' + userId);

      return res.json({
        success: true,
        message: '会话已结束'
      });

    } catch (error) {
      logger.error('[XiaoShuDongController] endSession error:', error);
      return res.status(500).json({
        success: false,
        error: '结束会话失败'
      });
    }
  }

  /**
   * Get service health status
   * GET /api/xiaoshudong/health
   *
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async health(req, res) {
    try {
      const health = orchestrator.healthCheck();

      return res.json({
        success: true,
        health: health
      });

    } catch (error) {
      logger.error('[XiaoShuDongController] health error:', error);
      return res.status(500).json({
        success: false,
        error: '获取服务状态失败'
      });
    }
  }
}

export default new XiaoShuDongController();
