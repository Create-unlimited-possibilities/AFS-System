/**
 * Token Monitor Node
 * Monitors token usage and triggers warnings/termination when approaching context limits
 *
 * @author AFS Team
 * @version 2.0.0
 *
 * 注意：结束意图检测已移至 inputProcessor.js，使用 LLM 语义判断
 */

import logger from '../../../core/utils/logger.js';

const tokenLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'TOKEN_MONITOR' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'TOKEN_MONITOR' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'TOKEN_MONITOR' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'TOKEN_MONITOR' }),
};

// Model context limits
const MODEL_LIMITS = {
  'deepseek-r1:14b': 65536,
  'deepseek-r1': 65536,
  'deepseek-chat': 65536,
  'deepseek-reasoner': 65536,
  'qwen2.5': 32768,
  'qwen2.5:7b': 32768,
  'default': 65536
};

// Thresholds for token-based prompts
const THRESHOLDS = {
  fatiguePrompt: 0.6,    // 60% - show fatigue dialog with user choice
  forceOffline: 0.7      // 70% - force offline and trigger indexing
};

// Response buffer for LLM generation
const RESPONSE_BUFFER = 1000;

/**
 * Token Monitor Node
 * Calculates token usage and determines if conversation should be warned or terminated
 *
 * @param {Object} state - Current conversation state
 * @returns {Promise<Object>} Updated state with tokenInfo
 */
export async function tokenMonitorNode(state) {
  try {
    tokenLogger.info('[TokenMonitor] Starting token monitoring');

    const modelUsed = state.metadata?.modelUsed || 'deepseek-r1:14b';
    const contextLimit = MODEL_LIMITS[modelUsed] || MODEL_LIMITS.default;

    // Calculate token usage
    const tokenUsage = calculateConversationTokens(state);
    const totalTokens = tokenUsage.total + RESPONSE_BUFFER;
    const usageRatio = totalTokens / contextLimit;

    tokenLogger.info('[TokenMonitor] Token usage calculated', {
      systemPrompt: tokenUsage.systemPrompt,
      messages: tokenUsage.messages,
      memories: tokenUsage.memories,
      currentInput: tokenUsage.currentInput,
      total: tokenUsage.total,
      withBuffer: totalTokens,
      contextLimit,
      usageRatio: (usageRatio * 100).toFixed(1) + '%'
    });

    // Determine action based on thresholds
    let action = 'continue';

    if (usageRatio >= THRESHOLDS.forceOffline) {
      // 70% - Force offline: trigger memory save and indexing
      action = 'force_offline';
      tokenLogger.warn('[TokenMonitor] Token usage at 70% - forcing offline for indexing', {
        usageRatio: (usageRatio * 100).toFixed(1) + '%'
      });
    } else if (usageRatio >= THRESHOLDS.fatiguePrompt) {
      // 60% - Show fatigue dialog with user choice
      // Only show if user hasn't already chosen to continue
      if (!state.metadata?.userChoseToContinue) {
        action = 'fatigue_prompt';
        tokenLogger.info('[TokenMonitor] Token usage at 60% - triggering fatigue dialog', {
          usageRatio: (usageRatio * 100).toFixed(1) + '%'
        });
      } else {
        // User chose to continue, keep conversation going until 70%
        action = 'continue_after_fatigue';
        tokenLogger.info('[TokenMonitor] User chose to continue after fatigue prompt', {
          usageRatio: (usageRatio * 100).toFixed(1) + '%'
        });
      }
    }

    // Store token info in state
    const tokenInfo = {
      modelUsed,
      contextLimit,
      usage: {
        systemPrompt: tokenUsage.systemPrompt,
        messages: tokenUsage.messages,
        memories: tokenUsage.memories,
        currentInput: tokenUsage.currentInput,
        responseBuffer: RESPONSE_BUFFER,
        total: totalTokens
      },
      usageRatio,
      action,
      checkedAt: new Date().toISOString()
    };

    state.tokenInfo = tokenInfo;

    // Update metadata with token info and action-specific flags
    const metadataUpdates = {
      tokenInfo: {
        usageRatio: Math.round(usageRatio * 100),
        action
      }
    };

    // Set action-specific metadata flags
    if (action === 'fatigue_prompt') {
      metadataUpdates.showFatiguePrompt = true;
      metadataUpdates.fatiguePromptType = 'soft';
      metadataUpdates.usagePercent = Math.round(usageRatio * 100);
    } else if (action === 'force_offline') {
      metadataUpdates.forceOffline = true;
      metadataUpdates.needMemoryUpdate = true;
      metadataUpdates.sessionStatus = 'indexing';
      metadataUpdates.usagePercent = Math.round(usageRatio * 100);
    }

    state.metadata = {
      ...state.metadata,
      ...metadataUpdates
    };

    return state;

  } catch (error) {
    tokenLogger.error('[TokenMonitor] Error during token monitoring', {
      error: error.message,
      stack: error.stack
    });

    // On error, allow conversation to continue
    state.tokenInfo = {
      action: 'continue',
      error: error.message
    };

    return state;
  }
}

/**
 * Calculate token usage for all conversation components
 * @param {Object} state - Conversation state
 * @returns {Object} Token counts by component
 */
function calculateConversationTokens(state) {
  const counts = {
    systemPrompt: 0,
    messages: 0,
    memories: 0,
    currentInput: 0,
    total: 0
  };

  // System prompt tokens
  if (state.systemPrompt) {
    counts.systemPrompt = estimateTokens(state.systemPrompt);
  }

  // Message history tokens
  if (state.messages && Array.isArray(state.messages)) {
    for (const msg of state.messages) {
      if (msg.content) {
        counts.messages += estimateTokens(msg.content);
      }
    }
  }

  // Retrieved memories tokens
  if (state.retrievedMemories && Array.isArray(state.retrievedMemories)) {
    for (const memory of state.retrievedMemories) {
      // Memory could be string or object with content
      const content = typeof memory === 'string'
        ? memory
        : (memory.content || memory.summary || JSON.stringify(memory));
      counts.memories += estimateTokens(content);
    }
  }

  // Current input tokens
  if (state.currentInput) {
    counts.currentInput = estimateTokens(state.currentInput);
  }

  // Calculate total
  counts.total = counts.systemPrompt + counts.messages + counts.memories + counts.currentInput;

  return counts;
}

/**
 * Estimate token count for text
 * Uses character-based estimation:
 * - Chinese characters: ~1.5 tokens each
 * - English/ASCII: ~0.25 tokens per character (4 chars per token)
 *
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
export function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;

  let tokenCount = 0;

  for (const char of text) {
    const code = char.charCodeAt(0);

    if (code >= 0x4E00 && code <= 0x9FFF) {
      // CJK Unified Ideographs (Chinese characters)
      tokenCount += 1.5;
    } else if (code >= 0x3400 && code <= 0x4DBF) {
      // CJK Extension A
      tokenCount += 1.5;
    } else if (code >= 0x20000 && code <= 0x2A6DF) {
      // CJK Extension B
      tokenCount += 1.5;
    } else if (code >= 0x3000 && code <= 0x303F) {
      // CJK Symbols and Punctuation
      tokenCount += 1.0;
    } else if (code < 128) {
      // ASCII characters
      tokenCount += 0.25;
    } else {
      // Other Unicode (punctuation, symbols, etc.)
      tokenCount += 0.5;
    }
  }

  return Math.ceil(tokenCount);
}

/**
 * Get model context limit
 * @param {string} model - Model name
 * @returns {number} Context limit in tokens
 */
export function getModelContextLimit(model) {
  return MODEL_LIMITS[model] || MODEL_LIMITS.default;
}

/**
 * Get current thresholds
 * @returns {Object} Threshold configuration
 */
export function getThresholds() {
  return { ...THRESHOLDS };
}

export default tokenMonitorNode;
