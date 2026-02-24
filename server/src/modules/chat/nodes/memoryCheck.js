/**
 * 记忆检查节点
 * 使用LLM语义分析判断是否需要检索RAG
 *
 * @author AFS Team
 * @version 2.0.0
 */

import LLMClient, { createDefaultLLMClient } from '../../../core/llm/client.js';
import logger from '../../../core/utils/logger.js';

/**
 * 记忆检查节点函数
 * @param {Object} state - 当前对话状态
 * @returns {Promise<Object>} 更新后的状态
 */
export async function memoryCheckNode(state) {
  try {
    logger.info('[MemoryCheck] 使用LLM语义分析判断是否需要检索');

    const { currentInput } = state;
    const llmClient = createDefaultLLMClient();

    // 精简版prompt - 语义分析判断
    const prompt = `判断消息是否需要从记忆库检索信息。只输出"需要检索"或"不需要检索"。

需要检索的情况：
1. 询问过去的事件/经历（如：还记得、小时候、以前、去年）
2. 询问角色的事实信息（如：你有哪些好友、你的家人、你做过什么工作）
3. 提及需要历史上下文的话题

不需要检索的情况：
1. 当前状态/问候（如：你好、身体怎么样、在干嘛）
2. 当前情感/动作（如：想你了、来看你）
3. 日常闲聊不需要历史信息

消息："${currentInput}"
判断：`;

    const response = await llmClient.generate(prompt, {
      temperature: 0.1,
      maxTokens: 10
    });

    const answer = response?.trim();
    const involvesMemory = answer.includes('需要检索') && !answer.includes('不需要');

    logger.info(`[MemoryCheck] 判定结果: ${involvesMemory ? '需要检索' : '不需要检索'}`);
    logger.info(`[MemoryCheck] 消息: "${currentInput}"`);
    logger.info(`[MemoryCheck] LLM回复: "${answer}"`);

    state.metadata = state.metadata || {};
    state.metadata.involvesMemory = involvesMemory;

    return state;

  } catch (error) {
    logger.error('[MemoryCheck] 分析失败:', error);
    state.metadata = state.metadata || {};
    state.metadata.involvesMemory = false;
    return state;
  }
}

export default memoryCheckNode;
