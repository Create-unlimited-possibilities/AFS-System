/**
 * Token Monitor Node
 * Monitors token usage and triggers warnings/termination when approaching context limits
 *
 * @author AFS Team
 * @version 1.0.0
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
  'qwen2.5': 32768,
  'default': 65536
};

// Thresholds
const THRESHOLDS = {
  gentleReminder: 0.6,  // 60% - hint at ending
  forceTerminate: 0.7   // 70% - force end
};

// Response buffer for LLM generation
const RESPONSE_BUFFER = 1000;

// End intent phrases (Chinese)
const END_INTENT_PHRASES = [
  // Common goodbyes
  '结束对话', '不聊了', '再见', '拜拜', '下次聊',
  // Casual endings
  '先这样', '挂了', '走了', 'bye', 'goodbye',
  // Polite endings
  '今天就到这里', '不说了', '改天聊', '先忙',
  // Additional variations
  '下线了', '去忙了', '先走了', '回头聊',
  '没空了', '有事', '得走了', '要走了',
  'byebye', '晚安', '回见', '再会'
];

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
    let message = null;

    if (usageRatio >= THRESHOLDS.forceTerminate) {
      action = 'terminate';
      message = await generateTerminationMessage(state, usageRatio);
      tokenLogger.warn('[TokenMonitor] Conversation approaching limit - terminating', {
        usageRatio: (usageRatio * 100).toFixed(1) + '%'
      });
    } else if (usageRatio >= THRESHOLDS.gentleReminder) {
      action = 'remind';
      message = await generateReminderMessage(state, usageRatio);
      tokenLogger.info('[TokenMonitor] Conversation usage high - sending reminder', {
        usageRatio: (usageRatio * 100).toFixed(1) + '%'
      });
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
      message,
      checkedAt: new Date().toISOString()
    };

    state.tokenInfo = tokenInfo;
    state.metadata = {
      ...state.metadata,
      tokenInfo: {
        usageRatio: Math.round(usageRatio * 100),
        action
      }
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
 * Generate a reminder message about conversation length
 * TODO: Use LLM for personality-matched generation
 *
 * @param {Object} state - Conversation state
 * @param {number} usageRatio - Current token usage ratio
 * @returns {Promise<string>} Reminder message
 */
async function generateReminderMessage(state, usageRatio) {
  const percentage = Math.round(usageRatio * 100);
  const userName = state.userName || '';

  // Personality-based templates
  // TODO: Use roleCard personality for matching
  const templates = [
    `${userName ? userName + '，' : ''}我们的对话很愉快呢。不过提醒一下，对话内容已经比较长了（${percentage}%），如果你还有想说的话，可以继续聊，但可能快要到结束的时候了。`,
    `${userName ? userName + '，' : ''}聊得很开心！不过对话已经比较长了（${percentage}%），如果你还有什么想说的，我们可以继续，或者也可以找个别的时间再聊。`,
    `对了${userName ? '，' + userName : ''}，稍微提醒一下，我们的对话已经进行挺久了（${percentage}%）。如果还有什么重要的话想说，现在说挺好的，不然可能快要结束了。`
  ];

  // Select template based on sentiment score (if available)
  const sentimentScore = state.interlocutor?.sentimentScore || 50;
  const templateIndex = sentimentScore > 60 ? 0 : (sentimentScore > 40 ? 1 : 2);

  return templates[templateIndex];
}

/**
 * Generate a termination message for forced conversation end
 * TODO: Use LLM for personality-matched generation
 *
 * @param {Object} state - Conversation state
 * @param {number} usageRatio - Current token usage ratio
 * @returns {Promise<string>} Termination message
 */
async function generateTerminationMessage(state, usageRatio) {
  const userName = state.userName || '';
  const percentage = Math.round(usageRatio * 100);

  // Personality-based templates
  const templates = [
    `${userName ? userName + '，' : ''}今天聊得真开心！不过我们的对话已经很长了（${percentage}%），系统快要处理不过来了。我们改天再继续聊吧，我会记得我们今天说过的内容的。再见！`,
    `${userName ? userName + '，' : ''}非常抱歉，我们的对话已经非常长了（${percentage}%），系统需要休息一下。我很珍惜和你的每次对话，下次再聊吧！拜拜！`,
    `亲爱的${userName || '朋友'}，对话内容已经很长了（${percentage}%），为了避免系统出错，我们今天先聊到这里吧。我会把我们的对话好好保存起来的。下次见！`
  ];

  // Select template based on sentiment score
  const sentimentScore = state.interlocutor?.sentimentScore || 50;
  const templateIndex = sentimentScore > 60 ? 0 : (sentimentScore > 40 ? 1 : 2);

  return templates[templateIndex];
}

/**
 * Detect if user message indicates intent to end conversation
 *
 * @param {string} message - User message to analyze
 * @returns {Object} Detection result with isEndIntent and confidence
 */
export function detectEndIntent(message) {
  if (!message || typeof message !== 'string') {
    return { isEndIntent: false, confidence: 0, matchedPhrase: null };
  }

  const normalizedMessage = message.toLowerCase().trim();

  // Check for exact matches first (high confidence)
  for (const phrase of END_INTENT_PHRASES) {
    if (normalizedMessage === phrase.toLowerCase()) {
      return {
        isEndIntent: true,
        confidence: 1.0,
        matchedPhrase: phrase,
        matchType: 'exact'
      };
    }
  }

  // Check for phrase inclusion (medium confidence)
  for (const phrase of END_INTENT_PHRASES) {
    if (normalizedMessage.includes(phrase.toLowerCase())) {
      // Higher confidence if phrase is at end of message
      const isAtEnd = normalizedMessage.endsWith(phrase.toLowerCase());
      return {
        isEndIntent: true,
        confidence: isAtEnd ? 0.9 : 0.7,
        matchedPhrase: phrase,
        matchType: 'include'
      };
    }
  }

  // Check for partial matches with key words
  const endKeywords = ['结束', '再见', '拜拜', 'bye', 'goodbye', '不聊'];
  let matchCount = 0;
  let matchedKeywords = [];

  for (const keyword of endKeywords) {
    if (normalizedMessage.includes(keyword.toLowerCase())) {
      matchCount++;
      matchedKeywords.push(keyword);
    }
  }

  if (matchCount > 0) {
    return {
      isEndIntent: true,
      confidence: Math.min(0.5 + (matchCount * 0.15), 0.85),
      matchedPhrase: matchedKeywords.join(', '),
      matchType: 'keyword'
    };
  }

  return { isEndIntent: false, confidence: 0, matchedPhrase: null };
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
