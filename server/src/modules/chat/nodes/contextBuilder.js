/**
 * 上下文整合节点
 * 整合角色卡+记忆+对话历史
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import logger from '../../../core/utils/logger.js';

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
