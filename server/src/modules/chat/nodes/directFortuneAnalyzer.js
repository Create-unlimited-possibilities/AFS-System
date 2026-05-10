/**
 * Direct Fortune Analyzer Node for Fortune Telling Branch
 * Generates fortune analysis for direct fortune-telling requests
 *
 * This node:
 * 1. Uses cloud API (with fallback to local) to generate professional fortune analysis
 * 2. Takes chart data, RAG context, and user's direct fortune question
 * 3. Produces analysis for the translator to transform into character voice
 *
 * Difference from fortuneGenerator:
 * - Input comes from user's direct fortune question (not listening assessment)
 * - Focuses on answering the specific fortune question
 * - Uses cloud API for faster response (v1.1 update)
 *
 * @author AFS Team
 * @version 1.1.0
 */

import { getLLMService } from '../../../core/llm/index.js';
import logger from '../../../core/utils/logger.js';
import { configLoader } from '../../langgraph/configLoader.js';

const analyzerLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, module: 'DIRECT_FORTUNE_ANALYZER' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, module: 'DIRECT_FORTUNE_ANALYZER' }),
  warn: (msg, meta = {}) => logger.warn(msg, { ...meta, module: 'DIRECT_FORTUNE_ANALYZER' }),
  debug: (msg, meta = {}) => logger.debug(msg, { ...meta, module: 'DIRECT_FORTUNE_ANALYZER' }),
};

/**
 * Build user question section for direct fortune telling
 * @param {Object} state - Conversation state
 * @returns {string} Formatted question section
 */
function buildQuestionSection(state) {
  let section = `# 用户算命问题\n\n`;

  // The user's direct fortune-telling question
  if (state.currentInput) {
    section += `问题: ${state.currentInput}\n`;
  }

  // Intent classification info if available
  if (state.intentClassification) {
    if (state.intentClassification.fortuneTopic) {
      section += `关注领域: ${state.intentClassification.fortuneTopic}\n`;
    }
    if (state.intentClassification.specificQuestion) {
      section += `具体问题: ${state.intentClassification.specificQuestion}\n`;
    }
  }

  section += '\n---\n\n';
  return section;
}

/**
 * Build editable section from configLoader
 * @returns {string} Formatted editable section
 */
function buildEditableSection() {
  const editableSection = configLoader.getPrompt('rolecard', 'direct_fortune_analyzer');
  if (editableSection) {
    return `# 分析指引\n\n${editableSection}\n\n---\n\n`;
  }
  // Default analysis guide for direct fortune telling
  return `# 分析指引

请根据用户的算命问题，结合命盘信息进行专业分析。

分析要点：
1. 首先确定问题相关的宫位（如问感情看夫妻宫，问事业看官禄宫）
2. 分析相关宫位的主星组合和亮度
3. 结合四化和流年运势（如有）
4. 给出具体的分析和建议

请注意：
- 保持专业但通俗易懂
- 解释命理术语的含义
- 给出积极正面的建议
- 避免过于绝对的断言

---\n\n`;
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
  let section = `# 命理参考知识\n\n`;
  const maxContext = Math.min(ragContext.length, 3);
  for (let i = 0; i < maxContext; i++) {
    section += `${i + 1}. ${ragContext[i].content}\n\n`;
  }
  section += '---\n\n';
  return section;
}

/**
 * Build prompt for ziwei model
 * Assembles prompt in the following order:
 * 1. 用户算命问题
 * 2. 分析指引
 * 3. 命盘信息
 * 4. 命理参考知识
 */
function buildDirectFortunePrompt(state) {
  let prompt = '';

  // 1. 用户算命问题
  prompt += buildQuestionSection(state);

  // 2. 分析指引
  prompt += buildEditableSection();

  // 3. 命盘信息
  if (state.formattedChartText) {
    prompt += buildChartSection(state.formattedChartText);
  }

  // 4. 命理参考知识
  if (state.ragContext?.length) {
    prompt += buildRagSection(state.ragContext);
  }

  return prompt;
}

/**
 * System prompt for fortune analysis
 */
const FORTUNE_ANALYZER_SYSTEM_PROMPT = `你是一位精通紫微斗数的专业命理师。你的任务是根据用户的命盘信息和问题，提供专业、详细、有深度的命理分析。

## 分析要点
1. 首先确定问题相关的宫位（如问感情看夫妻宫，问事业看官禄宫）
2. 分析相关宫位的主星组合和亮度
3. 结合四化和流年运势（如有）
4. 给出具体的分析和建议

## 注意事项
- 保持专业但通俗易懂
- 解释命理术语的含义
- 给出积极正面的建议
- 避免过于绝对的断言

请根据以下信息进行命理分析。`;

/**
 * Direct Fortune Analyzer Node
 * Generates fortune analysis for direct fortune-telling requests
 *
 * @param {ConversationState} state - Conversation state
 * @returns {Promise<ConversationState>} Updated state with fortune analysis
 */
export async function directFortuneAnalyzerNode(state) {
  try {
    // Check if we have chart data
    if (!state.formattedChartText && !state.natalChart) {
      analyzerLogger.warn('[DirectFortuneAnalyzer] 没有命盘数据，跳过分析');
      state.fortuneResponse = '';
      state.metadata.directFortuneAnalysis = false;
      state.metadata.directFortuneAnalysisError = 'No chart data available';
      return state;
    }

    analyzerLogger.info(
      `[DirectFortuneAnalyzer] 开始算命分析: ${state.userId}, ` +
      `问题: ${state.currentInput?.substring(0, 50)}...`
    );

    const startTime = Date.now();

    // Build prompt
    const userPrompt = buildDirectFortunePrompt(state);

    // Get LLM service (uses cloud API with fallback)
    const llmService = getLLMService();

    // Get LLM config from configLoader
    const nodeConfig = configLoader.getNodeConfig('rolecard', 'direct_fortune_analyzer');
    const llmOptions = {
      temperature: nodeConfig?.llmConfig?.temperature || 0.7,
      maxTokens: nodeConfig?.llmConfig?.maxTokens || 4096
    };

    // Generate analysis using cloud API (with fallback)
    const response = await llmService.chat({
      messages: [
        { role: 'system', content: FORTUNE_ANALYZER_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: llmOptions.temperature,
      maxTokens: llmOptions.maxTokens
    });

    const duration = Date.now() - startTime;
    const fortuneResponse = response.content || '';

    state.fortuneResponse = fortuneResponse;
    state.metadata.directFortuneAnalysis = true;
    state.metadata.directFortuneAnalysisAt = new Date();
    state.metadata.directFortuneAnalysisDuration = duration;
    state.metadata.directFortuneResponseLength = fortuneResponse.length;

    analyzerLogger.info(
      `[DirectFortuneAnalyzer] 算命分析完成 ` +
      `(${fortuneResponse.length} 字符, ${duration}ms)`
    );

    return state;
  } catch (error) {
    analyzerLogger.error('[DirectFortuneAnalyzer] 分析失败:', error);
    state.fortuneResponse = '';
    state.metadata.directFortuneAnalysis = false;
    state.metadata.directFortuneAnalysisError = error.message;

    if (state.addError) {
      state.addError(error);
    }

    return state;
  }
}

/**
 * Check if direct fortune analysis was successful
 * @param {ConversationState} state - Conversation state
 * @returns {boolean}
 */
export function hasDirectFortuneAnalysis(state) {
  return state.metadata?.directFortuneAnalysis === true && state.fortuneResponse;
}

/**
 * Get fortune response from state
 * @param {ConversationState} state - Conversation state
 * @returns {string} Fortune response text
 */
export function getDirectFortuneAnalysis(state) {
  return state.fortuneResponse || '';
}

export default directFortuneAnalyzerNode;
