/**
 * Direct Fortune RAG Retriever Node for Fortune Telling Branch
 * Retrieves chart data and RAG knowledge for direct fortune questions
 *
 * This node is a specialized wrapper around chartRagRetriever for the
 * direct fortune telling branch (user explicitly asks for fortune reading).
 *
 * Key differences from chartRagRetriever:
 * - Marks metadata as "direct_fortune" branch for downstream nodes
 * - Focuses on the user's direct question rather than listening assessment
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { chartRagRetrieverNode } from './chartRagRetriever.js';
import logger from '../../../core/utils/logger.js';

const directFortuneRagLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, module: 'DIRECT_FORTUNE_RAG' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, module: 'DIRECT_FORTUNE_RAG' }),
  warn: (msg, meta = {}) => logger.warn(msg, { ...meta, module: 'DIRECT_FORTUNE_RAG' }),
};

/**
 * Direct Fortune RAG Retriever Node
 * Wrapper that calls chartRagRetriever with direct fortune context
 *
 * @param {ConversationState} state - Conversation state
 * @returns {Promise<ConversationState>} Updated state with chart and RAG data
 */
export async function directFortuneRagNode(state) {
  try {
    directFortuneRagLogger.info(`[DirectFortuneRag] 开始算命预测分支检索: ${state.userId}`);

    // Mark this as direct fortune branch
    state.metadata.branch = 'direct_fortune';
    state.metadata.fortuneIntent = 'direct_question';

    // Use the existing chartRagRetriever logic
    const result = await chartRagRetrieverNode(state);

    // Add branch-specific metadata
    result.metadata.directFortuneRag = true;
    result.metadata.directFortuneRagAt = new Date();

    directFortuneRagLogger.info(
      `[DirectFortuneRag] 算命预测分支检索完成 - ` +
      `命宫主星: ${result.natalChart?.soul || '未知'}, ` +
      `RAG结果: ${result.ragContext?.length || 0}条`
    );

    return result;
  } catch (error) {
    directFortuneRagLogger.error('[DirectFortuneRag] 检索失败:', error);
    state.metadata.directFortuneRag = false;
    state.metadata.directFortuneRagError = error.message;

    if (state.addError) {
      state.addError(error);
    }

    return state;
  }
}

/**
 * Check if direct fortune RAG was successful
 * @param {ConversationState} state - Conversation state
 * @returns {boolean}
 */
export function hasDirectFortuneRag(state) {
  return state.metadata?.directFortuneRag === true;
}

export default directFortuneRagNode;
