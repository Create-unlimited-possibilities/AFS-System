/**
 * 记忆更新节点
 * 将对话加入记忆历史
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import ChatSession from '../../../models/ChatSession.js';
import logger from '../../../utils/logger.js';

/**
 * 记忆更新节点函数
 * @param {Object} state - 当前对话状态
 * @returns {Promise<Object>} 更新后的状态
 */
export async function memoryUpdaterNode(state) {
  try {
    logger.info('[MemoryUpdater] 更新记忆');

    const { userId, interlocutor, currentInput, generatedResponse, metadata, contextMessages } = state;
    const sessionId = metadata?.sessionId || '';

    if (!sessionId) {
      logger.warn('[MemoryUpdater] 会话ID为空，跳过记忆更新');
      return state;
    }

    const session = await ChatSession.findOne({ sessionId });
    if (!session) {
      logger.warn(`[MemoryUpdater] 会话不存在: ${sessionId}`);
      return state;
    }

    session.messages.push({
      role: 'user',
      content: currentInput,
      timestamp: new Date(),
      metadata: {
        ragUsed: metadata.inputProcessor?.ragUsed || false,
        modelUsed: metadata.modelUsed || '',
        sentimentScore: interlocutor.sentimentScore
      }
    });

    session.messages.push({
      role: 'assistant',
      content: generatedResponse,
      timestamp: new Date(),
      metadata: {
        ragUsed: metadata.inputProcessor?.ragUsed || false,
        modelUsed: metadata.modelUsed || '',
        sentimentScore: interlocutor.sentimentScore
      }
    });

    session.lastMessageAt = new Date();
    session.sentimentScore = interlocutor.sentimentScore || 50;

    await session.save();

    state.metadata.memoryUpdated = true;
    state.metadata.memoryUpdatedAt = new Date();

    logger.info(`[MemoryUpdater] 记忆更新完成 - 会话: ${sessionId}`);

    return state;
  } catch (error) {
    logger.error('[MemoryUpdater] 处理失败:', error);
    state.addError(error);
    return state;
  }
}
