/**
 * 好感度管理器
 * 独立好感度系统：每个用户对每个协助者/陌生人都有独立的好感度记录
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import User from '../user/model.js';
import LLMClient, { createSentimentLLMClient } from '../../core/llm/client.js';

/**
 * 好感度管理器类
 * 实现多因素好感度更新系统
 */
class SentimentManager {
  constructor() {
    this.llmClient = createSentimentLLMClient();
    
    // 好感度影响因子配置
    this.factors = {
      sentiment: {
        range: [-10, 10],      // 情感分析影响范围
        weight: 0.6              // 权重
      },
      frequency: {
        range: [0.2, 1.0],      // 对话频次影响范围
        weight: 0.2              // 权重
      },
      quality: {
        range: [0, 2.0],        // 对话质量影响范围
        weight: 0.1              // 权重
      },
      decay: {
        range: [-10.0, -0.5],   // 时间衰减影响范围
        weight: 0.1              // 权重
      }
    };
    
    // 好感度边界
    this.bounds = {
      min: 0,
      max: 100
    };
  }

  /**
   * 获取陌生人的好感度（如果不存在则创建）
   * @param {string} targetUserId - 目标用户ID
   * @param {string} strangerId - 陌生人ID
   * @returns {Promise<Object>} 好感度记录
   */
  async getStrangerSentiment(targetUserId, strangerId) {
    try {
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        throw new Error(`目标用户不存在: ${targetUserId}`);
      }

      // 查找现有的好感度记录
      let sentimentRecord = targetUser.companionChat?.strangerSentiments?.find(
        s => s.strangerId?.toString() === strangerId.toString()
      );

      // 如果不存在，创建新的记录
      if (!sentimentRecord) {
        const stranger = await User.findById(strangerId);
        if (!stranger) {
          throw new Error(`陌生人用户不存在: ${strangerId}`);
        }

        // 获取目标用户的初始好感度设置
        const initialScore = targetUser.companionChat?.roleCard?.strangerInitialSentiment || 50;

        sentimentRecord = {
          strangerId,
          currentScore: initialScore,
          initialScore,
          history: [{
            score: initialScore,
            change: 0,
            reason: '初始好感度',
            factors: {
              sentiment: 0,
              frequency: 0,
              quality: 0,
              decay: 0
            },
            timestamp: new Date()
          }],
          totalConversations: 0,
          totalMessages: 0,
          lastConversationAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // 添加到用户记录
        if (!targetUser.companionChat) {
          targetUser.companionChat = {
            strangerSentiments: []
          };
        }
        if (!targetUser.companionChat.strangerSentiments) {
          targetUser.companionChat.strangerSentiments = [];
        }

        targetUser.companionChat.strangerSentiments.push(sentimentRecord);
        await targetUser.save();

        console.log(`[SentimentManager] 创建新的好感度记录: ${targetUserId} -> ${strangerId}, 初始分: ${initialScore}`);
      }

      return sentimentRecord;
    } catch (error) {
      console.error('[SentimentManager] 获取好感度失败:', error);
      throw error;
    }
  }

  /**
   * 更新好感度（多因素综合）
   * @param {string} targetUserId - 目标用户ID
   * @param {string} strangerId - 陌生人ID
   * @param {Object} updateData - 更新数据
   * @param {string} updateData.message - 当前消息
   * @param {Array} updateData.conversationHistory - 对话历史
   * @param {boolean} updateData.isConversationEnd - 是否对话结束
   * @returns {Promise<Object>} 更新后的好感度记录
   */
  async updateSentiment(targetUserId, strangerId, updateData = {}) {
    try {
      // 获取当前好感度记录
      const currentRecord = await this.getStrangerSentiment(targetUserId, strangerId);
      
      // 计算各因素的影响
      const factors = await this.calculateFactors(
        targetUserId, 
        strangerId, 
        updateData.message || '', 
        updateData.conversationHistory || [], 
        updateData.sentiment || 0,
        updateData.isConversationEnd || false
      );

      // 计算总变化
      const totalChange = this.calculateTotalChange(factors);
      
      // 更新分数（确保在 0-100 范围内）
      const newScore = this.capScore(currentRecord.currentScore + totalChange);
      const actualChange = newScore - currentRecord.currentScore;

      // 生成原因描述
      const reason = await this.generateReason(actualChange, factors, updateData);

      // 更新记录
      const historyEntry = {
        score: newScore,
        change: actualChange,
        reason,
        factors: {
          sentiment: factors.sentiment,
          frequency: factors.frequency,
          quality: factors.quality,
          decay: factors.decay
        },
        timestamp: new Date()
      };

      // 更新数据库
      const updateResult = await User.updateOne(
        { 
          _id: targetUserId,
          'companionChat.strangerSentiments.strangerId': strangerId
        },
        {
          $set: {
            'companionChat.strangerSentiments.$.currentScore': newScore,
            'companionChat.strangerSentiments.$.updatedAt': new Date(),
            'companionChat.strangerSentiments.$.totalConversations': updateData.isConversationEnd 
              ? currentRecord.totalConversations + 1 
              : currentRecord.totalConversations,
            'companionChat.strangerSentiments.$.totalMessages': currentRecord.totalMessages + 1,
            'companionChat.strangerSentiments.$.lastConversationAt': new Date()
          },
          $push: {
            'companionChat.strangerSentiments.$.history': historyEntry
          }
        }
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error('更新好感度失败：记录不存在或更新失败');
      }

      // 获取更新后的记录
      const updatedRecord = await this.getStrangerSentiment(targetUserId, strangerId);

      console.log(`[SentimentManager] 好感度更新: ${targetUserId} -> ${strangerId}, 分数: ${currentRecord.currentScore} -> ${newScore}, 变化: ${actualChange.toFixed(2)}`);

      return updatedRecord;
    } catch (error) {
      console.error('[SentimentManager] 更新好感度失败:', error);
      throw error;
    }
  }

  /**
   * 计算各因素的影响
   * @param {string} targetUserId - 目标用户ID
   * @param {string} strangerId - 陌生人ID
   * @param {string} message - 当前消息
   * @param {Array} conversationHistory - 对话历史
   * @param {number} sentiment - 预计算的情感值（可选）
   * @param {boolean} isConversationEnd - 是否对话结束
   * @returns {Promise<Object>} 各因素的影响值
   */
  async calculateFactors(targetUserId, strangerId, message, conversationHistory, sentiment = null, isConversationEnd = false) {
    try {
      // 1. 情感分析
      const sentimentFactor = sentiment !== null ? sentiment : await this.analyzeSentiment(message);

      // 2. 对话频次
      const frequencyFactor = await this.calculateFrequency(targetUserId, strangerId, isConversationEnd);

      // 3. 对话质量
      const qualityFactor = await this.calculateQuality(conversationHistory);

      // 4. 时间衰减
      const decayFactor = await this.calculateTimeDecay(targetUserId, strangerId);

      return {
        sentiment: sentimentFactor,
        frequency: frequencyFactor,
        quality: qualityFactor,
        decay: decayFactor
      };
    } catch (error) {
      console.error('[SentimentManager] 计算因素失败:', error);
      throw error;
    }
  }

  /**
   * 分析消息情感
   * @param {string} message - 消息内容
   * @returns {Promise<number>} 情感值 (-10 到 +10)
   */
  async analyzeSentiment(message) {
    try {
      if (!message || message.trim().length === 0) {
        return 0;
      }

      // 使用 LLM 进行情感分析
      const prompt = `请分析以下消息的情感倾向，返回一个 -10 到 +10 之间的数值：
负数表示负面情感，正数表示正面情感，0 表示中性。

消息："${message}"

请只返回数值，不要其他说明：`;

      const response = await this.llmClient.generate(prompt, {
        temperature: 0.1,
        maxTokens: 10
      });

      // 提取数值
      const sentimentValue = parseFloat(response.trim());
      
      // 确保在范围内
      if (isNaN(sentimentValue)) {
        console.warn('[SentimentManager] 情感分析返回无效值:', response);
        return 0;
      }

      return Math.max(-10, Math.min(10, sentimentValue));
    } catch (error) {
      console.warn('[SentimentManager] 情感分析失败，返回默认值:', error.message);
      return 0;
    }
  }

  /**
   * 计算对话频次
   * @param {string} targetUserId - 目标用户ID
   * @param {string} strangerId - 陌生人ID
   * @param {boolean} isConversationEnd - 是否对话结束
   * @returns {Promise<number>} 频次影响值 (0.2 到 1.0)
   */
  async calculateFrequency(targetUserId, strangerId, isConversationEnd = false) {
    try {
      // 只有对话结束时才增加频次分数
      if (!isConversationEnd) {
        return 0;
      }

      // 获取当前对话次数
      const currentRecord = await this.getStrangerSentiment(targetUserId, strangerId);
      const currentConversations = currentRecord.totalConversations;

      // 频次奖励：随着对话次数增加，奖励逐渐减少
      let frequencyBonus;
      if (currentConversations === 0) {
        frequencyBonus = 1.0; // 第一次对话，最大奖励
      } else if (currentConversations < 5) {
        frequencyBonus = 0.5;
      } else if (currentConversations < 10) {
        frequencyBonus = 0.3;
      } else {
        frequencyBonus = 0.2; // 最低奖励
      }

      return frequencyBonus;
    } catch (error) {
      console.warn('[SentimentManager] 计算频次失败，返回默认值:', error.message);
      return 0;
    }
  }

  /**
   * 计算对话质量
   * @param {Array} conversationHistory - 对话历史
   * @returns {Promise<number>} 质量影响值 (0 到 2.0)
   */
  async calculateQuality(conversationHistory) {
    try {
      if (!conversationHistory || conversationHistory.length < 2) {
        return 0;
      }

      // 计算对话轮次
      const messageCount = conversationHistory.length;
      const roundCount = Math.floor(messageCount / 2);

      // 质量奖励：基于对话轮次
      let qualityBonus = 0;
      
      if (roundCount >= 1) {
        qualityBonus += 0.2; // 至少一轮对话
      }
      
      if (roundCount >= 3) {
        qualityBonus += 0.3; // 多轮对话
      }
      
      if (roundCount >= 5) {
        qualityBonus += 0.5; // 深度对话
      }

      // 检查回复质量（简单检查）
      if (conversationHistory.length >= 4) {
        const lastUserMessage = conversationHistory[conversationHistory.length - 2];
        const lastAssistantMessage = conversationHistory[conversationHistory.length - 1];
        
        if (lastUserMessage && lastAssistantMessage) {
          const userLength = lastUserMessage.content?.length || 0;
          const assistantLength = lastAssistantMessage.content?.length || 0;
          
          // 如果双方都发表了较长内容，给予额外奖励
          if (userLength > 20 && assistantLength > 50) {
            qualityBonus += 0.3;
          }
        }
      }

      // 确保在范围内
      return Math.min(2.0, qualityBonus);
    } catch (error) {
      console.warn('[SentimentManager] 计算质量失败，返回默认值:', error.message);
      return 0;
    }
  }

  /**
   * 计算时间衰减
   * @param {string} targetUserId - 目标用户ID
   * @param {string} strangerId - 陌生人ID
   * @returns {Promise<number>} 衰减值 (-10.0 到 -0.5)
   */
  async calculateTimeDecay(targetUserId, strangerId) {
    try {
      // 获取最后对话时间
      const currentRecord = await this.getStrangerSentiment(targetUserId, strangerId);
      const lastConversationAt = currentRecord.lastConversationAt;

      if (!lastConversationAt) {
        return 0; // 从未对话，无衰减
      }

      const now = new Date();
      const daysSinceLastChat = (now - lastConversationAt) / (1000 * 60 * 60 * 24);

      // 时间衰减：越久不对话，衰减越大
      let decay = 0;
      
      if (daysSinceLastChat >= 30) {
        decay = -10.0; // 30天以上，最大衰减
      } else if (daysSinceLastChat >= 14) {
        decay = -5.0;  // 2周以上
      } else if (daysSinceLastChat >= 7) {
        decay = -2.0;  // 1周以上
      } else if (daysSinceLastChat >= 3) {
        decay = -1.0;  // 3天以上
      } else if (daysSinceLastChat >= 1) {
        decay = -0.5;  // 1天以上，最小衰减
      }
      // 24小时内无衰减

      return decay;
    } catch (error) {
      console.warn('[SentimentManager] 计算时间衰减失败，返回默认值:', error.message);
      return 0;
    }
  }

  /**
   * 计算总变化值
   * @param {Object} factors - 各因素影响值
   * @returns {number} 总变化值
   */
  calculateTotalChange(factors) {
    return Object.entries(this.factors).reduce((total, [factorName, config]) => {
      const factorValue = factors[factorName] || 0;
      return total + (factorValue * config.weight);
    }, 0);
  }

  /**
   * 生成原因描述
   * @param {number} totalChange - 总变化值
   * @param {Object} factors - 各因素影响值
   * @param {Object} updateData - 更新数据
   * @returns {Promise<string>} 原因描述
   */
  async generateReason(totalChange, factors, updateData = {}) {
    try {
      const reasons = [];

      if (Math.abs(factors.sentiment) > 0.1) {
        reasons.push(factors.sentiment > 0 ? '情感积极' : '情感消极');
      }

      if (factors.frequency > 0) {
        reasons.push('增加对话频次');
      }

      if (factors.quality > 0) {
        reasons.push('提高对话质量');
      }

      if (factors.decay < 0) {
        reasons.push('时间衰减');
      }

      if (reasons.length === 0) {
        reasons.push('无明显变化');
      }

      let trend = totalChange > 0 ? '提升' : totalChange < 0 ? '下降' : '保持';
      let magnitude = Math.abs(totalChange).toFixed(1);

      return `好感度${trend}（${magnitude}）：${reasons.join('、')}`;
    } catch (error) {
      console.warn('[SentimentManager] 生成原因失败，返回默认描述:', error.message);
      return '好感度变化';
    }
  }

  /**
   * 确保分数在指定范围内
   * @param {number} score - 原始分数
   * @returns {number} 调整后的分数
   */
  capScore(score) {
    return Math.max(this.bounds.min, Math.min(this.bounds.max, score));
  }

  /**
   * 批量更新多个陌生人的好感度
   * @param {string} targetUserId - 目标用户ID
   * @param {Array} updates - 更新数组 [{ strangerId, updateData }]
   * @returns {Promise<Array>} 更新结果数组
   */
  async batchUpdateSentiments(targetUserId, updates) {
    try {
      const results = await Promise.all(
        updates.map(({ strangerId, updateData }) => 
          this.updateSentiment(targetUserId, strangerId, updateData)
            .catch(error => ({
              strangerId,
              error: error.message
            }))
        )
      );

      return results;
    } catch (error) {
      console.error('[SentimentManager] 批量更新失败:', error);
      throw error;
    }
  }

  /**
   * 获取好感度统计信息
   * @param {string} targetUserId - 目标用户ID
   * @returns {Promise<Object>} 统计信息
   */
  async getSentimentStats(targetUserId) {
    try {
      const user = await User.findById(targetUserId);
      if (!user || !user.companionChat?.strangerSentiments) {
        return {
          totalStrangers: 0,
          averageScore: 0,
          scoreDistribution: { high: 0, medium: 0, low: 0 },
          lastUpdate: null
        };
      }

      const sentiments = user.companionChat.strangerSentiments;
      const totalStrangers = sentiments.length;
      
      if (totalStrangers === 0) {
        return {
          totalStrangers: 0,
          averageScore: 0,
          scoreDistribution: { high: 0, medium: 0, low: 0 },
          lastUpdate: null
        };
      }

      // 计算平均分数
      const totalScore = sentiments.reduce((sum, s) => sum + s.currentScore, 0);
      const averageScore = totalScore / totalStrangers;

      // 分数分布
      const scoreDistribution = {
        high: sentiments.filter(s => s.currentScore >= 70).length,
        medium: sentiments.filter(s => s.currentScore >= 30 && s.currentScore < 70).length,
        low: sentiments.filter(s => s.currentScore < 30).length
      };

      // 最后更新时间
      const lastUpdate = sentiments
        .map(s => s.updatedAt)
        .sort((a, b) => b - a)[0];

      return {
        totalStrangers,
        averageScore: parseFloat(averageScore.toFixed(2)),
        scoreDistribution,
        lastUpdate
      };
    } catch (error) {
      console.error('[SentimentManager] 获取统计信息失败:', error);
      throw error;
    }
  }
}

export default SentimentManager;

// 创建单例实例
const sentimentManagerInstance = new SentimentManager();

// 导出单例访问器
export const getSentimentManager = () => sentimentManagerInstance;