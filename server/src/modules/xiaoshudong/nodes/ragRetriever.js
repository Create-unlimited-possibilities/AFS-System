/**
 * RAG Retriever Node for XiaoShuDong
 * Retrieves relevant book content from ChromaDB
 *
 * This node:
 * 1. Builds query from user input and chart data
 * 2. Identifies relevant palaces based on keywords
 * 3. Retrieves relevant book chunks from ChromaDB
 * 4. Stores results in state.ragContext
 *
 * @author AFS Team
 * @version 1.0.0
 */

import ziweiRag from '../../../core/ziwei/ziweiRag.js';
import logger from '../../../core/utils/logger.js';

/**
 * Palace name keywords for context extraction
 * Maps common user keywords to palace names
 */
const PALACE_KEYWORDS = {
  '事业': '命宫',
  '前途': '命宫',
  '财运': '财帛宫',
  '财富': '财帛宫',
  '金钱': '财帛宫',
  '感情': '夫妻宫',
  '婚姻': '夫妻宫',
  '配偶': '夫妻宫',
  '健康': '疾厄宫',
  '身体': '疾厄宫',
  '家庭': '田宅宫',
  '房产': '田宅宫',
  '子女': '子女宫',
  '小孩': '子女宫',
  '朋友': '交友宫',
  '人脉': '交友宫',
  '兄弟姐妹': '兄弟宫',
  '父母': '父母宫',
  '旅行': '迁移宫',
  '出差': '迁移宫'
};

/**
 * Retrieve relevant book content based on chart and user input
 *
 * @param {XiaoShuDongState} state - Conversation state
 * @returns {Promise<XiaoShuDongState>} Updated state with RAG context
 *
 * @example
 * const state = new XiaoShuDongState({
 *   userId: 'user123',
 *   currentInput: '我的事业发展如何',
 *   natalChart: { palaces: [...] }
 * });
 * const result = await ragRetrieverNode(state);
 * // result.ragContext - Array of relevant book chunks
 */
export async function ragRetrieverNode(state) {
  try {
    logger.info(`[RagRetriever] Retrieving context for user: ${state.userId}`);

    // Build query from chart data and user input
    const queryParts = [state.currentInput || ''];

    // Add palace/star context from chart if available
    if (state.natalChart && state.natalChart.palaces) {
      const input = (state.currentInput || '').toLowerCase();
      const relevantPalaces = identifyRelevantPalaces(input, state.natalChart);

      // Add relevant palace information to query
      for (const palace of relevantPalaces) {
        const stars = palace.majorStars?.join(' ') || '';
        queryParts.push(`${palace.name} ${stars}`.trim());
      }

      // Log identified palaces
      if (relevantPalaces.length > 0) {
        logger.info(
          `[RagRetriever] Identified relevant palaces: ${relevantPalaces.map(p => p.name).join(', ')}`
        );
      }
    }

    const query = queryParts.join(' ').trim();

    // Skip RAG if no meaningful query (need at least 1 character if there's palace context)
    if (!query) {
      logger.warn('[RagRetriever] Empty query, skipping RAG');
      state.ragContext = [];
      state.metadata.ragRetrieved = false;
      state.metadata.ragRetrievalError = 'Empty query';
      return state;
    }

    // Retrieve from ChromaDB
    const results = await ziweiRag.retrieve(query, 5);

    state.ragContext = results || [];
    state.metadata.ragRetrieved = (results || []).length > 0;
    state.metadata.ragRetrievedAt = new Date();
    state.metadata.ragQueryUsed = query.substring(0, 100);

    logger.info(`[RagRetriever] Retrieved ${state.ragContext.length} relevant chunks`);

    return state;
  } catch (error) {
    logger.error('[RagRetriever] Failed to retrieve:', error);
    state.addError(error);
    state.ragContext = [];
    state.metadata.ragRetrieved = false;
    state.metadata.ragRetrievalError = error.message;
    return state;
  }
}

/**
 * Identify relevant palaces based on user input keywords
 *
 * @param {string} input - User input text
 * @param {Object} natalChart - Natal chart data
 * @returns {Array} Array of relevant palace objects
 */
export function identifyRelevantPalaces(input, natalChart) {
  if (!input || !natalChart || !natalChart.palaces) {
    return [];
  }

  const inputLower = input.toLowerCase();
  const relevantPalaces = [];

  for (const [keyword, palaceName] of Object.entries(PALACE_KEYWORDS)) {
    if (inputLower.includes(keyword)) {
      const palace = natalChart.palaces.find(p => p.name === palaceName);
      if (palace) {
        relevantPalaces.push({
          name: palaceName,
          keyword: keyword,
          majorStars: palace.majorStars?.map(s => s.name).filter(n => n) || [],
          description: `${palaceName} (triggered by "${keyword}")`
        });
      }
    }
  }

  return relevantPalaces;
}

/**
 * Get RAG context from state (helper function)
 *
 * @param {XiaoShuDongState} state - Conversation state
 * @returns {Array} RAG context chunks
 */
export function getRagContext(state) {
  return state.ragContext || [];
}

/**
 * Check if RAG was successfully retrieved
 *
 * @param {XiaoShuDongState} state - Conversation state
 * @returns {boolean} True if RAG context is available
 */
export function hasRagContext(state) {
  return state.metadata?.ragRetrieved === true && state.ragContext && state.ragContext.length > 0;
}

/**
 * Format RAG context as readable text
 *
 * @param {XiaoShuDongState} state - Conversation state
 * @param {number} [maxItems=3] - Maximum items to include
 * @returns {string} Formatted RAG context text
 */
export function formatRagContext(state, maxItems = 3) {
  const context = getRagContext(state);
  if (context.length === 0) {
    return '';
  }

  let text = '参考紫微斗数书籍内容：\n';
  const itemsToShow = Math.min(context.length, maxItems);

  for (let i = 0; i < itemsToShow; i++) {
    const item = context[i];
    text += `${i + 1}. ${item.content}\n`;
    if (item.source) {
      text += `   来源：${item.source}\n`;
    }
  }

  return text;
}

export default ragRetrieverNode;
