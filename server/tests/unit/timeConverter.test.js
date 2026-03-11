/**
 * Time Converter Unit Tests
 * Tests for hour to shichen (Chinese time periods) conversion utilities
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect } from 'vitest';
import {
  hourToShichenIndex,
  shichenIndexToName,
  getShichenInfo,
  genderToIztroFormat
} from '../../src/core/utils/timeConverter.js';

describe('TimeConverter', () => {
  describe('hourToShichenIndex', () => {
    it('should convert 23 to 0 (子时)', () => {
      expect(hourToShichenIndex(23)).toBe(0);
    });

    it('should convert 0 to 0 (子时)', () => {
      expect(hourToShichenIndex(0)).toBe(0);
    });

    it('should convert 1 to 1 (丑时)', () => {
      expect(hourToShichenIndex(1)).toBe(1);
    });

    it('should convert 2 to 1 (丑时)', () => {
      expect(hourToShichenIndex(2)).toBe(1);
    });

    it('should convert 3 to 2 (寅时)', () => {
      expect(hourToShichenIndex(3)).toBe(2);
    });

    it('should convert 4 to 2 (寅时)', () => {
      expect(hourToShichenIndex(4)).toBe(2);
    });

    it('should convert 5 to 3 (卯时)', () => {
      expect(hourToShichenIndex(5)).toBe(3);
    });

    it('should convert 11 to 6 (午时)', () => {
      expect(hourToShichenIndex(11)).toBe(6);
    });

    it('should convert 12 to 6 (午时)', () => {
      expect(hourToShichenIndex(12)).toBe(6);
    });

    it('should convert 22 to 11 (亥时)', () => {
      expect(hourToShichenIndex(22)).toBe(11);
    });

    it('should throw for invalid hour (24)', () => {
      expect(() => hourToShichenIndex(24)).toThrow('Invalid hour');
    });

    it('should throw for invalid hour (-1)', () => {
      expect(() => hourToShichenIndex(-1)).toThrow('Invalid hour');
    });

    it('should throw for non-integer hour', () => {
      expect(() => hourToShichenIndex(1.5)).toThrow('Invalid hour');
    });

    it('should throw for non-number input', () => {
      expect(() => hourToShichenIndex('12')).toThrow('Invalid hour');
    });

    it('should handle all 24 hours correctly', () => {
      const expected = [
        0,  // 23:00-01:00 (子时) - hour 23
        0,  // hour 0
        1,  // hour 1
        1,  // hour 2
        2,  // hour 3
        2,  // hour 4
        3,  // hour 5
        3,  // hour 6
        4,  // hour 7
        4,  // hour 8
        5,  // hour 9
        5,  // hour 10
        6,  // hour 11
        6,  // hour 12
        7,  // hour 13
        7,  // hour 14
        8,  // hour 15
        8,  // hour 16
        9,  // hour 17
        9,  // hour 18
        10, // hour 19
        10, // hour 20
        11, // hour 21
        11  // hour 22
      ];
      for (let hour = 0; hour <= 22; hour++) {
        expect(hourToShichenIndex(hour)).toBe(expected[hour + 1]);
      }
      expect(hourToShichenIndex(23)).toBe(expected[0]);
    });
  });

  describe('shichenIndexToName', () => {
    it('should return correct Chinese name for index 0 (子时)', () => {
      expect(shichenIndexToName(0)).toBe('子时');
    });

    it('should return correct Chinese name for index 6 (午时)', () => {
      expect(shichenIndexToName(6)).toBe('午时');
    });

    it('should return correct Chinese name for index 11 (亥时)', () => {
      expect(shichenIndexToName(11)).toBe('亥时');
    });

    it('should return all shichen names correctly', () => {
      const names = [
        '子时', '丑时', '寅时', '卯时',
        '辰时', '巳时', '午时', '未时',
        '申时', '酉时', '戌时', '亥时'
      ];
      for (let i = 0; i < 12; i++) {
        expect(shichenIndexToName(i)).toBe(names[i]);
      }
    });

    it('should throw for invalid index (-1)', () => {
      expect(() => shichenIndexToName(-1)).toThrow('Invalid shichen index');
    });

    it('should throw for invalid index (12)', () => {
      expect(() => shichenIndexToName(12)).toThrow('Invalid shichen index');
    });

    it('should throw for non-number input', () => {
      expect(() => shichenIndexToName('6')).toThrow('Invalid shichen index');
    });
  });

  describe('getShichenInfo', () => {
    it('should return complete shichen info for hour 11 (午时)', () => {
      const info = getShichenInfo(11);
      expect(info).toEqual({
        index: 6,
        name: '午时',
        timeRange: '11:00-13:00',
        description: '午时 (11:00-13:00)'
      });
    });

    it('should return complete shichen info for hour 0 (子时)', () => {
      const info = getShichenInfo(0);
      expect(info).toEqual({
        index: 0,
        name: '子时',
        timeRange: '23:00-01:00',
        description: '子时 (23:00-01:00)'
      });
    });

    it('should return complete shichen info for hour 23 (子时)', () => {
      const info = getShichenInfo(23);
      expect(info).toEqual({
        index: 0,
        name: '子时',
        timeRange: '23:00-01:00',
        description: '子时 (23:00-01:00)'
      });
    });

    it('should return complete shichen info for all hours', () => {
      for (let hour = 0; hour <= 23; hour++) {
        const info = getShichenInfo(hour);
        expect(info).toHaveProperty('index');
        expect(info).toHaveProperty('name');
        expect(info).toHaveProperty('timeRange');
        expect(info).toHaveProperty('description');
        expect(typeof info.index).toBe('number');
        expect(typeof info.name).toBe('string');
        expect(typeof info.timeRange).toBe('string');
        expect(typeof info.description).toBe('string');
        expect(info.index).toBeGreaterThanOrEqual(0);
        expect(info.index).toBeLessThanOrEqual(11);
      }
    });

    it('should throw for invalid hour', () => {
      expect(() => getShichenInfo(24)).toThrow('Invalid hour');
      expect(() => getShichenInfo(-1)).toThrow('Invalid hour');
    });
  });

  describe('genderToIztroFormat', () => {
    it('should convert male (男) to "male"', () => {
      expect(genderToIztroFormat('男')).toBe('male');
    });

    it('should convert female (女) to "female"', () => {
      expect(genderToIztroFormat('女')).toBe('female');
    });

    it('should return "male" for other gender (其他)', () => {
      expect(genderToIztroFormat('其他')).toBe('male');
    });

    it('should return "male" for undefined input', () => {
      expect(genderToIztroFormat(undefined)).toBe('male');
    });

    it('should return "male" for null input', () => {
      expect(genderToIztroFormat(null)).toBe('male');
    });

    it('should be case sensitive for Chinese characters', () => {
      expect(genderToIztroFormat('男')).toBe('male');
      expect(genderToIztroFormat('女')).toBe('female');
    });
  });
});
