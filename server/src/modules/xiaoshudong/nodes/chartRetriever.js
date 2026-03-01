/**
 * Chart Retriever Node v3.0
 * Reads pre-generated natal chart from storage (MongoDB/Local file)
 *
 * This node:
 * 1. Reads pre-generated chart from ZiweiChartService (MongoDB or local file)
 * 2. Formats chart data in clean Markdown for LLM consumption
 * 3. Identifies relevant palaces based on user input
 *
 * @author AFS Team
 * @version 3.0.0
 */

import ZiweiChartService from '../../ziwei/services/ziweiChartService.js';
import logger from '../../../core/utils/logger.js';

const chartLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, module: 'CHART_RETRIEVER' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, module: 'CHART_RETRIEVER' }),
  warn: (msg, meta = {}) => logger.warn(msg, { ...meta, module: 'CHART_RETRIEVER' }),
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
 * Retrieve pre-generated natal chart from storage
 *
 * @param {XiaoShuDongState} state - Conversation state
 * @returns {Promise<XiaoShuDongState>} Updated state with natal chart
 */
export async function chartRetrieverNode(state) {
  try {
    chartLogger.info(`[ChartRetriever] Reading chart from storage for user: ${state.userId}`);

    // Try to get chart from storage (MongoDB first, then local file)
    let chart = null;

    try {
      chart = await ZiweiChartService.getChart(state.userId);
      chartLogger.info(`[ChartRetriever] Chart loaded from MongoDB for user: ${state.userId}`);
    } catch (dbError) {
      // Try local file as fallback
      chartLogger.warn(`[ChartRetriever] MongoDB read failed, trying local file: ${dbError.message}`);
      chart = await ZiweiChartService.getFromLocalFile(state.userId);

      if (chart) {
        chartLogger.info(`[ChartRetriever] Chart loaded from local file for user: ${state.userId}`);
      }
    }

    if (!chart) {
      chartLogger.warn(`[ChartRetriever] No chart found for user: ${state.userId}`);
      state.metadata.chartRetrieved = false;
      state.metadata.chartRetrievalError = 'No chart data found. Please generate chart first.';
      return state;
    }

    // Store chart data in state
    state.natalChart = {
      solarDate: chart.solarDate,
      lunarDate: chart.lunarDate,
      chineseDate: chart.chineseDate,
      zodiac: chart.zodiac,
      fiveElementsClass: chart.fiveElementsClass,
      soul: chart.soul,
      body: chart.body,
      palaces: chart.palaces
    };

    // Identify relevant palaces based on user input
    state.relevantPalaces = identifyRelevantPalaces(state.currentInput, state.natalChart);

    // Generate formatted chart text for LLM (clean Markdown)
    state.formattedChartText = formatChartForLLM(state.natalChart);

    state.metadata.chartRetrieved = true;
    state.metadata.chartRetrievedAt = new Date();
    state.metadata.chartSource = chart._id ? 'mongodb' : 'local_file';
    state.metadata.relevantPalaces = state.relevantPalaces.map(p => p.name);

    chartLogger.info(
      `[ChartRetriever] Chart retrieved successfully - ` +
      `Source: ${state.metadata.chartSource}, ` +
      `RelevantPalaces: ${state.metadata.relevantPalaces.join(', ') || 'none'}`
    );

    return state;

  } catch (error) {
    chartLogger.error('[ChartRetriever] Failed to retrieve chart:', error);
    state.addError(error);
    state.metadata.chartRetrieved = false;
    state.metadata.chartRetrievalError = error.message;
    return state;
  }
}

/**
 * Format chart data into clean Markdown for LLM consumption
 * No table characters (|), no constellation (星座), no horoscope (运限)
 *
 * @param {Object} natalChart - Natal chart data from storage
 * @returns {string} Formatted Markdown text
 */
function formatChartForLLM(natalChart) {
  let md = '';

  // Header
  md += `# 紫微斗数命盘\n\n`;

  // Basic info - clean format without table characters
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

      // Major stars with brightness
      if (palace.majorStars && palace.majorStars.length > 0) {
        const starsText = palace.majorStars.map(s => {
          if (s.brightness) {
            return `${s.name}(${s.brightness})`;
          }
          return s.name;
        }).join('、');
        md += `主星: ${starsText}\n`;
      } else {
        md += `主星: 无主星\n`;
      }

      // Minor stars
      if (palace.minorStars && palace.minorStars.length > 0) {
        md += `辅星: ${palace.minorStars.map(s => s.name).join('、')}\n`;
      }

      // Adjective stars (杂曜)
      if (palace.adjectiveStars && palace.adjectiveStars.length > 0) {
        md += `杂曜: ${palace.adjectiveStars.map(s => s.name).join('、')}\n`;
      }

      // Changsheng 12 (长生12神)
      if (palace.changsheng12) {
        md += `长生十二神: ${palace.changsheng12}\n`;
      }

      // Decadal range (大限范围)
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
 * Get relevant palaces from state
 */
export function getRelevantPalaces(state) {
  return state.relevantPalaces || [];
}

/**
 * Check if chart was successfully retrieved
 */
export function hasChart(state) {
  return state.metadata?.chartRetrieved === true && state.natalChart != null;
}

/**
 * Get formatted chart text for LLM
 */
export function getFormattedChartText(state) {
  return state.formattedChartText || '';
}

export default chartRetrieverNode;
