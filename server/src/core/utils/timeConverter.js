/**
 * Time Conversion Utility
 * Converts hours (0-23) to shichen (Chinese time periods, 0-11) for ziwei calculations
 *
 * Shichen (时辰) are traditional Chinese time periods:
 * - 子时 (Zi): 23:00-01:00
 * - 丑时 (Chou): 01:00-03:00
 * - 寅时 (Yin): 03:00-05:00
 * - 卯时 (Mao): 05:00-07:00
 * - 辰时 (Chen): 07:00-09:00
 * - 巳时 (Si): 09:00-11:00
 * - 午时 (Wu): 11:00-13:00
 * - 未时 (Wei): 13:00-15:00
 * - 申时 (Shen): 15:00-17:00
 * - 酉时 (You): 17:00-19:00
 * - 戌时 (Xu): 19:00-21:00
 * - 亥时 (Hai): 21:00-23:00
 *
 * @author AFS Team
 * @version 1.0.0
 */

/**
 * Shichen mapping with names, time ranges, and hours
 */
const SHICHEN_MAP = [
  { name: '子时', range: '23:00-01:00', hours: [23, 0] },
  { name: '丑时', range: '01:00-03:00', hours: [1, 2] },
  { name: '寅时', range: '03:00-05:00', hours: [3, 4] },
  { name: '卯时', range: '05:00-07:00', hours: [5, 6] },
  { name: '辰时', range: '07:00-09:00', hours: [7, 8] },
  { name: '巳时', range: '09:00-11:00', hours: [9, 10] },
  { name: '午时', range: '11:00-13:00', hours: [11, 12] },
  { name: '未时', range: '13:00-15:00', hours: [13, 14] },
  { name: '申时', range: '15:00-17:00', hours: [15, 16] },
  { name: '酉时', range: '17:00-19:00', hours: [17, 18] },
  { name: '戌时', range: '19:00-21:00', hours: [19, 20] },
  { name: '亥时', range: '21:00-23:00', hours: [21, 22] },
];

/**
 * Convert hour (0-23) to shichen index (0-11)
 *
 * @param {number} hour - Hour in 24-hour format (0-23)
 * @returns {number} Shichen index (0-11)
 * @throws {Error} If hour is invalid (not an integer between 0-23)
 *
 * @example
 * hourToShichenIndex(23) // returns 0 (子时)
 * hourToShichenIndex(0)  // returns 0 (子时)
 * hourToShichenIndex(11) // returns 6 (午时)
 * hourToShichenIndex(12) // returns 6 (午时)
 */
export function hourToShichenIndex(hour) {
  // Validate input
  if (typeof hour !== 'number' || !Number.isInteger(hour)) {
    throw new Error(`Invalid hour: ${hour}. Must be integer 0-23.`);
  }
  if (hour < 0 || hour > 23) {
    throw new Error(`Invalid hour: ${hour}. Must be integer 0-23.`);
  }

  // Special case: 23:00-00:59 is 子时 (index 0)
  if (hour === 23) return 0;

  // For hours 0-22: shichen index = floor(hour / 2) + 1
  // This maps:
  // - hour 0 -> floor(0/2) + 1 = 1 (but we want 0, handled above)
  // - hour 1 -> floor(1/2) + 1 = 1
  // - hour 2 -> floor(2/2) + 1 = 2
  // ...
  // - hour 22 -> floor(22/2) + 1 = 12 (but we want 11)
  // Wait, this formula doesn't work correctly
  // Let me recalculate:
  // Hour 0, 23 -> index 0 (子时)
  // Hour 1, 2 -> index 1 (丑时)
  // Hour 3, 4 -> index 2 (寅时)
  // ...
  // Hour 21, 22 -> index 11 (亥时)

  // Actually:
  // hour 0 -> should be 0
  // hour 1 -> floor(1/2) + 1 = 0 + 1 = 1 (wrong, should be 1 for 丑时 but hour 1 is 丑时)
  // hour 2 -> floor(2/2) + 1 = 1 + 1 = 2 (wrong, should be 1)
  // hour 3 -> floor(3/2) + 1 = 1 + 1 = 2 (correct, 寅时)
  // hour 4 -> floor(4/2) + 1 = 2 + 1 = 3 (wrong, should be 2)

  // Correct formula for hours 0-22:
  // For odd hours (1,3,5...): (hour - 1) / 2 + 1 = hour / 2 + 0.5
  // For even hours except 0 (2,4,6...): hour / 2
  // Wait, let me think differently:
  // hour 0 -> index 0
  // hour 1 -> index 1
  // hour 2 -> index 1
  // hour 3 -> index 2
  // hour 4 -> index 2
  // ...
  // hour 22 -> index 11

  // Formula: ceil(hour / 2) for hour > 0, but hour 0 -> 0
  // Actually: ceil(hour / 2) works for:
  // hour 0 -> ceil(0) = 0 ✓
  // hour 1 -> ceil(0.5) = 1 ✓
  // hour 2 -> ceil(1) = 1 ✓
  // hour 3 -> ceil(1.5) = 2 ✓
  // hour 22 -> ceil(11) = 11 ✓
  // hour 23 -> ceil(11.5) = 12 ✗ (should be 0)

  return Math.ceil(hour / 2);
}

/**
 * Convert shichen index (0-11) to shichen name (Chinese)
 *
 * @param {number} index - Shichen index (0-11)
 * @returns {string} Shichen name in Chinese
 * @throws {Error} If index is invalid (not 0-11)
 *
 * @example
 * shichenIndexToName(0)  // returns '子时'
 * shichenIndexToName(6)  // returns '午时'
 * shichenIndexToName(11) // returns '亥时'
 */
export function shichenIndexToName(index) {
  if (typeof index !== 'number' || index < 0 || index > 11) {
    throw new Error(`Invalid shichen index: ${index}. Must be 0-11.`);
  }
  return SHICHEN_MAP[index].name;
}

/**
 * Get complete shichen information for a given hour
 *
 * @param {number} hour - Hour in 24-hour format (0-23)
 * @returns {Object} Shichen information
 * @returns {number} return.index - Shichen index (0-11)
 * @returns {string} return.name - Shichen name in Chinese
 * @returns {string} return.timeRange - Time range (e.g., "11:00-13:00")
 * @returns {string} return.description - Full description
 * @throws {Error} If hour is invalid
 *
 * @example
 * getShichenInfo(11)
 * // returns { index: 6, name: '午时', timeRange: '11:00-13:00', description: '午时 (11:00-13:00)' }
 */
export function getShichenInfo(hour) {
  const index = hourToShichenIndex(hour);
  const shichen = SHICHEN_MAP[index];

  return {
    index,
    name: shichen.name,
    timeRange: shichen.range,
    description: `${shichen.name} (${shichen.range})`,
  };
}

/**
 * Convert Chinese gender to iztro format
 * iztro library expects 'male' or 'female' as gender values
 *
 * @param {string} gender - Gender in Chinese ('男', '女', or '其他')
 * @returns {string} Gender in iztro format ('male' or 'female')
 *
 * @example
 * genderToIztroFormat('男')     // returns 'male'
 * genderToIztroFormat('女')     // returns 'female'
 * genderToIztroFormat('其他')   // returns 'male' (default)
 */
export function genderToIztroFormat(gender) {
  if (gender === '女') return 'female';
  // Default to 'male' for '男', '其他', or any other value
  return 'male';
}

/**
 * Get shichen information by index directly
 *
 * @param {number} index - Shichen index (0-11)
 * @returns {Object} Shichen data from SHICHEN_MAP
 * @throws {Error} If index is invalid
 */
export function getShichenByIndex(index) {
  if (typeof index !== 'number' || index < 0 || index > 11) {
    throw new Error(`Invalid shichen index: ${index}. Must be 0-11.`);
  }
  return SHICHEN_MAP[index];
}

// Default export containing all functions and the map
export default {
  hourToShichenIndex,
  shichenIndexToName,
  getShichenInfo,
  getShichenByIndex,
  genderToIztroFormat,
  SHICHEN_MAP,
};
