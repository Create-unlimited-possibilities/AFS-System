/**
 * Chart Retriever Node v2.0
 * Smart chart calculation with time-span aware horoscope selection
 *
 * This node:
 * 1. Fetches user profile from database
 * 2. Gets horoscope type from compressed data (daily/monthly/small_limit/major_limit)
 * 3. Computes natal chart + appropriate horoscope
 * 4. Formats chart data in beautiful Markdown for 8B model
 *
 * @author AFS Team
 * @version 2.0.0
 */

import {
  computeNatalChart,
  computeHoroscope,
  getSimplifiedChartData
} from '../../../core/ziwei/ziweiService.js';
import { genderToIztroFormat } from '../../../core/utils/timeConverter.js';
import User from '../../user/model.js';
import logger from '../../../core/utils/logger.js';

/**
 * Convert birth hour (0-23) to iztro hour index (0-12)
 * iztro has 13 time indices because 子时 is split into early (0) and late (12)
 */
function convertHourToIndex(birthHour) {
  if (typeof birthHour !== 'number') {
    throw new Error('birthHour must be a number');
  }
  if (birthHour === 23) return 12;  // 晚子时
  if (birthHour === 0) return 0;    // 早子时
  return Math.floor((birthHour + 1) / 2);
}

/**
 * Palace name keywords for context extraction
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
 * Shichen names for display
 */
const SHICHEN_NAMES = [
  '子时 (23:00-01:00)', '丑时 (01:00-03:00)', '寅时 (03:00-05:00)',
  '卯时 (05:00-07:00)', '辰时 (07:00-09:00)', '巳时 (09:00-11:00)',
  '午时 (11:00-13:00)', '未时 (13:00-15:00)', '申时 (15:00-17:00)',
  '酉时 (17:00-19:00)', '戌时 (19:00-21:00)', '亥时 (21:00-23:00)'
];

/**
 * Retrieve or compute natal chart with smart horoscope selection
 *
 * @param {XiaoShuDongState} state - Conversation state
 * @returns {Promise<XiaoShuDongState>} Updated state with natal chart and horoscope
 */
export async function chartRetrieverNode(state) {
  try {
    logger.info(`[ChartRetriever] Fetching chart for user: ${state.userId}`);

    // Get user profile
    const user = await User.findById(state.userId);
    if (!user) {
      logger.warn(`[ChartRetriever] User not found: ${state.userId}`);
      state.metadata.chartRetrieved = false;
      state.metadata.chartRetrievalError = 'User not found';
      return state;
    }

    const profile = user.profile || {};
    const birthDate = profile.birthDate;
    const birthHour = profile.birthHour;
    const birthCalendar = profile.birthCalendar || 'solar';
    const gender = genderToIztroFormat(profile.gender);

    // Check if we have all required fields
    // birthHour is stored as 0-23, we need to convert it to iztro index (0-12)
    if (!birthDate || birthHour === undefined || birthHour === null) {
      logger.warn(`[ChartRetriever] Incomplete birth info for user: ${state.userId}`);
      state.metadata.chartRetrieved = false;
      state.metadata.chartRetrievalError = 'Incomplete birth information';
      state.metadata.missingFields = [];
      if (!birthDate) state.metadata.missingFields.push('birthDate');
      if (birthHour === undefined || birthHour === null) state.metadata.missingFields.push('birthHour');
      return state;
    }

    // Convert birthHour (0-23) to iztro hour index (0-12)
    const hourIndex = convertHourToIndex(birthHour);

    // Format date as YYYY-MM-DD
    const dateStr = typeof birthDate === 'string'
      ? birthDate.split('T')[0]
      : new Date(birthDate).toISOString().split('T')[0];

    // Compute natal chart using iztro
    const astrolabe = computeNatalChart({
      birthDate: dateStr,
      hourIndex: hourIndex,
      gender,
      isSolar: birthCalendar === 'solar'
    });

    // Get simplified chart data
    state.natalChart = getSimplifiedChartData(astrolabe);

    // Get horoscope type from compressed data (determined by conversationCompressor)
    const horoscopeType = state.compressedData?.horoscopeType || 'monthly';
    const today = new Date().toISOString().split('T')[0];

    // Compute appropriate horoscope based on time span
    state.horoscope = computeHoroscope(astrolabe, today);
    state.horoscopeType = horoscopeType;

    // Identify relevant palaces based on user input
    state.relevantPalaces = identifyRelevantPalaces(state.currentInput, state.natalChart);

    // Generate formatted chart text for 8B model (beautiful Markdown)
    state.formattedChartText = formatChartForLLM(state.natalChart, state.horoscope, horoscopeType, profile);

    state.metadata.chartRetrieved = true;
    state.metadata.chartRetrievedAt = new Date();
    state.metadata.birthDateUsed = dateStr;
    state.metadata.birthHourUsed = birthHour;
    state.metadata.birthHourIndexUsed = hourIndex;
    state.metadata.calendarType = birthCalendar;
    state.metadata.horoscopeType = horoscopeType;

    logger.info(
      `[ChartRetriever] Chart computed - Date: ${dateStr}, Hour: ${birthHour} (index ${hourIndex}), ` +
      `HoroscopeType: ${horoscopeType}, ` +
      `RelevantPalaces: ${state.relevantPalaces.map(p => p.name).join(', ') || 'none'}`
    );

    return state;
  } catch (error) {
    logger.error('[ChartRetriever] Failed to compute chart:', error);
    state.addError(error);
    state.metadata.chartRetrieved = false;
    state.metadata.chartRetrievalError = error.message;
    return state;
  }
}

/**
 * Format chart data into beautiful Markdown for LLM consumption
 *
 * @param {Object} natalChart - Natal chart data
 * @param {Object} horoscope - Horoscope data
 * @param {string} horoscopeType - Type of horoscope focus
 * @param {Object} profile - User profile
 * @returns {string} Formatted Markdown text
 */
function formatChartForLLM(natalChart, horoscope, horoscopeType, profile) {
  let md = '';

  // Header
  md += `# 紫微斗数命盘分析\n\n`;

  // Basic info
  md += `## 基本信息\n\n`;
  md += `| 项目 | 内容 |\n`;
  md += `|------|------|\n`;
  if (natalChart.solarDate) md += `| 公历 | ${natalChart.solarDate} |\n`;
  if (natalChart.lunarDate) md += `| 农历 | ${natalChart.lunarDate} |\n`;
  if (natalChart.chineseDate) md += `| 四柱 | ${natalChart.chineseDate} |\n`;
  if (natalChart.zodiac) md += `| 生肖 | ${natalChart.zodiac} |\n`;
  if (natalChart.sign) md += `| 星座 | ${natalChart.sign} |\n`;
  if (natalChart.fiveElementsClass) md += `| 命主 | ${natalChart.fiveElementsClass} |\n`;
  if (natalChart.soul) md += `| 命宫 | ${natalChart.soul} |\n`;
  if (natalChart.body) md += `| 身宫 | ${natalChart.body} |\n`;
  md += `\n`;

  // Twelve palaces
  md += `## 十二宫详解\n\n`;
  if (natalChart.palaces && natalChart.palaces.length > 0) {
    for (const palace of natalChart.palaces) {
      md += `### ${palace.name}\n\n`;

      // Heavenly stem and earthly branch
      md += `**天干地支**: ${palace.heavenlyStem || ''}${palace.earthlyBranch || ''}\n\n`;

      // Major stars
      if (palace.majorStars && palace.majorStars.length > 0) {
        md += `**主星**: `;
        md += palace.majorStars.map(s => {
          let starText = s.name;
          if (s.brightness) starText += ` (${s.brightness})`;
          return starText;
        }).join('、');
        md += `\n\n`;
      } else {
        md += `**主星**: 无主星\n\n`;
      }

      // Minor stars
      if (palace.minorStars && palace.minorStars.length > 0) {
        md += `**辅星**: ${palace.minorStars.map(s => s.name).join('、')}\n\n`;
      }

      md += `---\n\n`;
    }
  }

  // Horoscope info based on type
  md += `## 运限分析\n\n`;
  md += `> 根据事件时间跨度，重点分析: **${getHoroscopeTypeLabel(horoscopeType)}**\n\n`;

  if (horoscope) {
    // Big limit (大限)
    if (horoscope.majorLimit) {
      md += `### 大限\n`;
      md += `- 年龄范围: ${horoscope.majorLimit.range || 'N/A'}\n`;
      if (horoscope.majorLimit.palaceName) {
        md += `- 所在宫位: ${horoscope.majorLimit.palaceName}\n`;
      }
      md += `\n`;
    }

    // Small limit (小限)
    if (horoscope.minorLimit) {
      md += `### 小限 (流年)\n`;
      md += `- 年龄: ${horoscope.minorLimit.age || 'N/A'}\n`;
      if (horoscope.minorLimit.palaceName) {
        md += `- 所在宫位: ${horoscope.minorLimit.palaceName}\n`;
      }
      md += `\n`;
    }

    // Yearly (流年)
    if (horoscope.yearly) {
      md += `### 流年 ${horoscope.yearly.age || ''}岁\n`;
      if (horoscope.yearly.palaceName) {
        md += `- 流年宫位: ${horoscope.yearly.palaceName}\n`;
      }
      md += `\n`;
    }

    // Monthly (流月)
    if (horoscope.monthly && (horoscopeType === 'monthly' || horoscopeType === 'weekly' || horoscopeType === 'daily')) {
      md += `### 流月\n`;
      if (horoscope.monthly.palaceName) {
        md += `- 流月宫位: ${horoscope.monthly.palaceName}\n`;
      }
      md += `\n`;
    }

    // Daily (流日)
    if (horoscope.daily && (horoscopeType === 'daily' || horoscopeType === 'weekly')) {
      md += `### 流日\n`;
      if (horoscope.daily.palaceName) {
        md += `- 流日宫位: ${horoscope.daily.palaceName}\n`;
      }
      md += `\n`;
    }
  }

  return md;
}

/**
 * Get human-readable label for horoscope type
 */
function getHoroscopeTypeLabel(type) {
  const labels = {
    'daily': '流日 (适合短期事件)',
    'weekly': '流周/流月 (适合一周内事件)',
    'monthly': '流月 (适合一个月内事件)',
    'small_limit': '小限 (适合多个月事件)',
    'major_limit': '大限 (适合长期事件)'
  };
  return labels[type] || '流月';
}

/**
 * Identify relevant palaces based on user input keywords
 */
function identifyRelevantPalaces(input, natalChart) {
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
          majorStars: palace.majorStars.map(s => s.name).filter(n => n),
          description: `${palaceName} (triggered by "${keyword}")`
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
