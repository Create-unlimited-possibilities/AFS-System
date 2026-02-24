/**
 * 上下文整合节点
 * 整合角色卡+记忆+对话历史+待跟进话题
 *
 * 重要：只使用当前周期的消息作为上下文，而非所有历史消息
 * 这确保每个周期有独立的对话上下文
 *
 * @author AFS Team
 * @version 2.1.0
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

// 相关性阈值配置
// ChromaDB使用L2距离，距离越小越相关
// 经验值：< 1.5 为高相关，< 2.0 为中等相关
const RELEVANCE_THRESHOLD = 2.0;  // 只保留距离 < 2.0 的记忆
const HIGH_RELEVANCE_THRESHOLD = 1.5;  // 高相关性标记

// 当前周期消息数量限制
// 避免上下文过长
const MAX_CURRENT_CYCLE_MESSAGES = 10;

/**
 * 上下文整合节点函数
 * @param {Object} state - 当前对话状态
 * @returns {Promise<Object>} 更新后的状态
 */
export async function contextBuilderNode(state) {
  try {
    logger.info('[ContextBuilder] 整合上下文');
    logger.info(`[ContextBuilder] 当前周期ID: ${state.metadata?.currentCycleId || '未知'}`);

    const { systemPrompt, retrievedMemories, messages, currentInput } = state;

    // 详细日志
    logger.info(`[ContextBuilder] 检索到的记忆数量: ${retrievedMemories?.length || 0}`);
    if (retrievedMemories && retrievedMemories.length > 0) {
      logger.info(`[ContextBuilder] 记忆相关性分数: ${retrievedMemories.map(m => m.relevanceScore?.toFixed(3)).join(', ')}`);
    }

    let contextMessages = [];

    if (systemPrompt) {
      contextMessages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // 按相关性过滤记忆
    if (retrievedMemories && retrievedMemories.length > 0) {
      // 过滤掉相关性太低的记忆
      const relevantMemories = retrievedMemories.filter(mem => {
        const score = mem.relevanceScore || 999;
        return score < RELEVANCE_THRESHOLD;
      });

      logger.info(`[ContextBuilder] 过滤后记忆数量: ${relevantMemories.length}/${retrievedMemories.length}`);

      if (relevantMemories.length > 0) {
        // 记录被过滤掉的记忆（用于调试）
        const filteredOut = retrievedMemories.filter(mem => {
          const score = mem.relevanceScore || 999;
          return score >= RELEVANCE_THRESHOLD;
        });
        if (filteredOut.length > 0) {
          logger.info(`[ContextBuilder] 被过滤的记忆: ${filteredOut.map(m =>
            `"${m.content?.substring(0, 30)}..." (分数: ${m.relevanceScore?.toFixed(3)})`
          ).join('; ')}`);
        }

        // 构建记忆上下文，标记相关性等级
        const memoriesContent = relevantMemories.map((mem, idx) => {
          const score = mem.relevanceScore || 999;
          const relevanceLevel = score < HIGH_RELEVANCE_THRESHOLD ? '高相关' : '中等相关';
          return `${idx + 1}. [${relevanceLevel}] ${mem.content}`;
        }).join('\n');

        // 使用更谨慎的指令，避免模型强制引用
        contextMessages.push({
          role: 'system',
          content: `【参考记忆】
以下是一些可能相关的记忆，仅供参考。只有当它们与当前对话真正相关时才使用，不要生硬地插入无关内容。

${memoriesContent}

提示：如果这些记忆与当前话题无关，请忽略它们，直接根据角色设定回复。`
        });
      } else {
        logger.info('[ContextBuilder] 没有高相关性的记忆，跳过记忆上下文');
      }
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
