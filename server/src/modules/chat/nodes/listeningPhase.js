/**
 * Listening Phase Node for Rolecard Venting Upgrade
 * Listens to user with empathy and decides when to move to analysis
 *
 * This node:
 * 1. Responds as the role character with empathy
 * 2. Judges if ready to enter fortune analysis phase
 * 3. Extracts core concern and emotional state
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { createDefaultLLMClient } from '../../../core/llm/client.js';
import logger from '../../../core/utils/logger.js';

const listeningLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, module: 'LISTENING_PHASE' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, module: 'LISTENING_PHASE' }),
  warn: (msg, meta = {}) => logger.warn(msg, { ...meta, module: 'LISTENING_PHASE' }),
  debug: (msg, meta = {}) => logger.debug(msg, { ...meta, module: 'LISTENING_PHASE' }),
};

/**
 * Combined listening and assessment prompt
 */
const LISTENING_PROMPT = `你是一个温暖、善解人意的倾听者。你正在以角色身份与用户对话。

【角色设定】
{rolePersona}

【对话历史】
{conversationHistory}

【用户最新消息】
{currentInput}

请输出JSON格式：
{
  "response": "角色的回复（2-4句话，温暖平实，第一人称）",
  "readyForAnalysis": boolean,
  "coreConcern": "核心关注点",
  "emotionalState": "用户当前情绪状态"
}

回复要求：
- 以角色身份回复，使用第一人称
- 表达共情和理解
- 不使用命理词汇
- 根据对话深入程度判断是否准备好进入分析

readyForAnalysis 判断标准：
- true: 用户已充分倾诉，表达了明确的困扰或问题，可以进入分析阶段
- false: 用户还在倾诉过程中，或只是闲聊，需要继续倾听

只输出JSON，不要其他内容。`;

/**
 * Default listening response result
 */
function getDefaultListeningResult() {
  return {
    response: '我理解你的感受。能告诉我更多吗？',
    readyForAnalysis: false,
    coreConcern: '',
    emotionalState: '未知'
  };
}

/**
 * Parse JSON response from LLM
 * @param {string} responseText - Raw LLM response
 * @returns {Object} Parsed result or default
 */
function parseListeningResponse(responseText) {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        response: parsed.response || '我理解你的感受。能告诉我更多吗？',
        readyForAnalysis: Boolean(parsed.readyForAnalysis),
        coreConcern: parsed.coreConcern || '',
        emotionalState: parsed.emotionalState || '未知'
      };
    }
  } catch (error) {
    listeningLogger.warn(`[ListeningPhase] JSON解析失败: ${error.message}`);
  }
  return getDefaultListeningResult();
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

  const recentMessages = messages.slice(-15);
  return recentMessages.map(msg => {
    const role = msg.role === 'user' ? '用户' : '你';
    return `${role}: ${msg.content}`;
  }).join('\n');
}

/**
 * Format role persona for prompt
 * @param {Object} roleCard - Role card data
 * @returns {string} Formatted role persona
 */
function formatRolePersona(roleCard) {
  if (!roleCard) {
    return '你是一个善解人意的倾听者。';
  }

  let persona = `你是一个${roleCard.personality || '温暖'}的角色。`;

  if (roleCard.background) {
    persona += `\n背景: ${roleCard.background}`;
  }

  if (roleCard.communicationStyle) {
    persona += `\n说话风格: ${roleCard.communicationStyle}`;
  }

  return persona;
}

/**
 * Listening Phase Node
 * Responds with empathy and judges readiness for analysis
 *
 * @param {ConversationState} state - Conversation state
 * @returns {Promise<ConversationState>} Updated state with listening response
 */
export async function listeningPhaseNode(state) {
  try {
    const currentInput = state.currentInput || '';
    const messages = state.messages || [];
    const roleCard = state.roleCard || {};

    listeningLogger.info(`[ListeningPhase] 生成倾听回复: "${currentInput.substring(0, 30)}..."`);

    const llmClient = createDefaultLLMClient();
    const historyText = formatHistoryForPrompt(messages);
    const rolePersona = formatRolePersona(roleCard);

    const prompt = LISTENING_PROMPT
      .replace('{rolePersona}', rolePersona)
      .replace('{conversationHistory}', historyText)
      .replace('{currentInput}', currentInput);

    const response = await llmClient.generate(prompt, {
      temperature: 0.7,
      maxTokens: 500
    });

    const result = parseListeningResponse(response);

    // Store the listening phase result
    state.listeningResponse = result.response;
    state.listeningAssessment = {
      readyForAnalysis: result.readyForAnalysis,
      coreConcern: result.coreConcern,
      emotionalState: result.emotionalState
    };

    state.metadata.listeningPhaseCompleted = true;
    state.metadata.listeningPhaseCompletedAt = new Date();
    state.metadata.readyForAnalysis = result.readyForAnalysis;

    listeningLogger.info(
      `[ListeningPhase] 回复生成完成, ` +
      `准备分析: ${result.readyForAnalysis}, ` +
      `核心关注: ${result.coreConcern}, ` +
      `情绪状态: ${result.emotionalState}`
    );

    return state;
  } catch (error) {
    listeningLogger.error('[ListeningPhase] 处理失败:', error);
    state.listeningResponse = '我理解你的感受。能告诉我更多吗？';
    state.listeningAssessment = {
      readyForAnalysis: false,
      coreConcern: '',
      emotionalState: '未知'
    };
    state.metadata.listeningPhaseCompleted = false;
    state.metadata.listeningPhaseError = error.message;

    if (state.addError) {
      state.addError(error);
    }

    return state;
  }
}

/**
 * Get listening response from state
 * @param {ConversationState} state - Conversation state
 * @returns {string} Listening response
 */
export function getListeningResponse(state) {
  return state.listeningResponse || '';
}

/**
 * Check if ready for analysis
 * @param {ConversationState} state - Conversation state
 * @returns {boolean}
 */
export function isReadyForAnalysis(state) {
  return state.listeningAssessment?.readyForAnalysis === true ||
         state.metadata?.readyForAnalysis === true;
}

/**
 * Get core concern from listening assessment
 * @param {ConversationState} state - Conversation state
 * @returns {string}
 */
export function getListeningCoreConcern(state) {
  return state.listeningAssessment?.coreConcern || '';
}

/**
 * Get emotional state from listening assessment
 * @param {ConversationState} state - Conversation state
 * @returns {string}
 */
export function getEmotionalState(state) {
  return state.listeningAssessment?.emotionalState || '未知';
}

export default listeningPhaseNode;
