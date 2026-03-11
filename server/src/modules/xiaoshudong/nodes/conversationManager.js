/**
 * Conversation Manager for XiaoShuDong v2.1
 * 管理对话进程，决定何时从倾听阶段进入深度分析阶段
 *
 * 优化说明：
 * - 将评估和回复合并为一次 LLM 调用
 * - 使用完整对话历史作为上下文
 * - 直接设置 state.finalResponse
 *
 * @author AFS Team
 * @version 2.1.0
 */

import logger from '../../../core/utils/logger.js';
import { createDefaultLLMClient } from '../../../core/llm/client.js';

const conversationLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'CONVERSATION_MANAGER' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'CONVERSATION_MANAGER' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'CONVERSATION_MANAGER' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'CONVERSATION_MANAGER' }),
};

/**
 * 合并评估和回复的 Prompt
 * 一次 LLM 调用同时完成评估和回复生成
 */
const COMBINED_PROMPT = `你是一位温暖、专业的心理咨询师（小树洞）。

你的任务是：
1. 评估对话状态，判断用户是否准备好进入深度分析
2. 生成一个温暖、简洁的回复

【对话历史】
{fullHistory}

【用户最新消息】
{currentInput}

请输出JSON格式：
{
  "readyForAnalysis": boolean,
  "confidence": number,
  "coreConcern": string,
  "emotionalState": string,
  "response": string
}

回复要求：
- 2-4句话，温暖平实
- 先共情，再引导
- 不要使用命理词汇

只输出JSON，不要其他内容。`;

/**
 * 合并评估和回复为一次 LLM 调用
 * @param {Array} history - 完整对话历史
 * @param {string} currentInput - 当前用户输入
 * @returns {Promise<Object>} 包含评估结果和回复
 */
async function assessAndRespond(history, currentInput) {
  try {
    const llmClient = createDefaultLLMClient();

    // 使用完整历史（不再限制 slice）
    const historyText = history.map(h =>
      `${h.role === 'user' ? '用户' : '咨询师'}：${h.content}`
    ).join('\n');

    const prompt = COMBINED_PROMPT
      .replace('{fullHistory}', historyText || '（无历史对话）')
      .replace('{currentInput}', currentInput);

    const response = await llmClient.generate(prompt, {
      temperature: 0.5,
      maxTokens: 500
    });

    const responseText = response?.trim();

    // 解析 JSON
    let result;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = getDefaultResult();
      }
    } catch (parseError) {
      conversationLogger.warn(`[ConversationManager] 无法解析结果: ${responseText}`);
      result = getDefaultResult();
    }

    // 确保所有必要字段存在
    result = {
      readyForAnalysis: result.readyForAnalysis || false,
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.3,
      coreConcern: result.coreConcern || '',
      emotionalState: result.emotionalState || '未知',
      response: result.response || '我理解你的感受。能告诉我更多吗？'
    };

    conversationLogger.info(`[ConversationManager] 评估结果:`, {
      readyForAnalysis: result.readyForAnalysis,
      confidence: result.confidence,
      coreConcern: result.coreConcern
    });

    return result;

  } catch (error) {
    conversationLogger.error(`[ConversationManager] assessAndRespond 失败: ${error.message}`);
    return getDefaultResult();
  }
}

/**
 * 获取默认结果
 */
function getDefaultResult() {
  return {
    readyForAnalysis: false,
    confidence: 0.3,
    coreConcern: '',
    emotionalState: '未知',
    response: '我理解你的感受。能告诉我更多吗？'
  };
}

/**
 * Conversation Manager Node
 * 管理对话进程，决定使用倾听模式还是分析模式
 *
 * @param {Object} state - XiaoShuDongState
 * @returns {Promise<Object>} 更新后的状态
 */
export async function conversationManagerNode(state) {
  try {
    const currentInput = state.currentInput || '';
    const history = state.messages || [];

    conversationLogger.info(`[ConversationManager] 处理消息: "${currentInput.substring(0, 30)}..."`);

    // 一次调用同时完成评估和回复
    const result = await assessAndRespond(history, currentInput);

    // 更新状态中的对话评估信息
    state.conversationAssessment = {
      readyForAnalysis: result.readyForAnalysis,
      confidence: result.confidence,
      coreConcern: result.coreConcern,
      emotionalState: result.emotionalState
    };

    // 直接设置最终回复
    state.finalResponse = result.response;

    // 初始化对话阶段追踪
    if (!state.conversationPhase) {
      state.conversationPhase = {
        current: 'listening',
        turnCount: 0,
        informationGathered: {}
      };
    }

    state.conversationPhase.turnCount += 1;

    // 决定对话阶段
    if (result.readyForAnalysis && result.confidence > 0.7) {
      // 准备进入分析阶段
      state.conversationPhase.current = 'transition';
      state.conversationPhase.coreConcern = result.coreConcern;
      state.conversationPhase.emotionalState = result.emotionalState;

      conversationLogger.info(`[ConversationManager] 进入过渡阶段，核心关注: ${result.coreConcern}`);

      // 设置标志，让 edges.js 路由到分析流程
      state.metadata.readyForAnalysis = true;

    } else {
      // 继续倾听阶段
      state.conversationPhase.current = 'listening';
      state.metadata.readyForAnalysis = false;

      conversationLogger.info(`[ConversationManager] 继续倾听阶段，轮次: ${state.conversationPhase.turnCount}`);
    }

    // 记录元数据
    state.metadata.conversationManaged = true;
    state.metadata.conversationManagedAt = new Date();
    state.metadata.turnCount = state.conversationPhase.turnCount;

    return state;

  } catch (error) {
    conversationLogger.error('[ConversationManager] 处理失败:', error);

    // 设置默认状态
    state.metadata.readyForAnalysis = false;
    state.finalResponse = '我理解你的感受。能告诉我更多吗？';

    if (state.addError) {
      state.addError(error);
    }

    return state;
  }
}

/**
 * 检查是否应该进入分析阶段
 * @param {Object} state - 对话状态
 * @returns {boolean}
 */
export function shouldEnterAnalysis(state) {
  return state.metadata?.readyForAnalysis === true;
}

/**
 * 获取当前对话阶段
 * @param {Object} state - 对话状态
 * @returns {string} 'listening' | 'transition' | 'analysis'
 */
export function getCurrentPhase(state) {
  return state.conversationPhase?.current || 'listening';
}

/**
 * 获取收集的信息摘要
 * @param {Object} state - 对话状态
 * @returns {Object}
 */
export function getGatheredInformation(state) {
  return state.conversationPhase?.informationGathered || {};
}

export default conversationManagerNode;
