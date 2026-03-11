/**
 * ZiweiChart Service
 *
 * Handles storage and retrieval of ziwei natal charts with dual storage:
 * - MongoDB for structured queries
 * - Local file system for backup/analysis
 *
 * @author AFS Team
 * @version 1.0.0
 */

import ZiweiChart from '../models/ZiweiChart.js';
import { computeNatalChart, computeHoroscope } from '../../../core/ziwei/ziweiService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../..');

// Determine base path for local storage (Docker vs local)
const isDocker = process.env.DOCKER_CONTAINER === 'true' || process.env.NODE_ENV === 'docker';
const ZIWEI_DATA_PATH = isDocker
  ? '/app/storage/userdata'
  : path.join(projectRoot, 'server', 'storage', 'userdata');

/**
 * Convert Chinese gender to iztro format
 */
function convertGenderToIztro(gender) {
  if (gender === 'male' || gender === '男') {
    return 'male';
  }
  if (gender === 'female' || gender === '女') {
    return 'female';
  }
  throw new Error(`Invalid gender: ${gender}`);
}

/**
 * Convert birth hour (0-23) to iztro hour index (0-12)
 *
 * iztro has 13 time indices because 子时 is split into:
 * - earlyRatHour (index 0): 00:00~01:00
 * - lateRatHour (index 12): 23:00~00:00
 *
 * @param {number} birthHour - Birth hour (0-23)
 * @returns {number} iztro time index (0-12)
 */
function convertHourToIndex(birthHour) {
  if (typeof birthHour !== 'number') {
    throw new Error('birthHour must be a number');
  }

  // 晚子时 (23:00~00:00) -> index 12
  if (birthHour === 23) return 12;

  // 早子时 (00:00~01:00) -> index 0
  if (birthHour === 0) return 0;

  // Other hours: 丑(1-2)->1, 寅(3-4)->2, 卯(5-6)->3, 辰(7-8)->4, 巳(9-10)->5,
  //              午(11-12)->6, 未(13-14)->7, 申(15-16)->8, 酉(17-18)->9,
  //              戌(19-20)->10, 亥(21-22)->11
  const index = Math.floor((birthHour + 1) / 2);
  if (index < 0 || index > 12) {
    throw new Error(`Invalid birth hour: ${birthHour}`);
  }
  return index;
}

/**
 * Format date to YYYY-MM-DD for iztro
 */
function formatDateForIztro(date) {
  if (typeof date === 'string') {
    return date;
  }
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  throw new Error('Invalid date format');
}

/**
 * Convert iztro astrolabe to storage format
 * Preserves ALL fields from the astrolabe object
 */
function astrolabeToStorageFormat(astrolabe, inputParams) {
  return {
    // Basic information
    gender: astrolabe.gender,
    solarDate: astrolabe.solarDate,
    lunarDate: astrolabe.lunarDate,
    chineseDate: astrolabe.chineseDate,

    // Raw dates
    rawDates: {
      lunarDate: astrolabe.rawDates?.lunarDate,
      chineseDate: astrolabe.rawDates?.chineseDate
    },

    // Time
    time: astrolabe.time,
    timeRange: astrolabe.timeRange,

    // Zodiac and sign
    sign: astrolabe.sign,
    zodiac: astrolabe.zodiac,

    // Soul and body palace positions
    earthlyBranchOfSoulPalace: astrolabe.earthlyBranchOfSoulPalace,
    earthlyBranchOfBodyPalace: astrolabe.earthlyBranchOfBodyPalace,

    // Soul and body stars
    soul: astrolabe.soul,
    body: astrolabe.body,

    // Five elements class
    fiveElementsClass: astrolabe.fiveElementsClass,

    // All 12 palaces with complete data
    palaces: astrolabe.palaces.map(palace => ({
      index: palace.index,
      name: palace.name,
      isBodyPalace: palace.isBodyPalace,
      isOriginalPalace: palace.isOriginalPalace,
      heavenlyStem: palace.heavenlyStem,
      earthlyBranch: palace.earthlyBranch,
      majorStars: palace.majorStars,
      minorStars: palace.minorStars,
      adjectiveStars: palace.adjectiveStars,
      changsheng12: palace.changsheng12,
      boshi12: palace.boshi12,
      jiangqian12: palace.jiangqian12,
      suiqian12: palace.suiqian12,
      decadal: palace.decadal,
      ages: palace.ages
    })),

    // Copyright
    copyright: astrolabe.copyright,

    // Input parameters used for generation (for regeneration)
    inputParams: inputParams
  };
}

class ZiweiChartService {
  /**
   * Generate and save ziwei chart to both MongoDB and local file
   * @param {string} userId - User ID
   * @param {Object} profile - User profile with gender, birthDate, birthHour, isSolar/birthCalendar
   * @returns {Object} Generated chart data
   */
  async generateChart(userId, profile) {
    // Support both isSolar (boolean) and birthCalendar ('solar'/'lunar') formats
    let isSolar = profile.isSolar;
    if (isSolar === undefined) {
      // If isSolar not provided, check birthCalendar
      isSolar = profile.birthCalendar !== 'lunar';  // Default to true (solar)
    }

    const { gender, birthDate, birthHour } = profile;

    // Validate required fields
    if (!gender) {
      throw new Error('gender is required to generate ziwei chart');
    }
    if (!birthDate) {
      throw new Error('birthDate is required to generate ziwei chart');
    }
    if (birthHour === undefined || birthHour === null) {
      throw new Error('birthHour is required to generate ziwei chart');
    }

    // Convert to iztro format
    const iztroGender = convertGenderToIztro(gender);
    const formattedDate = formatDateForIztro(birthDate);
    const hourIndex = convertHourToIndex(birthHour);

    console.log(`[ZiweiChartService] Generating chart for user ${userId}:`, {
      gender: iztroGender,
      birthDate: formattedDate,
      hourIndex,
      isSolar,
      calendarType: isSolar ? '阳历' : '阴历'
    });

    // Compute the natal chart
    const astrolabe = computeNatalChart({
      birthDate: formattedDate,
      hourIndex,
      gender: iztroGender,
      isSolar
    });

    // Prepare input params for storage
    const inputParams = {
      gender: iztroGender,
      birthDate: new Date(birthDate),
      birthHour,
      isSolar
    };

    // Convert to storage format
    const chartData = astrolabeToStorageFormat(astrolabe, inputParams);

    // Store in MongoDB
    const existingChart = await ZiweiChart.findByUserId(userId);
    if (existingChart) {
      // Update existing chart
      Object.assign(existingChart, chartData);
      existingChart.updatedAt = new Date();
      await existingChart.save();
      console.log(`[ZiweiChartService] Updated existing chart in MongoDB for user ${userId}`);
    } else {
      // Create new chart
      await ZiweiChart.create({
        userId,
        ...chartData
      });
      console.log(`[ZiweiChartService] Created new chart in MongoDB for user ${userId}`);
    }

    // Store to local file system (dual storage)
    try {
      await this.saveToLocalFile(userId, astrolabe);
    } catch (error) {
      console.error(`[ZiweiChartService] Failed to save chart to local file:`, error);
      // File system storage failure doesn't affect main flow
    }

    // Return the complete chart data
    return {
      userId,
      ...chartData,
      generatedAt: new Date()
    };
  }

  /**
   * Get ziwei chart from cache (MongoDB), generate if missing
   * @param {string} userId - User ID
   * @returns {Object} Chart data
   */
  async getChart(userId) {
    // Try to get from MongoDB first
    const chart = await ZiweiChart.findByUserId(userId);

    if (chart) {
      console.log(`[ZiweiChartService] Chart found in cache for user ${userId}`);
      return chart;
    }

    // Chart not found - should not happen if calling from controller
    // as profile check should happen first
    throw new Error(`No ziwei chart found for user ${userId}. Please generate chart first.`);
  }

  /**
   * Force regenerate chart for a user
   * @param {string} userId - User ID
   * @param {Object} profile - User profile with gender, birthDate, birthHour
   * @returns {Object} Regenerated chart data
   */
  async regenerateChart(userId, profile) {
    console.log(`[ZiweiChartService] Force regenerating chart for user ${userId}`);

    // Delete existing chart if present
    const existingChart = await ZiweiChart.findByUserId(userId);
    if (existingChart) {
      await ZiweiChart.deleteOne({ userId });
      console.log(`[ZiweiChartService] Deleted existing chart for regeneration`);
    }

    // Generate new chart
    return await this.generateChart(userId, profile);
  }

  /**
   * Save chart to local file system
   * @param {string} userId - User ID
   * @param {Object} chartData - Complete astrolabe object from iztro
   * @returns {Object} Success status and file path
   */
  async saveToLocalFile(userId, chartData) {
    const userPath = path.join(ZIWEI_DATA_PATH, String(userId), 'ziwei');

    // Create directory if not exists
    await fs.mkdir(userPath, { recursive: true });

    const filePath = path.join(userPath, 'chart.json');

    // Save complete astrolabe object to file
    await fs.writeFile(
      filePath,
      JSON.stringify(chartData, null, 2),
      'utf-8'
    );

    console.log(`[ZiweiChartService] Chart saved to local file: ${filePath}`);
    return { success: true, filePath };
  }

  /**
   * Load chart from local file system
   * @param {string} userId - User ID
   * @returns {Object|null} Astrolabe object or null
   */
  async getFromLocalFile(userId) {
    const filePath = path.join(ZIWEI_DATA_PATH, String(userId), 'ziwei', 'chart.json');

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const astrolabe = JSON.parse(data);
      console.log(`[ZiweiChartService] Chart loaded from local file: ${filePath}`);
      return astrolabe;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`[ZiweiChartService] Failed to load chart from local file: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Check if user has a ziwei chart
   * @param {string} userId - User ID
   * @returns {boolean} True if chart exists
   */
  async hasChart(userId) {
    return await ZiweiChart.hasChart(userId);
  }

  /**
   * Delete ziwei chart for a user (both MongoDB and local file)
   * @param {string} userId - User ID
   */
  async deleteChart(userId) {
    const result = await ZiweiChart.deleteOne({ userId });

    if (result.deletedCount === 0) {
      throw new Error(`No ziwei chart found for user ${userId}`);
    }

    // Also delete from local file system
    try {
      const ziweiPath = path.join(ZIWEI_DATA_PATH, String(userId), 'ziwei');
      await fs.rm(ziweiPath, { recursive: true, force: true });
      console.log(`[ZiweiChartService] Chart deleted from local file system`);
    } catch (error) {
      console.warn(`[ZiweiChartService] Failed to delete chart from local file: ${error.message}`);
    }

    console.log(`[ZiweiChartService] Chart deleted for user ${userId}`);
    return { success: true };
  }

  /**
   * Get simplified chart data for display
   * @param {string} userId - User ID
   * @returns {Object} Simplified chart data
   */
  async getSimplifiedChart(userId) {
    const chart = await this.getChart(userId);

    return {
      userId: chart.userId,
      solarDate: chart.solarDate,
      lunarDate: chart.lunarDate,
      chineseDate: chart.chineseDate,
      zodiac: chart.zodiac,
      sign: chart.sign,
      soul: chart.soul,
      body: chart.body,
      fiveElementsClass: chart.fiveElementsClass,
      palaces: chart.palaces.map(p => ({
        name: p.name,
        heavenlyStem: p.heavenlyStem,
        earthlyBranch: p.earthlyBranch,
        majorStars: p.majorStars,
        minorStars: p.minorStars,
        adjectiveStars: p.adjectiveStars
      }))
    };
  }

  /**
   * Get palace information by name
   * @param {string} userId - User ID
   * @param {string} palaceName - Palace name (e.g., '命宫', '财帛')
   * @returns {Object} Palace data
   */
  async getPalace(userId, palaceName) {
    const chart = await this.getChart(userId);
    const palace = chart.getPalaceByName(palaceName);

    if (!palace) {
      throw new Error(`Palace "${palaceName}" not found in chart`);
    }

    return palace;
  }

  /**
   * Compute horoscope (运限) for a specific date
   * Horoscope is calculated on-demand, NOT stored
   * @param {string} userId - User ID
   * @param {string} targetDate - Target date in YYYY-MM-DD format
   * @returns {Object} Horoscope data with enhanced decadal/age/yearly range info
   */
  async computeHoroscope(userId, targetDate) {
    // Get the stored chart (has the inputParams for regeneration)
    const chart = await this.getChart(userId);

    if (!chart) {
      throw new Error('Cannot compute horoscope: chart not found');
    }

    // Validate target date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(targetDate)) {
      throw new Error(`targetDate must be in YYYY-MM-DD format, got ${targetDate}`);
    }

    // Get inputParams from stored chart
    const inputParams = chart.inputParams;
    if (!inputParams || !inputParams.birthDate || inputParams.birthHour === undefined) {
      throw new Error('Cannot compute horoscope: missing input parameters in stored chart');
    }

    // Re-compute the natal chart to get a live astrolabe object with horoscope method
    const birthDate = inputParams.birthDate;
    const formattedDate = birthDate instanceof Date
      ? birthDate.toISOString().split('T')[0]
      : (typeof birthDate === 'string' ? birthDate.split('T')[0] : birthDate);

    const hourIndex = convertHourToIndex(inputParams.birthHour);
    const isSolar = inputParams.isSolar !== false;  // Default to true

    // Re-compute natal chart
    const astrolabe = computeNatalChart({
      birthDate: formattedDate,
      hourIndex,
      gender: inputParams.gender,
      isSolar
    });

    // Now compute horoscope using the live astrolabe object
    const horoscope = computeHoroscope(astrolabe, targetDate);

    // Enhance horoscope with range info from palaces
    // iztro's HoroscopeItem doesn't include range, but palace's decadal does
    if (horoscope.decadal && horoscope.decadal.index >= 0 && astrolabe.palaces) {
      const decadalPalace = astrolabe.palaces[horoscope.decadal.index];
      if (decadalPalace && decadalPalace.decadal) {
        horoscope.decadal.range = decadalPalace.decadal.range;
      }
    }

    // Also add range for age (小限)
    if (horoscope.age && horoscope.age.index >= 0 && astrolabe.palaces) {
      const agePalace = astrolabe.palaces[horoscope.age.index];
      if (agePalace && agePalace.decadal) {
        horoscope.age.range = agePalace.decadal.range;
      }
    }

    console.log(`[ZiweiChartService] Horoscope computed for user ${userId} on ${targetDate}`);

    return {
      userId,
      targetDate,
      horoscope
    };
  }

  /**
   * Batch generate charts for existing users
   * @param {Array} users - Array of user objects with profile data
   * @returns {Object} Statistics
   */
  async batchGenerateForUsers(users) {
    let success = 0;
    let failed = 0;
    const errors = [];

    for (const user of users) {
      const { _id: userId, profile } = user;

      // Skip if profile incomplete
      if (!profile || !profile.gender || !profile.birthDate || profile.birthHour === undefined) {
        failed++;
        errors.push({
          userId,
          reason: 'Incomplete profile data'
        });
        continue;
      }

      // Skip if chart already exists
      const hasExisting = await this.hasChart(userId);
      if (hasExisting) {
        console.log(`[ZiweiChartService] Chart already exists for user ${userId}, skipping`);
        continue;
      }

      try {
        await this.generateChart(userId, profile);
        success++;
      } catch (error) {
        failed++;
        errors.push({
          userId,
          reason: error.message
        });
        console.error(`[ZiweiChartService] Failed to generate chart for user ${userId}:`, error);
      }
    }

    return {
      total: users.length,
      success,
      failed,
      errors
    };
  }
}

export default new ZiweiChartService();
