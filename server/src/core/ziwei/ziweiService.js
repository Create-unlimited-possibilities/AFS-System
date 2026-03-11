/**
 * Ziwei (Purple Star Astrology) Service
 * Based on iztro library for natal chart computation
 *
 * This service provides functions to:
 * - Compute natal charts (本命盘) using birth data
 * - Compute horoscope (运限) for specific dates
 * - Extract simplified chart data for storage
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { astro } from 'iztro';

/**
 * Compute natal chart (本命盘) based on birth information
 *
 * @param {Object} params - Calculation parameters
 * @param {string} params.birthDate - Birth date in YYYY-MM-DD format
 * @param {number} params.hourIndex - Shichen index (0-12) for birth hour
 *   - 0: 早子时 (00:00~01:00)
 *   - 1: 丑时 (01:00~03:00)
 *   - 2: 寅时 (03:00~05:00)
 *   - 3: 卯时 (05:00~07:00)
 *   - 4: 辰时 (07:00~09:00)
 *   - 5: 巳时 (09:00~11:00)
 *   - 6: 午时 (11:00~13:00)
 *   - 7: 未时 (13:00~15:00)
 *   - 8: 申时 (15:00~17:00)
 *   - 9: 酉时 (17:00~19:00)
 *   - 10: 戌时 (19:00~21:00)
 *   - 11: 亥时 (21:00~23:00)
 *   - 12: 晚子时 (23:00~00:00)
 * @param {string} params.gender - Gender in iztro format ('male' or 'female')
 * @param {boolean} [params.isSolar=true] - Whether birth date is solar calendar
 * @returns {Object} Astrolabe object containing complete natal chart data
 * @throws {Error} If computation fails
 *
 * @example
 * const chart = computeNatalChart({
 *   birthDate: '1990-05-15',
 *   hourIndex: 6,  // 午时 (11:00-13:00)
 *   gender: 'male',
 *   isSolar: true
 * });
 */
export function computeNatalChart({ birthDate, hourIndex, gender, isSolar = true }) {
  try {
    // Validate required parameters
    if (!birthDate) {
      throw new Error('birthDate is required');
    }
    if (hourIndex === undefined || hourIndex === null) {
      throw new Error('hourIndex is required');
    }
    if (!gender) {
      throw new Error('gender is required');
    }

    // Validate hourIndex range (0-12, because iztro splits 子时 into early and late)
    if (hourIndex < 0 || hourIndex > 12) {
      throw new Error(`hourIndex must be between 0-12, got ${hourIndex}`);
    }

    // Validate gender
    if (!['male', 'female'].includes(gender)) {
      throw new Error(`gender must be 'male' or 'female', got ${gender}`);
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(birthDate)) {
      throw new Error(`birthDate must be in YYYY-MM-DD format, got ${birthDate}`);
    }

    // Compute chart based on calendar type
    if (isSolar) {
      // Solar calendar (阳历) - isLeapMonth is not applicable for solar dates
      return astro.bySolar(birthDate, hourIndex, gender, false, 'zh-CN');
    } else {
      // Lunar calendar (阴历)
      // Parameters: birthDate, hourIndex, gender, isLeapMonth, config/language
      return astro.byLunar(birthDate, hourIndex, gender, false, true, 'zh-CN');
    }
  } catch (error) {
    throw new Error(`Failed to compute natal chart: ${error.message}`);
  }
}

/**
 * Compute horoscope (运限) - fleeting fortune for a specific date
 *
 * @param {Object} astrolabe - Natal chart astrolabe object from computeNatalChart
 * @param {string} targetDate - Target date in YYYY-MM-DD format
 * @returns {Object} Horoscope data containing yearly/monthly/daily fortune
 * @throws {Error} If computation fails
 *
 * @example
 * const horoscope = computeHoroscope(natalChart, '2026-02-25');
 */
export function computeHoroscope(astrolabe, targetDate) {
  try {
    if (!astrolabe) {
      throw new Error('astrolabe is required');
    }
    if (!targetDate) {
      throw new Error('targetDate is required');
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(targetDate)) {
      throw new Error(`targetDate must be in YYYY-MM-DD format, got ${targetDate}`);
    }

    return astrolabe.horoscope(targetDate);
  } catch (error) {
    throw new Error(`Failed to compute horoscope: ${error.message}`);
  }
}

/**
 * Get simplified chart data for storage or transmission
 * Extracts essential information from the full astrolabe
 *
 * @param {Object} astrolabe - Complete astrolabe object from computeNatalChart
 * @returns {Object} Simplified chart data with key information
 *
 * @example
 * const simplified = getSimplifiedChartData(natalChart);
 * // Returns: { solarDate, lunarDate, zodiac, sign, soul, body, palaces: [...] }
 */
export function getSimplifiedChartData(astrolabe) {
  if (!astrolabe) {
    throw new Error('astrolabe is required');
  }

  return {
    // Date information
    solarDate: astrolabe.solarDate,
    lunarDate: astrolabe.lunarDate,
    chineseDate: astrolabe.chineseDate,

    // Time information
    time: astrolabe.time,

    // Zodiac and sign
    zodiac: astrolabe.zodiac,
    sign: astrolabe.sign,

    // Soul and body palaces
    soul: astrolabe.soul,
    body: astrolabe.body,

    // Five elements class (命主)
    fiveElementsClass: astrolabe.fiveElementsClass,

    // Palace information
    palaces: astrolabe.palaces.map(palace => ({
      name: palace.name,
      heavenlyStem: palace.heavenlyStem,
      earthlyBranch: palace.earthlyBranch,
      majorStars: palace.majorStars.map(star => ({
        name: star.name,
        brightness: star.brightness,
        type: star.type
      })),
      minorStars: palace.minorStars.map(star => ({
        name: star.name,
        type: star.type
      })),
      decorativeStars: palace.decorativeStars ? palace.decorativeStars.map(star => ({
        name: star.name
      })) : []
    }))
  };
}

/**
 * Get palace information by name
 *
 * @param {Object} astrolabe - Astrolabe object
 * @param {string} palaceName - Name of the palace (e.g., '命宫', '财帛')
 * @returns {Object|null} Palace information or null if not found
 */
export function getPalaceByName(astrolabe, palaceName) {
  if (!astrolabe || !astrolabe.palaces) {
    return null;
  }
  return astrolabe.palaces.find(p => p.name === palaceName) || null;
}

/**
 * Get major stars in a specific palace
 *
 * @param {Object} astrolabe - Astrolabe object
 * @param {string} palaceName - Name of the palace
 * @returns {Array} Array of major star names
 */
export function getMajorStarsInPalace(astrolabe, palaceName) {
  const palace = getPalaceByName(astrolabe, palaceName);
  if (!palace || !palace.majorStars) {
    return [];
  }
  return palace.majorStars.map(star => star.name);
}

/**
 * Validate birth parameters before computing chart
 *
 * @param {Object} params - Parameters to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
export function validateBirthParams({ birthDate, hourIndex, gender, isSolar }) {
  const errors = [];

  if (!birthDate) {
    errors.push('birthDate is required');
  } else {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(birthDate)) {
      errors.push('birthDate must be in YYYY-MM-DD format');
    } else {
      const date = new Date(birthDate);
      if (isNaN(date.getTime())) {
        errors.push('birthDate is not a valid date');
      }
    }
  }

  if (hourIndex === undefined || hourIndex === null) {
    errors.push('hourIndex is required');
  } else if (typeof hourIndex !== 'number' || hourIndex < 0 || hourIndex > 12) {
    errors.push('hourIndex must be a number between 0-12');
  }

  if (!gender) {
    errors.push('gender is required');
  } else if (!['male', 'female'].includes(gender)) {
    errors.push('gender must be "male" or "female"');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export default {
  computeNatalChart,
  computeHoroscope,
  getSimplifiedChartData,
  getPalaceByName,
  getMajorStarsInPalace,
  validateBirthParams
};
