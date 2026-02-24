/**
 * 回复生成节点
 * 调用LLM生成回复
 *
 * @author AFS Team
 * @version 2.0.0
 */

import LLMClient, { createDefaultLLMClient } from '../../../core/llm/client.js';
import logger from '../../../core/utils/logger.js';

// 历史记录配置
const MAX_HISTORY_TURNS = 20;  // 最多保留20轮对话（40条消息）
const MAX_MESSAGE_LENGTH = 500; // 单条消息最大长度

/**
 * 回复生成节点函数
 * @param {Object} state - 当前对话状态
 * @returns {Promise<Object>} 更新后的状态
 */
export async function responseGeneratorNode(state) {
  try {
    logger.info('[ResponseGenerator] 生成回复');

    const { contextMessages, userName } = state;
    const llmClient = createDefaultLLMClient();

    // 提取系统提示词和对话历史
    const systemMessage = contextMessages.find(m => m.role === 'system');
    const conversationHistory = contextMessages.filter(m => m.role !== 'system');

    // 记录后端信息
    const modelInfo = llmClient.getModelInfo();
    logger.info(`[ResponseGenerator] 使用后端: ${modelInfo.backend}, 模型: ${modelInfo.model}`);

    // 构建提示词
    let prompt = '';

    // 系统提示词
    if (systemMessage) {
      prompt = systemMessage.content + '\n\n';
    }

    // 添加完整对话历史（不截断太多）
    const recentHistory = conversationHistory.slice(-MAX_HISTORY_TURNS * 2);
    if (recentHistory.length > 0) {
      prompt += '===对话历史===\n';
      for (const msg of recentHistory) {
        if (msg.role === 'user') {
          prompt += `[对方]: ${msg.content}\n`;
        } else if (msg.role === 'assistant') {
          // 保留更多历史内容，但避免过长
          const content = msg.content.length > MAX_MESSAGE_LENGTH
            ? msg.content.substring(0, MAX_MESSAGE_LENGTH) + '...'
            : msg.content;
          prompt += `[你]: ${content}\n`;
        }
      }
      prompt += '=============\n\n';
    }

    // 找到最后一条用户消息
    const lastUserMsg = [...recentHistory].reverse().find(m => m.role === 'user');

    // 清晰的指令
    prompt += `【当前消息】对方说："${lastUserMsg?.content || '你好'}"

请作为角色本人，用第一人称自然地回复。
- 直接说出你的回复，不要加任何前缀或标记
- 保持角色性格和说话风格
- 可以引用对话历史中的内容

你的回复：`;

    logger.info(`[ResponseGenerator] 系统提示长度: ${systemMessage?.content?.length || 0}, 对话历史: ${recentHistory.length}条`);

    // 调试：输出完整的提示词（截断显示）
    const promptPreview = prompt.length > 1000 ? prompt.substring(0, 500) + '\n...[省略]...\n' + prompt.substring(prompt.length - 300) : prompt;
    logger.info(`[ResponseGenerator] 完整PROMPT (${prompt.length}字符):\n${promptPreview}`);

    const response = await llmClient.generate(prompt, {
      temperature: 0.7,
      maxTokens: 500
    });

    // 调试：输出原始响应
    logger.info(`[ResponseGenerator] LLM原始响应 (${response?.length || 0}字符): ${response?.substring(0, 300)}...`);

    // 清理响应 - 只移除格式标记，不截断内容
    let cleanResponse = response;

    // 移除可能的格式标记
    const stopPatterns = ['对话者:', '对方说:', '[对方]:', '[你]:', '对方:', '你:', '=============', '==='];
    for (const pattern of stopPatterns) {
      if (cleanResponse.includes(pattern)) {
        cleanResponse = cleanResponse.split(pattern)[0];
      }
    }

    // 移除开头的格式标记
    cleanResponse = cleanResponse.replace(/^\[?[你我对方]+\]?:?\s*/i, '').trim();

    // 不再截断响应，保留完整内容

    state.generatedResponse = cleanResponse;
    state.metadata.modelUsed = modelInfo.model;
    state.metadata.llmBackend = modelInfo.backend;

    logger.info(`[ResponseGenerator] 回复生成完成 - 长度: ${cleanResponse.length}`);

    return state;
  } catch (error) {
    logger.error('[ResponseGenerator] 处理失败:', error);
    state.addError(error);
    state.generatedResponse = '抱歉，我现在有点累了，稍后再聊吧。';
    return state;
  }
}
