/**
 * 上下文整合节点
 * 整合角色卡+记忆+对话历史+待跟进话题
 *
 * @author AFS Team
 * @version 2.0.0
 */

import logger from '../../../core/utils/logger.js';
import PendingTopicsManager from '../../memory/PendingTopicsManager.js';

// Lazy-loaded singleton
let pendingTopicsManagerInstance = null;

function getPendingTopicsManager() {
  if (!pendingTopicsManagerInstance) {
    pendingTopicsManagerInstance = new PendingTopicsManager();
  }
  return pendingTopicsManagerInstance;
}

/**
 * 上下文整合节点函数
 * @param {Object} state - 当前对话状态
 * @returns {Promise<Object>} 更新后的状态
 */
export async function contextBuilderNode(state) {
  try {
    logger.info('[ContextBuilder] 整合上下文');

    const { systemPrompt, retrievedMemories, messages, currentInput } = state;

    let contextMessages = [];

    if (systemPrompt) {
      contextMessages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    if (retrievedMemories && retrievedMemories.length > 0) {
      const memoriesContent = retrievedMemories.map((mem, idx) =>
        `${idx + 1}. ${mem.content} (相关性: ${mem.relevanceScore})`
      ).join('\n');

      contextMessages.push({
        role: 'system',
        content: `【相关记忆】\n${memoriesContent}`
      });
    }

    // Check for pending topics to mention (30% probability)
    if (state.userId && state.interlocutor?.id) {
      try {
        const pendingTopicsManager = getPendingTopicsManager();
        const topic = await pendingTopicsManager.getRandomTopicToMention(
          state.userId,
          state.interlocutor.id,
          0.3 // 30% probability
        );

        if (topic) {
          state.pendingTopicToMention = topic;

          // Add pending topic to context
          const topicContext = `【待跟进话题】
话题: ${topic.topic}
背景: ${topic.context || '无'}
建议跟进: ${topic.suggestedFollowUp || '无'}

提示: 可以在对话中自然地提及此话题，但不要生硬插入。`;

          contextMessages.push({
            role: 'system',
            content: topicContext
          });

          // Initialize context object if needed
          if (!state.context) {
            state.context = {};
          }
          state.context.pendingTopic = {
            topic: topic.topic,
            suggestedFollowUp: topic.suggestedFollowUp,
            context: topic.context
          };

          // Mark topic as checked
          await pendingTopicsManager.markAsChecked(state.userId, topic.id);

          logger.info(`[ContextBuilder] 包含待跟进话题: ${topic.topic.substring(0, 30)}`);
        }
      } catch (topicError) {
        // Don't fail the whole context building if topic check fails
        logger.warn(`[ContextBuilder] 检查待跟进话题失败: ${topicError.message}`);
      }
    }

    if (messages && messages.length > 0) {
      const recentMessages = messages.slice(-10);
      contextMessages.push(...recentMessages);
    }

    contextMessages.push({
      role: 'user',
      content: currentInput
    });

    state.contextMessages = contextMessages;

    logger.info(`[ContextBuilder] 上下文整合完成 - 共${contextMessages.length}条消息`);

    return state;
  } catch (error) {
    logger.error('[ContextBuilder] 处理失败:', error);
    state.addError(error);
    return state;
  }
}
