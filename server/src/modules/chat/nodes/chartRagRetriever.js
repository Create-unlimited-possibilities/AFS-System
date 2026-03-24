/**
 * Chart RAG Retriever Node for Rolecard Venting Upgrade
 * Parallel retrieval of natal chart data and fortune-telling RAG knowledge
 *
 * This node:
 * 1. Retrieves pre-generated natal chart from storage
 * 2. Retrieves relevant RAG knowledge based on user input and chart
 * 3. Executes both retrievals in parallel for efficiency
 *
 * @author AFS Team
 * @version 1.0.0
 */

import ZiweiChartService from '../../ziwei/services/ziweiChartService.js';
import ziweiRag from '../../../core/ziwei/ziweiRag.js';
import logger from '../../../core/utils/logger.js';

const chartRagLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, module: 'CHART_RAG_RETRIEVER' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, module: 'CHART_RAG_RETRIEVER' }),
  warn: (msg, meta = {}) => logger.warn(msg, { ...meta, module: 'CHART_RAG_RETRIEVER' }),
  debug: (msg, meta = {}) => logger.debug(msg, { ...meta, module: 'CHART_RAG_RETRIEVER' }),
};

/**
 * Palace name keywords for context extraction
 */
const PALACE_KEYWORDS = {
  '事业': '命宫',
  '前途': '命宫',
  '工作': '官禄宫',
  '财运': '财帛宫',
  '财富': '财帛宫',
  '金钱': '财帛宫',
  '感情': '夫妻宫',
  '婚姻': '夫妻宫',
  '配偶': '夫妻宫',
  '恋爱': '夫妻宫',
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
 * Retrieve natal chart from storage
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Chart data or null
 */
async function retrieveNatalChart(userId) {
  try {
    let chart = await ZiweiChartService.getChart(userId);
    if (chart) {
      chartRagLogger.info(`[ChartRagRetriever] 命盘从MongoDB加载成功: ${userId}`);
      return chart;
    }
  } catch (dbError) {
    chartRagLogger.warn(`[ChartRagRetriever] MongoDB读取失败，尝试本地文件: ${dbError.message}`);
    try {
      const chart = await ZiweiChartService.getFromLocalFile(userId);
      if (chart) {
        chartRagLogger.info(`[ChartRagRetriever] 命盘从本地文件加载成功: ${userId}`);
        return chart;
      }
    } catch (fileError) {
      chartRagLogger.warn(`[ChartRagRetriever] 本地文件读取失败: ${fileError.message}`);
    }
  }
  return null;
}

/**
 * Format chart data into Markdown for LLM
 * @param {Object} natalChart - Natal chart data
 * @returns {string} Formatted chart text
 */
function formatChartForLLM(natalChart) {
  let md = '';

  md += `# 紫微斗数命盘\n\n`;

  // Basic info
  md += `## 基本信息\n\n`;
  if (natalChart.solarDate) md += `**公历**: ${natalChart.solarDate}\n`;
  if (natalChart.lunarDate) md += `**农历**: ${natalChart.lunarDate}\n`;
  if (natalChart.chineseDate) md += `**四柱**: ${natalChart.chineseDate}\n`;
  if (natalChart.zodiac) md += `**生肖**: ${natalChart.zodiac}\n`;
  if (natalChart.fiveElementsClass) md += `**命主**: ${natalChart.fiveElementsClass}\n`;
  if (natalChart.soul) md += `**命宫主星**: ${natalChart.soul}\n`;
  if (natalChart.body) md += `**身宫主星**: ${natalChart.body}\n`;
  md += `\n`;

  // Twelve palaces
  md += `## 十二宫详解\n\n`;
  if (natalChart.palaces && natalChart.palaces.length > 0) {
    for (const palace of natalChart.palaces) {
      md += `### ${palace.name}\n`;
      md += `天干地支: ${palace.heavenlyStem || ''}${palace.earthlyBranch || ''}\n`;

      if (palace.majorStars && palace.majorStars.length > 0) {
        const starsText = palace.majorStars.map(s => {
          return s.brightness ? `${s.name}(${s.brightness})` : s.name;
        }).join('、');
        md += `主星: ${starsText}\n`;
      } else {
        md += `主星: 无主星\n`;
      }

      if (palace.minorStars && palace.minorStars.length > 0) {
        md += `辅星: ${palace.minorStars.map(s => s.name).join('、')}\n`;
      }

      if (palace.adjectiveStars && palace.adjectiveStars.length > 0) {
        md += `杂曜: ${palace.adjectiveStars.map(s => s.name).join('、')}\n`;
      }

      if (palace.changsheng12) {
        md += `长生十二神: ${palace.changsheng12}\n`;
      }

      if (palace.decadal && palace.decadal.range) {
        md += `大限: ${palace.decadal.range}岁\n`;
      }

      md += `\n`;
    }
  }

  return md;
}

/**
 * Identify relevant palaces based on user input keywords
 * @param {string} input - User input text
 * @param {Object} natalChart - Natal chart data
 * @returns {Array} Array of relevant palace objects
 */
function identifyRelevantPalaces(input, natalChart) {
  if (!input || !natalChart || !natalChart.palaces) {
    return [];
  }

  const relevantPalaces = [];

  for (const [keyword, palaceName] of Object.entries(PALACE_KEYWORDS)) {
    if (input.includes(keyword)) {
      const palace = natalChart.palaces.find(p => p.name === palaceName);
      if (palace) {
        relevantPalaces.push({
          name: palaceName,
          keyword: keyword,
          majorStars: palace.majorStars?.map(s => s.name).filter(n => n) || [],
          description: `${palaceName} (关键词: "${keyword}")`
        });
      }
    }
  }

  return relevantPalaces;
}

/**
 * Retrieve RAG knowledge based on query
 * @param {string} query - Search query
 * @returns {Promise<Array>} RAG results
 */
async function retrieveRagKnowledge(query) {
  try {
    const results = await ziweiRag.retrieve(query, 5);
    return results || [];
  } catch (error) {
    chartRagLogger.warn(`[ChartRagRetriever] RAG检索失败: ${error.message}`);
    return [];
  }
}

/**
 * Chart RAG Retriever Node
 * Parallel retrieval of chart and RAG knowledge
 *
 * @param {ConversationState} state - Conversation state
 * @returns {Promise<ConversationState>} Updated state with chart and RAG data
 */
export async function chartRagRetrieverNode(state) {
  try {
    const userId = state.userId || '';
    const currentInput = state.currentInput || '';

    chartRagLogger.info(`[ChartRagRetriever] 开始并行检索: ${userId}`);

    // Parallel execution: retrieve chart and RAG knowledge simultaneously
    const [chart, ragContext] = await Promise.allSettled([
      retrieveNatalChart(userId),
      retrieveRagKnowledge(currentInput)
    ]);

    // Handle chart retrieval result
    let natalChart = null;
    let chartSource = 'none';
    if (chart.status === 'fulfilled' && chart.value) {
      natalChart = chart.value;
      chartSource = 'mongodb';
      // Check if it came from local file based on service behavior
      if (!chart.value._id) {
        chartSource = 'local_file';
      }
    }

    // Handle RAG retrieval result
    let ragResults = [];
    if (ragContext.status === 'fulfilled') {
      ragResults = ragContext.value;
    }

    // Store chart data in state
    if (natalChart) {
      state.natalChart = {
        solarDate: natalChart.solarDate,
        lunarDate: natalChart.lunarDate,
        chineseDate: natalChart.chineseDate,
        zodiac: natalChart.zodiac,
        fiveElementsClass: natalChart.fiveElementsClass,
        soul: natalChart.soul,
        body: natalChart.body,
        palaces: natalChart.palaces
      };

      state.relevantPalaces = identifyRelevantPalaces(currentInput, state.natalChart);
      state.formattedChartText = formatChartForLLM(state.natalChart);

      chartRagLogger.info(
        `[ChartRagRetriever] 命盘检索成功 - ` +
        `来源: ${chartSource}, ` +
        `相关宫位: ${state.relevantPalaces.map(p => p.name).join(', ') || '无'}`
      );
    } else {
      chartRagLogger.warn(`[ChartRagRetriever] 未找到命盘数据: ${userId}`);
      state.metadata.chartRetrievalError = 'No chart data found';
    }

    // Store RAG context in state
    state.ragContext = ragResults;

    chartRagLogger.info(`[ChartRagRetriever] RAG检索完成: ${ragResults.length}条结果`);

    // Update metadata
    state.metadata.chartRagRetrieved = true;
    state.metadata.chartRagRetrievedAt = new Date();
    state.metadata.chartSource = chartSource;
    state.metadata.ragResultsCount = ragResults.length;
    state.metadata.relevantPalaces = state.relevantPalaces?.map(p => p.name) || [];

    return state;
  } catch (error) {
    chartRagLogger.error('[ChartRagRetriever] 处理失败:', error);
    state.metadata.chartRagRetrieved = false;
    state.metadata.chartRagRetrievalError = error.message;

    if (state.addError) {
      state.addError(error);
    }

    return state;
  }
}

/**
 * Get natal chart from state
 * @param {ConversationState} state - Conversation state
 * @returns {Object|null} Natal chart data
 */
export function getNatalChart(state) {
  return state.natalChart || null;
}

/**
 * Get formatted chart text from state
 * @param {ConversationState} state - Conversation state
 * @returns {string} Formatted chart text
 */
export function getFormattedChartText(state) {
  return state.formattedChartText || '';
}

/**
 * Get RAG context from state
 * @param {ConversationState} state - Conversation state
 * @returns {Array} RAG context items
 */
export function getRagContext(state) {
  return state.ragContext || [];
}

/**
 * Get relevant palaces from state
 * @param {ConversationState} state - Conversation state
 * @returns {Array} Relevant palace objects
 */
export function getRelevantPalaces(state) {
  return state.relevantPalaces || [];
}

/**
 * Check if chart was successfully retrieved
 * @param {ConversationState} state - Conversation state
 * @returns {boolean}
 */
export function hasChart(state) {
  return state.metadata?.chartRagRetrieved === true && state.natalChart != null;
}

/**
 * Check if RAG context is available
 * @param {ConversationState} state - Conversation state
 * @returns {boolean}
 */
export function hasRagContext(state) {
  return state.ragContext && state.ragContext.length > 0;
}

/**
 * Format RAG context as readable text
 * @param {ConversationState} state - Conversation state
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

export default chartRagRetrieverNode;
