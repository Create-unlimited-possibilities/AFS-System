/**
 * Intent Classifier Node
 * 使用 LLM 语义分析用户意图：情感支持 vs 建议寻求
 *
 * This node uses LLM to analyze user intent:
 * - isEmotional: User is seeking emotional support/venting
 * - needsAdvice: User is asking for advice/guidance
 * - confidence: How confident we are in the classification
 *
 * IMPORTANT: 使用 LLM 语义分析，而非关键词匹配
 *
 * @author AFS Team
 * @version 2.0.0
 */

import logger from '../../../core/utils/logger.js';
import { createDefaultLLMClient } from '../../../core/llm/client.js';
import { configLoader } from '../../langgraph/configLoader.js';

const intentLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'INTENT_CLASSIFIER' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'INTENT_CLASSIFIER' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'INTENT_CLASSIFIER' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'INTENT_CLASSIFIER' }),
};

/**
 * System prompt for intent classification
 */
const INTENT_CLASSIFICATION_PROMPT = `你是一个意图分析助手。分析用户消息，判断用户的意图类型。

你需要输出一个 JSON 对象，包含以下字段：
- isEmotional: boolean - 用户是否在表达情感、寻求情感支持、倾诉、发泄情绪
- needsAdvice: boolean - 用户是否在寻求建议、帮助、指导、询问未来/命运/人生方向
- confidence: number - 0到1之间的置信度
- directionPhrases: string[] - 如果 needsAdvice 为 true，提取用户想了解的方向（如：事业、感情、财运、健康、未来等）

判断规则：

【isEmotional 为 true 的情况】
1. 用户在表达负面情绪（难过、伤心、焦虑、压力、孤独、疲惫、迷茫等）
2. 用户在倾诉、发泄、抱怨
3. 用户在寻求安慰、理解、陪伴
4. 用户在表达困惑但不是寻求具体建议

【needsAdvice 为 true 的情况】
1. 用户明确询问"怎么办"、"如何"、"怎样"
2. 用户想了解某个领域的发展（事业、感情、财运等）
3. 用户在做决定，需要指导
4. 用户想了解自己的"人生方向"、"未来发展"
5. 用户使用含蓄的方式询问（如"能帮我看看吗"、"想了解一下"）

【两者可以同时为 true】
例如："我工作不顺利，很焦虑，该怎么办？"
- isEmotional: true（表达焦虑）
- needsAdvice: true（询问怎么办）

【两者都为 false 的情况】
- 普通打招呼、闲聊

只输出 JSON，不要有其他内容。`;

/**
 * 使用 LLM 语义分析用户意图
 * @param {string} message - 用户消息
 * @param {Array} history - 对话历史（可选）
 * @returns {Promise<Object>} 意图分析结果
 */
async function classifyIntentWithLLM(message, history = []) {
  try {
    const llmClient = createDefaultLLMClient();

    // 构建上下文（如果有历史）
    let contextPrompt = '';
    if (history.length > 0) {
      const recentHistory = history.slice(-4); // 最近2轮对话
      contextPrompt = '\n\n【对话历史】\n' + recentHistory.map(h =>
        `${h.role === 'user' ? '用户' : '助手'}：${h.content}`
      ).join('\n');
    }

    // Get prompt and LLM config from configLoader
    const nodeConfig = configLoader.getNodeConfig('xiaoshudong', 'intent_classifier');
    const systemPrompt = configLoader.getPrompt('xiaoshudong', 'intent_classifier') || INTENT_CLASSIFICATION_PROMPT;
    const llmOptions = {
      temperature: nodeConfig?.llmConfig?.temperature || 0.1,
      maxTokens: nodeConfig?.llmConfig?.maxTokens || 200
    };

    const prompt = `${systemPrompt}

【用户消息】
${message}${contextPrompt}

分析结果（只输出JSON）：`;

    const response = await llmClient.generate(prompt, llmOptions);

    const responseText = response?.trim();

    // 尝试解析 JSON
    let intent;
    try {
      // 尝试直接解析
      intent = JSON.parse(responseText);
    } catch (parseError) {
      // 尝试提取 JSON 块
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        intent = JSON.parse(jsonMatch[0]);
      } else {
        intentLogger.warn(`[IntentClassifier] 无法解析 LLM 响应: ${responseText}`);
        return getDefaultIntent();
      }
    }

    // 验证并规范化结果
    const result = {
      isEmotional: Boolean(intent.isEmotional),
      needsAdvice: Boolean(intent.needsAdvice),
      confidence: typeof intent.confidence === 'number' ? intent.confidence : 0.5,
      advicePhrases: Array.isArray(intent.directionPhrases) ? intent.directionPhrases : [],
      directionPhrases: Array.isArray(intent.directionPhrases) ? intent.directionPhrases : []
    };

    // 如果两者都为 false，默认为情感支持（小树洞的角色是倾听者）
    if (!result.isEmotional && !result.needsAdvice) {
      result.isEmotional = true;
      result.confidence = 0.3; // 低置信度
    }

    intentLogger.info(`[IntentClassifier] LLM 分析结果:`, {
      isEmotional: result.isEmotional,
      needsAdvice: result.needsAdvice,
      confidence: result.confidence,
      advicePhrases: result.advicePhrases
    });

    return result;

  } catch (error) {
    intentLogger.error(`[IntentClassifier] LLM 分析失败: ${error.message}`);
    return getDefaultIntent();
  }
}

/**
 * 获取默认意图（保守策略：仅情感支持）
 * @returns {Object} 默认意图
 */
function getDefaultIntent() {
  return {
    isEmotional: true,
    needsAdvice: false,
    confidence: 0.3,
    advicePhrases: [],
    directionPhrases: []
  };
}

/**
 * 快速预检查 - 检测明显的建议寻求意图
 * 用于在 LLM 调用前进行快速判断，减少不必要的 LLM 调用
 * 注意：这只是一个优化，不用于最终决策
 *
 * @param {string} message - 用户消息
 * @returns {Object|null} 预检查结果或 null
 */
function quickPrecheck(message) {
  // 如果消息非常短（< 3 个字符），直接返回默认
  if (message.length < 3) {
    return { isEmotional: true, needsAdvice: false, confidence: 0.5 };
  }

  // 检测明确的问句结尾
  const hasQuestionMark = message.includes('？') || message.includes('?');

  // 检测明确的建议请求模式
  const strongAdvicePatterns = [
    /帮[我你]看看?/,
    /帮[我你]分析/,
    /怎么看/,
    /怎么[办做样]/,
    /如何.*[选择决定]/,
    /该不该/,
    /能.*吗.*[?？]$/,
    /运势/,
    /命运/,
    /算[一]?[下个]/
  ];

  for (const pattern of strongAdvicePatterns) {
    if (pattern.test(message)) {
      return null; // 需要 LLM 进一步分析
    }
  }

  // 如果没有问句，可能是纯情感表达
  if (!hasQuestionMark && message.length > 5) {
    // 检查是否包含明显的情感词
    const emotionalPatterns = [
      /[好很]累/, /难过/, /伤心/, /焦虑/, /压力/, /孤独/,
      /想哭/, /难受/, /烦/, /迷茫/, /无助/
    ];

    for (const pattern of emotionalPatterns) {
      if (pattern.test(message)) {
        return null; // 需要 LLM 进一步分析，因为可能是混合意图
      }
    }
  }

  return null; // 需要 LLM 分析
}

/**
 * Intent Classifier Node
 * Classifies user intent using LLM semantic analysis
 *
 * @param {Object} state - XiaoShuDongState conversation state
 * @returns {Promise<Object>} Updated state with intent classification
 *
 * @example
 * const state = { currentInput: '我最近很难过，不知道怎么办' };
 * const result = await intentClassifierNode(state);
 * // result.intent = { isEmotional: true, needsAdvice: true, confidence: 0.85 }
 */
export async function intentClassifierNode(state) {
  try {
    const input = state.currentInput || '';

    intentLogger.info(`[IntentClassifier] 开始分析: "${input.substring(0, 50)}..."`);

    // 快速预检查
    const precheckResult = quickPrecheck(input);
    if (precheckResult) {
      intentLogger.info(`[IntentClassifier] 预检查结果（跳过LLM）:`, precheckResult);

      if (!state.intent) {
        state.intent = precheckResult;
      } else {
        Object.assign(state.intent, precheckResult);
      }

      state.metadata = state.metadata || {};
      state.metadata.intentClassified = true;
      state.metadata.intentClassifiedAt = new Date();
      state.metadata.classificationMethod = 'precheck';

      return state;
    }

    // 使用 LLM 进行语义分析
    const history = state.messages || [];
    const intent = await classifyIntentWithLLM(input, history);

    // 更新 state
    if (!state.intent) {
      state.intent = intent;
    } else {
      Object.assign(state.intent, intent);
    }

    // 记录元数据
    state.metadata = state.metadata || {};
    state.metadata.intentClassified = true;
    state.metadata.intentClassifiedAt = new Date();
    state.metadata.classificationMethod = 'llm';

    // 记录结果
    const intentSummary = state.getIntentSummary?.() || getIntentSummary(state.intent);
    intentLogger.info(
      `[IntentClassifier] 分析完成: ${intentSummary} ` +
      `(confidence: ${state.intent.confidence.toFixed(2)}, method: ${state.metadata.classificationMethod})`
    );

    return state;

  } catch (error) {
    intentLogger.error('[IntentClassifier] 分类失败:', error);

    // 设置默认意图
    if (!state.intent) {
      state.intent = getDefaultIntent();
    }

    if (state.addError) {
      state.addError(error);
    }

    return state;
  }
}

/**
 * Get intent summary for logging/debugging
 * @param {Object} intent - Intent object
 * @returns {string} Human-readable intent summary
 */
export function getIntentSummary(intent) {
  if (!intent) return '未知意图';

  const intents = [];
  if (intent.isEmotional) intents.push('情感倾诉');
  if (intent.needsAdvice) intents.push('寻求建议');
  return intents.length > 0 ? intents.join(' + ') : '一般对话';
}

/**
 * Check if input indicates emotional support is needed
 * @param {Object} intent - Intent object
 * @returns {boolean} True if emotional support is indicated
 */
export function isEmotionalIntent(intent) {
  return intent?.isEmotional === true;
}

/**
 * Check if input indicates advice is being sought
 * @param {Object} intent - Intent object
 * @returns {boolean} True if advice-seeking is indicated
 */
export function isAdviceIntent(intent) {
  return intent?.needsAdvice === true;
}

/**
 * Get advice directions from intent
 * @param {Object} intent - Intent object
 * @returns {Array<string>} List of advice directions
 */
export function getAdviceDirections(intent) {
  return intent?.advicePhrases || intent?.directionPhrases || [];
}

export default intentClassifierNode;
