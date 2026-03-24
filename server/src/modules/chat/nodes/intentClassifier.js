/**
 * Intent Classifier Node for Rolecard Venting Upgrade
 * Analyzes user message to determine intent (venting/chatting) and emotional intensity
 *
 * This node:
 * 1. Uses LLM to classify user intent (venting vs chatting)
 * 2. Detects if user wants to end the conversation
 * 3. Measures emotional intensity of the message
 * 4. Extracts core concern if venting
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { createDefaultLLMClient } from '../../../core/llm/client.js';
import logger from '../../../core/utils/logger.js';

const intentLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, module: 'INTENT_CLASSIFIER' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, module: 'INTENT_CLASSIFIER' }),
  warn: (msg, meta = {}) => logger.warn(msg, { ...meta, module: 'INTENT_CLASSIFIER' }),
  debug: (msg, meta = {}) => logger.debug(msg, { ...meta, module: 'INTENT_CLASSIFIER' }),
};

/**
 * Intent classification prompt
 */
const INTENT_CLASSIFICATION_PROMPT = `你是一个情感分析专家，擅长理解用户在对话中的意图和情绪状态。

请分析以下用户消息，输出JSON格式的分析结果：

【用户消息】
{userInput}

【对话历史】
{conversationHistory}

请输出以下JSON格式：
{
  "intent": "fortune_telling" | "venting" | "chatting",
  "confidence": 0.0-1.0,
  "emotionalIntensity": "low" | "medium" | "high",
  "endIntent": boolean,
  "coreConcern": "核心关注点（如果是倾诉或算命）"
}

判断标准（按优先级排序）：
1. intent (意图):
   - "fortune_telling": 用户要求算命、预测、看运势（如"帮我算算"、"能算命吗"、"看看我的事业运"、"算一卦"）- 最高优先级
   - "venting": 用户表达负面情绪、寻求安慰、倾诉烦恼
   - "chatting": 日常闲聊、分享趣事、中性/正面交流

2. emotionalIntensity (情绪强度):
   - "low": 情绪平静，无明显情绪波动
   - "medium": 有一定情绪表达，但可控
   - "high": 强烈情绪，如愤怒、悲伤、极度焦虑等

3. endIntent (结束意图):
   - true: 用户明确表示要结束对话（如"再见"、"我先走了"、"没事了"）
   - false: 用户继续对话的意愿

4. coreConcern (核心关注点):
   - 在intent为"venting"或"fortune_telling"时填写
   - 提炼用户最关心的问题是什么（如：工作压力、感情问题、健康担忧、事业发展等）
   - 如果intent为"chatting"，留空或填"无"

只输出JSON，不要其他内容。`;

/**
 * Default intent classification result
 */
function getDefaultIntentResult() {
  return {
    intent: 'chatting',
    confidence: 0.5,
    emotionalIntensity: 'low',
    endIntent: false,
    coreConcern: ''
  };
}

/**
 * Parse JSON response from LLM
 * @param {string} responseText - Raw LLM response
 * @returns {Object} Parsed result or default
 */
function parseIntentResponse(responseText) {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // 验证 intent 值是否有效
      const validIntents = ['fortune_telling', 'venting', 'chatting'];
      const intent = validIntents.includes(parsed.intent) ? parsed.intent : 'chatting';
      return {
        intent,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        emotionalIntensity: parsed.emotionalIntensity || 'low',
        endIntent: Boolean(parsed.endIntent),
        coreConcern: parsed.coreConcern || ''
      };
    }
  } catch (error) {
    intentLogger.warn(`[IntentClassifier] JSON解析失败: ${error.message}`);
  }
  return getDefaultIntentResult();
}

/**
 * Format conversation history for prompt
 * @param {Array} messages - Conversation messages
 * @returns {string} Formatted history
 */
function formatHistoryForPrompt(messages) {
  if (!messages || messages.length === 0) {
    return '（无历史对话）';
  }

  const recentMessages = messages.slice(-10); // Last 10 messages
  return recentMessages.map(msg => {
    const role = msg.role === 'user' ? '用户' : 'AI';
    return `${role}: ${msg.content}`;
  }).join('\n');
}

/**
 * Intent Classifier Node
 * Analyzes user message to determine intent and emotional state
 *
 * @param {ConversationState} state - Conversation state
 * @returns {Promise<ConversationState>} Updated state with intent classification
 */
export async function intentClassifierNode(state) {
  try {
    const userInput = state.currentInput || '';
    const messages = state.messages || [];

    intentLogger.info(`[IntentClassifier] 分析用户意图: "${userInput.substring(0, 50)}..."`);

    if (!userInput.trim()) {
      intentLogger.warn('[IntentClassifier] 用户输入为空，使用默认结果');
      state.intentClassification = getDefaultIntentResult();
      state.metadata.intentClassified = true;
      return state;
    }

    const llmClient = createDefaultLLMClient();
    const historyText = formatHistoryForPrompt(messages);

    const prompt = INTENT_CLASSIFICATION_PROMPT
      .replace('{userInput}', userInput)
      .replace('{conversationHistory}', historyText);

    const response = await llmClient.generate(prompt, {
      temperature: 0.3, // Low temperature for consistent classification
      maxTokens: 300
    });

    const result = parseIntentResponse(response);

    state.intentClassification = result;
    state.metadata.intentClassified = true;
    state.metadata.intentClassifiedAt = new Date();
    // 这些字段名必须与 edges.js 的 routeByIntent 检查的字段名一致
    state.metadata.intent = result.intent;  // 用于路由判断
    state.metadata.emotionalIntensity = result.emotionalIntensity;
    state.metadata.endIntent = result.endIntent;  // 用于路由判断

    intentLogger.info(
      `[IntentClassifier] 意图分类结果: ${result.intent}, ` +
      `置信度: ${result.confidence}, ` +
      `情绪强度: ${result.emotionalIntensity}, ` +
      `结束意图: ${result.endIntent}`
    );

    if (result.coreConcern) {
      intentLogger.info(`[IntentClassifier] 核心关注点: ${result.coreConcern}`);
    }

    return state;
  } catch (error) {
    intentLogger.error('[IntentClassifier] 处理失败:', error);
    state.intentClassification = getDefaultIntentResult();
    state.metadata.intentClassified = false;
    state.metadata.intentClassificationError = error.message;

    if (state.addError) {
      state.addError(error);
    }

    return state;
  }
}

/**
 * Get intent classification from state
 * @param {ConversationState} state - Conversation state
 * @returns {Object} Intent classification result
 */
export function getIntentClassification(state) {
  return state.intentClassification || getDefaultIntentResult();
}

/**
 * Check if user is venting
 * @param {ConversationState} state - Conversation state
 * @returns {boolean}
 */
export function isVenting(state) {
  const classification = getIntentClassification(state);
  return classification.intent === 'venting';
}

/**
 * Check if user wants fortune telling
 * @param {ConversationState} state - Conversation state
 * @returns {boolean}
 */
export function isFortuneTelling(state) {
  const classification = getIntentClassification(state);
  return classification.intent === 'fortune_telling';
}

/**
 * Check if user wants to end conversation
 * @param {ConversationState} state - Conversation state
 * @returns {boolean}
 */
export function isEndIntent(state) {
  const classification = getIntentClassification(state);
  return classification.endIntent === true;
}

/**
 * Get emotional intensity
 * @param {ConversationState} state - Conversation state
 * @returns {string} 'low' | 'medium' | 'high'
 */
export function getEmotionalIntensity(state) {
  const classification = getIntentClassification(state);
  return classification.emotionalIntensity || 'low';
}

/**
 * Get core concern
 * @param {ConversationState} state - Conversation state
 * @returns {string}
 */
export function getCoreConcern(state) {
  const classification = getIntentClassification(state);
  return classification.coreConcern || '';
}

export default intentClassifierNode;
