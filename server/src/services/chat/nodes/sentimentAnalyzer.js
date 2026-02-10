/**
 * 情感分析节点
 * 分析情感和好感度（仅陌生人）
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import SentimentManager from '../../langchain/sentimentManager.js';
import logger from '../../../utils/logger.js';

/**
 * 情感分析节点函数
 * @param {Object} state - 当前对话状态
 * @returns {Promise<Object>} 更新后的状态
 */
export async function sentimentAnalyzerNode(state) {
  try {
    const { roleCardMode } = state;

    if (!roleCardMode) {
      throw new Error('roleCardMode not defined in state');
    }

    if (roleCardMode === 'static') {
      logger.info('[SentimentAnalyzer] 方法B：跳过好感度分析');
      return state;
    }

    if (roleCardMode !== 'dynamic') {
      throw new Error(`未知的roleCardMode: ${roleCardMode}`);
    }

    logger.info('[SentimentAnalyzer] 方法A：分析情感和好感度');

    const { userId, interlocutor, currentInput, messages } = state;
    const sentimentManager = new SentimentManager();

    const sentimentRecord = await sentimentManager.getStrangerSentiment(userId, interlocutor.id);

    const sentimentScore = await sentimentManager.analyzeSentiment(currentInput);

    await sentimentManager.updateSentiment(userId, interlocutor.id, {
      message: currentInput,
      conversationHistory: messages,
      sentiment: sentimentScore
    });

    state.interlocutor.sentimentScore = sentimentRecord.currentScore;
    state.metadata.sentimentAnalysis = {
      score: sentimentScore,
      currentSentiment: sentimentRecord.currentScore,
      analyzedAt: new Date()
    };

    logger.info(`[SentimentAnalyzer] 情感分析完成 - 情感分: ${sentimentScore}, 好感度: ${sentimentRecord.currentScore}`);

    return state;
  } catch (error) {
    logger.error('[SentimentAnalyzer] 处理失败:', error);
    state.addError(error);
    return state;
  }
}
