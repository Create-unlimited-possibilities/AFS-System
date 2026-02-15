/**
 * 回复生成节点
 * 调用LLM生成回复
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import LLMClient, { createDefaultLLMClient } from '../../../core/llm/client.js';
import logger from '../../../core/utils/logger.js';

/**
 * 回复生成节点函数
 * @param {Object} state - 当前对话状态
 * @returns {Promise<Object>} 更新后的状态
 */
export async function responseGeneratorNode(state) {
  try {
    logger.info('[ResponseGenerator] 生成回复');

    const { contextMessages } = state;
    const llmClient = createDefaultLLMClient();

    let prompt = contextMessages.map(msg => {
      const roleMap = {
        'system': '系统',
        'user': '用户',
        'assistant': '助手'
      };
      return `[${roleMap[msg.role] || msg.role}]: ${msg.content}`;
    }).join('\n\n');

    const response = await llmClient.generate(prompt, {
      temperature: 0.7,
      maxTokens: 500
    });

    state.generatedResponse = response;
    state.metadata.modelUsed = llmClient.getModelInfo().model;

    logger.info(`[ResponseGenerator] 回复生成完成 - 长度: ${response.length}`);

    return state;
  } catch (error) {
    logger.error('[ResponseGenerator] 处理失败:', error);
    state.addError(error);
    return state;
  }
}
