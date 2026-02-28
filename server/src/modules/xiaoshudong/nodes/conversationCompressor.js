/**
 * Conversation Compressor Node for XiaoShuDong
 * Compresses phase 1 conversation and extracts key information
 *
 * This node:
 * 1. Analyzes the entire phase 1 conversation history
 * 2. Extracts event summary, time span, emotional state, core concerns
 * 3. Outputs structured data for chart calculation and fortune generation
 *
 * @author AFS Team
 * @version 2.0.0
 */

import { getLLMService } from '../../../core/llm/index.js';
import logger from '../../../core/utils/logger.js';
import { configLoader } from '../../langgraph/configLoader.js';

/**
 * Time span categories for chart calculation
 */
const TIME_SPAN_CATEGORIES = {
  '1天内': { horoscopeType: 'daily', description: '事件发生在今天或明天' },
  '1周内': { horoscopeType: 'weekly', description: '事件在一周内' },
  '1月内': { horoscopeType: 'monthly', description: '事件在一个月内' },
  '多个月': { horoscopeType: 'small_limit', description: '事件横跨多个月' },
  '大于1年': { horoscopeType: 'major_limit', description: '事件影响超过一年' }
};

/**
 * System prompt for conversation compression
 */
const COMPRESSOR_SYSTEM_PROMPT = `你是一个对话分析专家。你的任务是分析用户与心理咨询师的对话，提取关键信息。

请分析以下对话，并以JSON格式输出以下信息：

1. **eventSummary**: 用户遇到的事件摘要（1-2句话）
2. **timeSpan**: 事件涉及的时间跨度，从以下选项中选择一个：
   - "1天内" - 事件发生在今天或明天
   - "1周内" - 事件在一周内
   - "1月内" - 事件在一个月内
   - "多个月" - 事件横跨多个月
   - "大于1年" - 事件影响超过一年
   - "无法判断" - 如果对话中没有明确时间信息
3. **emotionalState**: 用户当前的情绪状态（如：焦虑、迷茫、期待、悲伤、愤怒等）
4. **coreConcerns**: 用户最关心的核心问题（数组，最多3个）
5. **keyEvents**: 对话中提到的关键事件（数组，最多5个）

只输出JSON，不要有其他文字。`;

/**
 * Compress conversation and extract key information
 *
 * @param {XiaoShuDongState} state - Conversation state
 * @returns {Promise<XiaoShuDongState>} Updated state with compressed data
 */
export async function conversationCompressorNode(state) {
  try {
    logger.info(`[Compressor] Compressing conversation for user: ${state.userId}`);

    const messages = state.messages || [];

    // Check if we have enough messages to compress
    if (messages.length < 2) {
      logger.warn('[Compressor] Not enough messages to compress');
      state.compressedData = {
        eventSummary: '用户刚开始对话',
        timeSpan: '无法判断',
        horoscopeType: 'monthly', // default to monthly
        emotionalState: '平静',
        coreConcerns: [],
        keyEvents: []
      };
      state.metadata.compressed = true;
      return state;
    }

    // Format conversation for analysis
    const conversationText = formatConversationForAnalysis(messages);

    // Get LLM service (uses env config: LLM_BACKEND)
    const llmService = getLLMService();

    // Get prompt and LLM config from configLoader
    const nodeConfig = configLoader.getNodeConfig('xiaoshudong', 'conversation_compressor');
    const systemPrompt = configLoader.getPrompt('xiaoshudong', 'conversation_compressor') || COMPRESSOR_SYSTEM_PROMPT;
    const llmOptions = {
      temperature: nodeConfig?.llmConfig?.temperature || 0.3,
      maxTokens: nodeConfig?.llmConfig?.maxTokens || 500
    };

    const response = await llmService.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `以下是对话内容：\n\n${conversationText}` }
      ],
      temperature: llmOptions.temperature,
      maxTokens: llmOptions.maxTokens
    });

    // Parse LLM response
    const compressedData = parseCompressedData(response.content);

    // Map time span to horoscope type
    const timeSpanCategory = compressedData.timeSpan || '无法判断';
    const horoscopeInfo = TIME_SPAN_CATEGORIES[timeSpanCategory] || TIME_SPAN_CATEGORIES['1月内'];

    state.compressedData = {
      ...compressedData,
      horoscopeType: horoscopeInfo.horoscopeType
    };

    state.metadata.compressed = true;
    state.metadata.compressedAt = new Date();

    logger.info(
      `[Compressor] Compression complete - TimeSpan: ${timeSpanCategory}, ` +
      `HoroscopeType: ${horoscopeInfo.horoscopeType}, ` +
      `EmotionalState: ${compressedData.emotionalState}`
    );

    return state;
  } catch (error) {
    logger.error('[Compressor] Failed to compress:', error);
    state.addError(error);

    // Set fallback compressed data
    state.compressedData = {
      eventSummary: '用户在寻求帮助',
      timeSpan: '无法判断',
      horoscopeType: 'monthly',
      emotionalState: '需要关注',
      coreConcerns: [],
      keyEvents: []
    };
    state.metadata.compressed = false;
    state.metadata.compressionError = error.message;

    return state;
  }
}

/**
 * Format conversation messages for LLM analysis
 *
 * @param {Array} messages - Conversation messages
 * @returns {string} Formatted conversation text
 */
function formatConversationForAnalysis(messages) {
  return messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => {
      const role = m.role === 'user' ? '用户' : '咨询师';
      return `${role}: ${m.content}`;
    })
    .join('\n\n');
}

/**
 * Parse LLM response into structured data
 *
 * @param {string} response - LLM response text
 * @returns {Object} Parsed compressed data
 */
function parseCompressedData(response) {
  try {
    // Try to extract JSON from response
    let jsonStr = response;

    // Handle markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Parse JSON
    const data = JSON.parse(jsonStr.trim());

    return {
      eventSummary: data.eventSummary || '用户在寻求帮助',
      timeSpan: data.timeSpan || '无法判断',
      emotionalState: data.emotionalState || '平静',
      coreConcerns: Array.isArray(data.coreConcerns) ? data.coreConcerns : [],
      keyEvents: Array.isArray(data.keyEvents) ? data.keyEvents : []
    };
  } catch (parseError) {
    logger.warn('[Compressor] Failed to parse LLM response, using fallback');
    return {
      eventSummary: '用户在寻求帮助',
      timeSpan: '无法判断',
      emotionalState: '需要关注',
      coreConcerns: [],
      keyEvents: []
    };
  }
}

/**
 * Get compressed data from state
 *
 * @param {XiaoShuDongState} state - Conversation state
 * @returns {Object} Compressed data
 */
export function getCompressedData(state) {
  return state.compressedData || {
    eventSummary: '',
    timeSpan: '无法判断',
    horoscopeType: 'monthly',
    emotionalState: '',
    coreConcerns: [],
    keyEvents: []
  };
}

/**
 * Get horoscope type based on time span
 *
 * @param {XiaoShuDongState} state - Conversation state
 * @returns {string} Horoscope type for chart calculation
 */
export function getHoroscopeType(state) {
  return state.compressedData?.horoscopeType || 'monthly';
}

export default conversationCompressorNode;
