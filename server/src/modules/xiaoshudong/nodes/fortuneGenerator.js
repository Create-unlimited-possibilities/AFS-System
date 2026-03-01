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
 * Build user context section from compressed data
 * @param {Object} compressedData - Compressed conversation data
 * @returns {string} Formatted user context section
 */
function buildUserContextSection(compressedData) {
  if (!compressedData?.eventSummary) return '';
  let section = `# 用户情况\n\n`;
  section += `事件摘要: ${compressedData.eventSummary}\n`;
  if (compressedData.emotionalState) {
    section += `情绪状态: ${compressedData.emotionalState}\n`;
  }
  if (compressedData.coreConcerns?.length > 0) {
    section += `核心关注: ${compressedData.coreConcerns.join('、')}\n`;
  }
  if (compressedData.informationGathered) {
    const info = compressedData.informationGathered;
    if (info.situation) section += `用户处境: ${info.situation}\n`;
    if (info.duration) section += `持续时间: ${info.duration}\n`;
    if (info.mainWorry) section += `主要担忧: ${info.mainWorry}\n`;
  }
  section += '\n---\n\n';
  return section;
}

/**
 * Build editable section from configLoader
 * @returns {string} Formatted editable section
 */
function buildEditableSection() {
  const editableSection = configLoader.getPrompt('xiaoshudong', 'fortune_generator');
  if (editableSection) {
    return `# 分析指引\n\n${editableSection}\n\n---\n\n`;
  }
  // Fallback
  return `# 分析指引\n\n请根据以下命盘信息和用户情况，提供专业的紫微斗数分析报告。\n\n---\n\n`;
}

/**
 * Build chart section from formatted chart text
 * @param {string} chartText - Formatted chart text in Markdown
 * @returns {string} Formatted chart section
 */
function buildChartSection(chartText) {
  if (!chartText) return '';
  return `${chartText}\n\n---\n\n`;
}

/**
 * Build RAG context section from retrieved knowledge
 * @param {Array} ragContext - RAG retrieved context items
 * @returns {string} Formatted RAG section
 */
function buildRagSection(ragContext) {
  if (!ragContext?.length) return '';
  let section = `# 参考知识\n\n`;
  const maxContext = Math.min(ragContext.length, 3);
  for (let i = 0; i < maxContext; i++) {
    section += `${i + 1}. ${ragContext[i].content}\n\n`;
  }
  section += '---\n\n';
  return section;
}

/**
 * Build user question section
 * @param {string} userQuestion - User's original question
 * @returns {string} Formatted user question section
 */
function buildUserQuestionSection(userQuestion) {
  if (!userQuestion) return '';
  return `# 用户问题\n\n${userQuestion}\n`;
}

/**
 * Build prompt for ziwei model
 * Assembles System Prompt in the following order:
 * 1. 用户情况 (compressedData)
 * 2. 可编辑固定Prompt (editableSection from configLoader)
 * 3. 命盘检索结果 (formattedChartText)
 * 4. 知识检索结果 (ragContext)
 * 5. 用户原始问题 (userQuestion)
 */
function buildFortunePrompt(chartText, compressedData, userQuestion, ragContext) {
  let prompt = '';

  // 1. 用户情况 (来自 conversation_compressor)
  prompt += buildUserContextSection(compressedData);

  // 2. 可编辑固定Prompt (来自 LangGraph 配置)
  prompt += buildEditableSection();

  // 3. 命盘检索结果 (来自 chart_retriever)
  prompt += buildChartSection(chartText);

  // 4. 知识检索结果 (来自 rag_retriever)
  prompt += buildRagSection(ragContext);

  // 5. 用户原始问题
  prompt += buildUserQuestionSection(userQuestion);

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
