/**
 * Fortune Generator Node for XiaoShuDong v2.0
 * Generates fortune-telling response using ziwei model (8B)
 *
 * This node:
 * 1. Gets formatted chart text (beautiful Markdown)
 * 2. Gets compressed conversation data
 * 3. Generates professional fortune report using ziwei model
 * 4. Stores the response in state.fortuneResponse (internal, user never sees directly)
 *
 * @author AFS Team
 * @version 2.0.0
 */

import ziweiLlm from '../../../core/ziwei/ziweiLlm.js';
import logger from '../../../core/utils/logger.js';
import { configLoader } from '../../langgraph/configLoader.js';

/**
 * Generate fortune-telling response
 *
 * @param {XiaoShuDongState} state - Conversation state
 * @returns {Promise<XiaoShuDongState>} Updated state with fortune response
 */
export async function fortuneGeneratorNode(state) {
  try {
    // Check if we have formatted chart text
    if (!state.formattedChartText && !state.natalChart) {
      logger.warn('[FortuneGenerator] No chart data available, skipping');
      state.fortuneResponse = '';
      state.metadata.fortuneGenerated = false;
      state.metadata.fortuneGenerationError = 'No chart data available';
      return state;
    }

    logger.info('[FortuneGenerator] Generating fortune response for user: ' + state.userId);

    const startTime = Date.now();

    // Build prompt using formatted chart text (v2.0)
    const chartText = state.formattedChartText || '';
    const compressedData = state.compressedData || {};
    const userQuestion = state.currentInput || '';

    // Generate report using ziwei model
    const response = await ziweiLlm.generateReportFromPrompt(
      buildFortunePrompt(chartText, compressedData, userQuestion, state.ragContext)
    );

    const duration = Date.now() - startTime;

    state.fortuneResponse = response;
    state.metadata.modelUsed = process.env.ZIWEI_MODEL || 'ziwei-8b';
    state.metadata.fortuneGenerated = true;
    state.metadata.fortuneGeneratedAt = new Date();
    state.metadata.fortuneGenerationDuration = duration;
    state.metadata.fortuneResponseLength = response?.length || 0;

    logger.info(
      `[FortuneGenerator] Generated response (${response?.length || 0} chars, ${duration}ms)`
    );

    return state;
  } catch (error) {
    logger.error('[FortuneGenerator] Failed to generate:', error);
    state.addError(error);
    state.fortuneResponse = '';
    state.metadata.fortuneGenerated = false;
    state.metadata.fortuneGenerationError = error.message;
    return state;
  }
}

/**
 * Build prompt for ziwei model
 */
function buildFortunePrompt(chartText, compressedData, userQuestion, ragContext) {
  let prompt = '';

  // Add formatted chart text
  if (chartText) {
    prompt += chartText;
    prompt += '\n\n';
  }

  // Add user context from compression
  if (compressedData.eventSummary) {
    prompt += `## 用户情况\n\n`;
    prompt += `事件摘要: ${compressedData.eventSummary}\n`;
    if (compressedData.emotionalState) {
      prompt += `情绪状态: ${compressedData.emotionalState}\n`;
    }
    if (compressedData.coreConcerns?.length > 0) {
      prompt += `核心关注: ${compressedData.coreConcerns.join('、')}\n`;
    }
    prompt += '\n';
  }

  // Add RAG context if available
  if (ragContext?.length > 0) {
    prompt += `## 参考书籍内容\n\n`;
    const maxContext = Math.min(ragContext.length, 3);
    for (let i = 0; i < maxContext; i++) {
      prompt += `${i + 1}. ${ragContext[i].content}\n`;
    }
    prompt += '\n';
  }

  // Add user question
  if (userQuestion) {
    prompt += `## 用户问题\n\n${userQuestion}\n\n`;
  }

  // Get editable section from configLoader
  const editableSection = configLoader.getPrompt('xiaoshudong', 'fortune_generator');
  if (editableSection) {
    prompt += editableSection;
  } else {
    // Fallback analysis instructions
    prompt += `## 分析要求\n\n`;
    prompt += `请根据以上命盘信息和用户情况，提供专业的紫微斗数分析报告。要求：\n`;
    prompt += `1. 分析用户当前面临的情况\n`;
    prompt += `2. 从命盘角度解读优势和挑战\n`;
    prompt += `3. 结合运限给出时间节点建议\n`;
    prompt += `4. 提供具体的行动建议\n\n`;
    prompt += `请用专业但通俗的语言撰写分析报告。`;
  }

  return prompt;
}

/**
 * Check if fortune was successfully generated
 *
 * @param {XiaoShuDongState} state - Conversation state
 * @returns {boolean} True if fortune response is available
 */
export function hasFortuneResponse(state) {
  if (!state || !state.metadata || state.metadata.fortuneGenerated !== true) {
    return false;
  }
  if (!state.fortuneResponse || typeof state.fortuneResponse !== 'string') {
    return false;
  }
  return state.fortuneResponse.length > 0;
}

/**
 * Get fortune response from state
 *
 * @param {XiaoShuDongState} state - Conversation state
 * @returns {string} Fortune response text
 */
export function getFortuneResponse(state) {
  return state.fortuneResponse || '';
}

/**
 * Format fortune response for display
 *
 * @param {XiaoShuDongState} state - Conversation state
 * @param {Object} options - Formatting options
 * @param {boolean} options.includeHeader - Include section header
 * @param {boolean} options.includeMetadata - Include metadata
 * @returns {string} Formatted fortune response
 */
export function formatFortuneResponse(state, options) {
  if (!options) options = {};
  const includeHeader = options.includeHeader !== undefined ? options.includeHeader : true;
  const includeMetadata = options.includeMetadata !== undefined ? options.includeMetadata : false;

  const response = getFortuneResponse(state);

  if (!response) {
    return '';
  }

  let formatted = '';

  if (includeHeader) {
    formatted += '## 命理分析\n\n';
  }

  formatted += response;

  if (includeMetadata && state.metadata) {
    formatted += '\n\n---\n';
    const model = state.metadata.modelUsed || 'N/A';
    formatted += '*分析模型：' + model + '*\n';
    if (state.metadata.fortuneGenerationDuration) {
      const duration = state.metadata.fortuneGenerationDuration;
      formatted += '*生成时间：' + duration + 'ms*\n';
    }
  }

  return formatted;
}

export default fortuneGeneratorNode;
