/**
 * Token Response Node
 * Handles response modification based on token monitoring results
 *
 * @author AFS Team
 * @version 1.0.0
 */

import logger from '../../../core/utils/logger.js';

const tokenResponseLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'TOKEN_RESPONSE' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'TOKEN_RESPONSE' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'TOKEN_RESPONSE' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'TOKEN_RESPONSE' }),
};

/**
 * Token Response Node
 * Modifies response based on token monitoring action
 *
 * @param {Object} state - Current conversation state
 * @returns {Promise<Object|null>} Modified response or null if no modification needed
 */
export async function tokenResponseNode(state) {
  try {
    const tokenInfo = state.tokenInfo;

    // No token info - continue normally
    if (!tokenInfo) {
      tokenResponseLogger.debug('[TokenResponse] No token info available, continuing');
      return null;
    }

    const { action, message, usageRatio } = tokenInfo;

    tokenResponseLogger.info('[TokenResponse] Processing token action', {
      action,
      usageRatio: usageRatio ? (usageRatio * 100).toFixed(1) + '%' : 'unknown'
    });

    // Handle termination - override response completely
    if (action === 'terminate') {
      tokenResponseLogger.warn('[TokenResponse] Terminating conversation due to token limit');

      // Override the generated response with termination message
      state.generatedResponse = message || '我们的对话已经很长了，今天先到这里吧。再见！';

      // Set metadata flags
      state.metadata = {
        ...state.metadata,
        tokenTerminated: true,
        shouldEndSession: true,
        terminationReason: 'token_limit',
        terminationRatio: usageRatio
      };

      tokenResponseLogger.info('[TokenResponse] Conversation terminated', {
        responseLength: state.generatedResponse.length
      });

      return {
        message: state.generatedResponse,
        metadata: {
          tokenTerminated: true,
          shouldEndSession: true
        }
      };
    }

    // Handle reminder - add warning metadata (frontend handles display)
    if (action === 'remind') {
      tokenResponseLogger.info('[TokenResponse] Adding token warning to response');

      state.metadata = {
        ...state.metadata,
        tokenWarning: true,
        tokenWarningMessage: message,
        tokenWarningRatio: usageRatio
      };

      // Don't modify the response itself, just add metadata
      // Frontend will handle displaying the warning appropriately

      tokenResponseLogger.debug('[TokenResponse] Token warning added to metadata');

      return null;
    }

    // Continue normally
    return null;

  } catch (error) {
    tokenResponseLogger.error('[TokenResponse] Error processing token response', {
      error: error.message,
      stack: error.stack
    });

    // On error, don't modify anything - let the conversation continue
    return null;
  }
}

/**
 * Check if conversation should end based on token info
 * @param {Object} tokenInfo - Token monitoring info
 * @returns {boolean} Whether to end the conversation
 */
export function shouldEndConversation(tokenInfo) {
  return tokenInfo?.action === 'terminate';
}

/**
 * Check if token warning should be shown
 * @param {Object} tokenInfo - Token monitoring info
 * @returns {boolean} Whether to show warning
 */
export function shouldShowWarning(tokenInfo) {
  return tokenInfo?.action === 'remind';
}

/**
 * Get token info summary for logging/display
 * @param {Object} tokenInfo - Token monitoring info
 * @returns {Object} Summary object
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
    totalTokens: tokenInfo.usage?.total
  };
}

export default tokenResponseNode;
