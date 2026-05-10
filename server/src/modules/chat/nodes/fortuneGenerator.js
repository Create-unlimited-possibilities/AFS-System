/**
 * Fortune Generator Node for Rolecard Venting Upgrade
 * Generates internal fortune-telling analysis report (not shown directly to user)
 *
 * This node:
 * 1. Uses cloud API (with fallback to local) to generate professional fortune analysis
 * 2. Takes chart data, RAG context, and user concerns as input
 * 3. Produces internal report for role translator to transform
 *
 * @author AFS Team
 * @version 1.1.0
 */

import { getLLMService } from '../../../core/llm/index.js';
import logger from '../../../core/utils/logger.js';
import { configLoader } from '../../langgraph/configLoader.js';

const fortuneLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, module: 'FORTUNE_GENERATOR' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, module: 'FORTUNE_GENERATOR' }),
  warn: (msg, meta = {}) => logger.warn(msg, { ...meta, module: 'FORTUNE_GENERATOR' }),
  debug: (msg, meta = {}) => logger.debug(msg, { ...meta, module: 'FORTUNE_GENERATOR' }),
};

/**
 * Build user context section from conversation data
 * @param {Object} state - Conversation state
 * @returns {string} Formatted user context section
 */
function buildUserContextSection(state) {
  let section = `# 用户情况\n\n`;

  // Core concern from listening assessment or intent classification
  const coreConcern = state.listeningAssessment?.coreConcern ||
                      state.intentClassification?.coreConcern ||
                      '';
  if (coreConcern) {
    section += `核心关注: ${coreConcern}\n`;
  }

  // Emotional state
  const emotionalState = state.listeningAssessment?.emotionalState ||
                         state.intentClassification?.emotionalState ||
                         '未知';
  section += `情绪状态: ${emotionalState}\n`;

  // Latest user input
  if (state.currentInput) {
    section += `用户问题: ${state.currentInput}\n`;
  }

  section += '\n---\n\n';
  return section;
}

/**
 * Build editable section from configLoader
 * @returns {string} Formatted editable section
 */
function buildEditableSection() {
  const editableSection = configLoader.getPrompt('rolecard', 'fortune_generator');
  if (editableSection) {
    return `# 分析指引\n\n${editableSection}\n\n---\n\n`;
  }
  // Fallback
  return `# 分析指引\n\n请根据以下命盘信息和用户情况，提供专业的紫微斗数分析报告。\n\n---\n\n`;
}

/**
 * System prompt for fortune generation (venting branch)
 */
const FORTUNE_GENERATOR_SYSTEM_PROMPT = `你是一位精通紫微斗数的专业命理师。你的任务是根据用户的命盘信息和倾诉内容，提供专业、详细、有深度的命理分析报告。

## 分析要点
1. 结合用户的情绪状态和核心关注点
2. 分析相关宫位的主星组合和亮度
3. 给出具有同理心的分析和建议

## 注意事项
- 保持专业但通俗易懂
- 解释命理术语的含义
- 给出积极正面的建议
- 对用户的情绪表示理解

请根据以下信息进行命理分析。`;

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
 * Build conversation history section
 * @param {Array} messages - Conversation messages
 * @returns {string} Formatted conversation section
 */
function buildConversationSection(messages) {
  if (!messages?.length) return '';

  let section = `# 对话历史\n\n`;
  const recentMessages = messages.slice(-10); // Last 10 messages

  for (const msg of recentMessages) {
    const role = msg.role === 'user' ? '用户' : 'AI';
    section += `${role}: ${msg.content}\n`;
  }

  section += '\n---\n\n';
  return section;
}

/**
 * Build prompt for ziwei model
 * Assembles System Prompt in the following order:
 * 1. 用户情况 (coreConcern, emotionalState, currentInput)
 * 2. 可编辑固定Prompt (editableSection from configLoader)
 * 3. 命盘检索结果 (formattedChartText)
 * 4. 知识检索结果 (ragContext)
 * 5. 对话历史 (messages)
 */
function buildFortunePrompt(state) {
  let prompt = '';

  // 1. 用户情况
  prompt += buildUserContextSection(state);

  // 2. 可编辑固定Prompt
  prompt += buildEditableSection();

  // 3. 命盘检索结果
  if (state.formattedChartText) {
    prompt += buildChartSection(state.formattedChartText);
  }

  // 4. 知识检索结果
  if (state.ragContext?.length) {
    prompt += buildRagSection(state.ragContext);
  }

  // 5. 对话历史
  if (state.messages?.length) {
    prompt += buildConversationSection(state.messages);
  }

  return prompt;
}

/**
 * Fortune Generator Node
 * Generates internal fortune-telling analysis report
 *
 * @param {ConversationState} state - Conversation state
 * @returns {Promise<ConversationState>} Updated state with fortune response
 */
export async function fortuneGeneratorNode(state) {
  try {
    // Check if we have necessary data
    if (!state.formattedChartText && !state.natalChart) {
      fortuneLogger.warn('[FortuneGenerator] 没有命盘数据，跳过生成');
      state.fortuneResponse = '';
      state.metadata.fortuneGenerated = false;
      state.metadata.fortuneGenerationError = 'No chart data available';
      return state;
    }

    fortuneLogger.info(`[FortuneGenerator] 开始生成命理分析: ${state.userId}`);

    const startTime = Date.now();

    // Build prompt using available state data
    const userPrompt = buildFortunePrompt(state);

    // Get LLM service (uses cloud API with fallback)
    const llmService = getLLMService();

    // Get LLM config from configLoader
    const nodeConfig = configLoader.getNodeConfig('rolecard', 'fortune_generator');
    const llmOptions = {
      temperature: nodeConfig?.llmConfig?.temperature || 0.7,
      maxTokens: nodeConfig?.llmConfig?.maxTokens || 4096
    };

    // Generate report using cloud API (with fallback)
    const response = await llmService.chat({
      messages: [
        { role: 'system', content: FORTUNE_GENERATOR_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: llmOptions.temperature,
      maxTokens: llmOptions.maxTokens
    });

    const duration = Date.now() - startTime;
    const fortuneResponse = response.content || '';

    state.fortuneResponse = fortuneResponse;
    state.metadata.modelUsed = 'cloud-api';
    state.metadata.fortuneGenerated = true;
    state.metadata.fortuneGeneratedAt = new Date();
    state.metadata.fortuneGenerationDuration = duration;
    state.metadata.fortuneResponseLength = fortuneResponse.length;

    fortuneLogger.info(
      `[FortuneGenerator] 命理分析生成完成 ` +
      `(${fortuneResponse.length} 字符, ${duration}ms)`
    );

    return state;
  } catch (error) {
    fortuneLogger.error('[FortuneGenerator] 生成失败:', error);
    state.fortuneResponse = '';
    state.metadata.fortuneGenerated = false;
    state.metadata.fortuneGenerationError = error.message;

    if (state.addError) {
      state.addError(error);
    }

    return state;
  }
}

/**
 * Check if fortune was successfully generated
 * @param {ConversationState} state - Conversation state
 * @returns {boolean}
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
 * @param {ConversationState} state - Conversation state
 * @returns {string} Fortune response text
 */
export function getFortuneResponse(state) {
  return state.fortuneResponse || '';
}

/**
 * Format fortune response for display
 * @param {ConversationState} state - Conversation state
 * @param {Object} options - Formatting options
 * @returns {string} Formatted fortune response
 */
export function formatFortuneResponse(state, options = {}) {
  const response = getFortuneResponse(state);
  if (!response) {
    return '';
  }

  const includeHeader = options.includeHeader !== false;
  const includeMetadata = options.includeMetadata === true;

  let formatted = '';

  if (includeHeader) {
    formatted += '## 命理分析\n\n';
  }

  formatted += response;

  if (includeMetadata && state.metadata) {
    formatted += '\n\n---\n';
    const model = state.metadata.modelUsed || 'N/A';
    formatted += `*分析模型：${model}*\n`;
    if (state.metadata.fortuneGenerationDuration) {
      formatted += `*生成时间：${state.metadata.fortuneGenerationDuration}ms*\n`;
    }
  }

  return formatted;
}

export default fortuneGeneratorNode;
