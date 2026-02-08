/**
 * 好感度控制器
 * 处理好感度相关的API请求
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import SentimentManager, { getSentimentManager } from '../services/langchain/sentimentManager.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

const sentimentManager = getSentimentManager();

class SentimentController {
  /**
   * 获取好感度
   */
  async getSentiment(req, res) {
    try {
      const { targetUserId, strangerId } = req.params;

      const sentiment = await sentimentManager.getStrangerSentiment(targetUserId, strangerId);

      res.json({
        success: true,
        sentiment: {
          strangerId: sentiment.strangerId,
          currentScore: sentiment.currentScore,
          initialScore: sentiment.initialScore,
          history: sentiment.history.slice(-20),
          totalConversations: sentiment.totalConversations,
          totalMessages: sentiment.totalMessages,
          lastConversationAt: sentiment.lastConversationAt
        }
      });
    } catch (error) {
      logger.error('[SentimentController] 获取好感度失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 更新好感度
   */
  async updateSentiment(req, res) {
    try {
      const { targetUserId, strangerId } = req.params;
      const { message, conversationHistory, sentiment: preComputedSentiment } = req.body;

      const updatedSentiment = await sentimentManager.updateSentiment(
        targetUserId,
        strangerId,
        {
          message,
          conversationHistory,
          sentiment: preComputedSentiment
        }
      );

      const lastHistory = updatedSentiment.history[updatedSentiment.history.length - 1];

      res.json({
        success: true,
        sentiment: {
          currentScore: updatedSentiment.currentScore,
          change: lastHistory.change,
          reason: lastHistory.reason
        }
      });
    } catch (error) {
      logger.error('[SentimentController] 更新好感度失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 分析消息情感
   */
  async analyzeSentiment(req, res) {
    try {
      const { targetUserId, strangerId } = req.params;
      const { message } = req.body;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: '消息内容不能为空'
        });
      }

      const sentimentScore = await sentimentManager.analyzeSentiment(message);

      let sentimentType = 'neutral';
      if (sentimentScore > 3) {
        sentimentType = 'positive';
      } else if (sentimentScore < -3) {
        sentimentType = 'negative';
      }

      res.json({
        success: true,
        analysis: {
          sentiment: sentimentType,
          score: sentimentScore,
          confidence: Math.min(1, Math.abs(sentimentScore) / 10 + 0.5)
        }
      });
    } catch (error) {
      logger.error('[SentimentController] 分析情感失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取统计信息
   */
  async getStats(req, res) {
    try {
      const { targetUserId } = req.params;

      const stats = await sentimentManager.getSentimentStats(targetUserId);

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('[SentimentController] 获取统计信息失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 批量更新好感度
   */
  async batchUpdate(req, res) {
    try {
      const { targetUserId } = req.params;
      const { updates } = req.body;

      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: '更新数据不能为空'
        });
      }

      const results = await sentimentManager.batchUpdateSentiments(targetUserId, updates);

      res.json({
        success: true,
        results
      });
    } catch (error) {
      logger.error('[SentimentController] 批量更新好感度失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new SentimentController();
