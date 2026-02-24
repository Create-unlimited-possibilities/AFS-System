/**
 * Token Response Node V2
 * 处理对话结束检查和AI补充结束语句
 *
 * @author AFS Team
 * @version 2.0.0
 */

import LLMClient from '../../../core/llm/client.js';
import logger from '../../../core/utils/logger.js';

const llmClient = new LLMClient();

const tokenResponseLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'TOKEN_RESPONSE' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'TOKEN_RESPONSE' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'TOKEN_RESPONSE' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'TOKEN_RESPONSE' }),
};

// Token thresholds configuration
const TOKEN_CONFIG = {
  FATIGUE_PROMPT_THRESHOLD: 0.6,    // 60% - show fatigue dialog
  FORCE_OFFLINE_THRESHOLD: 0.7      // 70% - force offline
};

/**
 * Token Response Node V2
 * Handles token-based prompts and session termination based on tokenMonitor's action decisions
 *
 * @param {Object} state - Current conversation state
 * @returns {Promise<Object>} Processing result
 */
export async function tokenResponseNode(state) {
  try {
    const tokenInfo = state.tokenInfo;
    const { userName, interlocutor, generatedResponse } = state;

    // Ensure metadata exists
    state.metadata = state.metadata || {};

    // No token info, continue normal flow
    if (!tokenInfo) {
      tokenResponseLogger.debug('[TokenResponse] No token info, continuing normal flow');
      state.generatedResponse = generatedResponse;
      return {
        message: generatedResponse,
        shouldEnd: false
      };
    }

    const { action, usageRatio } = tokenInfo;
    const usagePercent = usageRatio ? Math.round(usageRatio * 100) : 0;

    tokenResponseLogger.info('[TokenResponse] Token usage status', {
      usageRatio: usagePercent + '%',
      action: action
    });

    // 1. Force offline (70% threshold)
    // Trigger memory save and indexing, generate closing message
    if (action === 'force_offline') {
      tokenResponseLogger.warn('[TokenResponse] Force offline triggered at 70%');

      // Generate closing message via LLM
      const closingMessage = await generateClosingMessage(userName, interlocutor, true);

      // Set metadata flags for force offline
      state.metadata.shouldEndSession = true;
      state.metadata.forceEnd = true;
      state.metadata.forceOffline = true;
      state.metadata.terminationReason = 'token_limit';
      state.metadata.needMemoryUpdate = true;
      state.metadata.sessionStatus = 'indexing';
      state.metadata.usagePercent = usagePercent;
      state.generatedResponse = closingMessage;

      return {
        message: closingMessage,
        shouldEnd: true,
        forceEnd: true,
        forceOffline: true,
        needMemoryUpdate: true,
        sessionStatus: 'indexing',
        usagePercent
      };
    }

    // 2. Fatigue prompt (60% threshold)
    // Frontend will show dialog, response content is NOT modified
    if (action === 'fatigue_prompt') {
      tokenResponseLogger.info('[TokenResponse] Fatigue prompt triggered at 60%');

      // Set metadata flags for fatigue prompt - frontend handles dialog
      state.metadata.showFatiguePrompt = true;
      state.metadata.fatiguePromptType = 'soft';
      state.metadata.usagePercent = usagePercent;

      // DO NOT modify response content - frontend shows dialog
      state.generatedResponse = generatedResponse;

      return {
        message: generatedResponse,
        shouldEnd: false,
        showFatiguePrompt: true,
        fatiguePromptType: 'soft',
        usagePercent
      };
    }

    // 3. Continue after fatigue (user chose to continue)
    if (action === 'continue_after_fatigue') {
      tokenResponseLogger.info('[TokenResponse] Continuing after fatigue prompt');

      // Keep fatigue flag for frontend awareness but continue conversation
      state.metadata.userChoseToContinue = true;
      state.generatedResponse = generatedResponse;

      return {
        message: generatedResponse,
        shouldEnd: false,
        userChoseToContinue: true
      };
    }

    // 4. Normal flow - continue conversation
    state.generatedResponse = generatedResponse;

    return {
      message: generatedResponse,
      shouldEnd: false
    };

  } catch (error) {
    tokenResponseLogger.error('[TokenResponse] Processing failed:', error);
    state.generatedResponse = state.generatedResponse || '抱歉，我暂时无法回应，请稍后再试。';
    return {
      message: state.generatedResponse,
      shouldEnd: false
    };
  }
}

/**
 * 生成结束对话的语句
 * @param {string} userName - 角色卡主人名字
 * @param {Object} interlocutor - 对话者信息
 * @param {boolean} isForceEnd - 是否强制结束
 * @returns {Promise<string>} 结束语句
 */
async function generateClosingMessage(userName, interlocutor, isForceEnd) {
  try {
    const relationType = interlocutor?.relationType || 'stranger';
    const specificRelation = interlocutor?.specificRelation || '朋友';

    let prompt;
    if (isForceEnd) {
      prompt = `你是一位名叫${userName}的长者，正在和你的${specificRelation}聊天。

由于聊天时间较长，需要自然地结束这次对话。

请生成一句简短、温暖的结束语（20-30字），要求：
1. 符合${userName}的说话风格
2. 表达对下次聊天的期待
3. 语气自然、亲切

只输出结束语，不要其他内容。`;
    } else {
      prompt = `你是一位名叫${userName}的长者，正在和你的${specificRelation}聊天。

用户表示要结束对话了，请生成一句告别语（15-25字），要求：
1. 符合${userName}的说话风格
2. 简短温暖
3. 期待下次见面

只输出告别语，不要其他内容。`;
    }

    const response = await llmClient.generate(prompt);
    return response?.trim() || '今天聊得很开心，下次再聊吧！';

  } catch (error) {
    logger.error('[TokenResponse] 生成结束语句失败:', error);
    return '今天聊得很开心，下次再聊吧！';
  }
}

/**
 * Check if conversation should end (force offline)
 * @param {Object} tokenInfo - Token info
 * @returns {boolean}
 */
export function shouldEndConversation(tokenInfo) {
  if (!tokenInfo) return false;
  return tokenInfo.action === 'force_offline';
}

/**
 * Check if fatigue prompt should be shown
 * @param {Object} tokenInfo - Token info
 * @returns {boolean}
 */
export function shouldShowFatiguePrompt(tokenInfo) {
  if (!tokenInfo) return false;
  return tokenInfo.action === 'fatigue_prompt';
}

/**
 * Get token info summary
 * @param {Object} tokenInfo - Token info
 * @returns {Object}
 */
export function getTokenInfoSummary(tokenInfo) {
  if (!tokenInfo) {
    return { available: false };
  }

  return {
    available: true,
    action: tokenInfo.action,
    usageRatio: tokenInfo.usageRatio ? Math.round(tokenInfo.usageRatio * 100) + '%' : 'unknown',
    model: tokenInfo.modelUsed,
    contextLimit: tokenInfo.contextLimit,
    totalTokens: tokenInfo.usage?.total,
    shouldEnd: shouldEndConversation(tokenInfo),
    shouldShowFatiguePrompt: shouldShowFatiguePrompt(tokenInfo)
  };
}

export default tokenResponseNode;
