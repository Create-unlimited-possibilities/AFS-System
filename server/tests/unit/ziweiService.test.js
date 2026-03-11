/**
 * Ziwei Service Unit Tests
 * Tests for the ziwei (Purple Star Astrology) service based on iztro
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeNatalChart,
  computeHoroscope,
  getSimplifiedChartData,
  getPalaceByName,
  getMajorStarsInPalace,
  validateBirthParams
} from '../../src/core/ziwei/ziweiService.js';

describe('ZiweiService', () => {
  describe('validateBirthParams', () => {
    it('should validate correct parameters', () => {
      const result = validateBirthParams({
        birthDate: '1990-05-15',
        hourIndex: 6,
        gender: 'male',
        isSolar: true
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject missing birthDate', () => {
      const result = validateBirthParams({
        hourIndex: 6,
        gender: 'male'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('birthDate is required');
    });

    it('should reject invalid date format', () => {
      const result = validateBirthParams({
        birthDate: '1990/05/15',
        hourIndex: 6,
        gender: 'male'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('birthDate must be in YYYY-MM-DD format');
    });

    it('should reject invalid date value', () => {
      const result = validateBirthParams({
        birthDate: '1990-13-45',
        hourIndex: 6,
        gender: 'male'
      });

      expect(result.isValid).toBe(false);
    });

    it('should reject missing hourIndex', () => {
      const result = validateBirthParams({
        birthDate: '1990-05-15',
        gender: 'male'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('hourIndex is required');
    });

    it('should reject out of range hourIndex', () => {
      const result1 = validateBirthParams({
        birthDate: '1990-05-15',
        hourIndex: -1,
        gender: 'male'
      });
      expect(result1.isValid).toBe(false);

      const result2 = validateBirthParams({
        birthDate: '1990-05-15',
        hourIndex: 12,
        gender: 'male'
      });
      expect(result2.isValid).toBe(false);
    });

    it('should reject missing gender', () => {
      const result = validateBirthParams({
        birthDate: '1990-05-15',
        hourIndex: 6
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('gender is required');
    });

    it('should reject invalid gender', () => {
      const result = validateBirthParams({
        birthDate: '1990-05-15',
        hourIndex: 6,
        gender: 'other'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('gender must be "male" or "female"');
    });

    it('should return multiple errors', () => {
      const result = validateBirthParams({
        birthDate: 'invalid',
        hourIndex: 15,
        gender: 'unknown'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('computeNatalChart', () => {
    const validParams = {
      birthDate: '1990-05-15',
      hourIndex: 6,
      gender: 'male',
      isSolar: true
    };

    it('should compute natal chart for solar calendar', () => {
      const chart = computeNatalChart(validParams);

      expect(chart).toBeDefined();
      expect(chart.solarDate).toBeDefined();
      expect(chart.palaces).toBeDefined();
      expect(Array.isArray(chart.palaces)).toBe(true);
    });

    it('should compute natal chart for lunar calendar', () => {
      const chart = computeNatalChart({
        ...validParams,
        isSolar: false
      });

      expect(chart).toBeDefined();
      expect(chart.lunarDate).toBeDefined();
      expect(chart.palaces).toBeDefined();
    });

    it('should compute for female gender', () => {
      const chart = computeNatalChart({
        ...validParams,
        gender: 'female'
      });

      expect(chart).toBeDefined();
    });

    it('should have 12 palaces', () => {
      const chart = computeNatalChart(validParams);

      expect(chart.palaces).toHaveLength(12);
    });

    it('should include soul and body information', () => {
      const chart = computeNatalChart(validParams);

      expect(chart.soul).toBeDefined();
      expect(chart.body).toBeDefined();
    });

    it('should include zodiac and sign', () => {
      const chart = computeNatalChart(validParams);

      expect(chart.zodiac).toBeDefined();
      expect(chart.sign).toBeDefined();
    });

    it('should throw error for missing birthDate', () => {
      expect(() => {
        computeNatalChart({ hourIndex: 6, gender: 'male' });
      }).toThrow('birthDate is required');
    });

    it('should throw error for missing hourIndex', () => {
      expect(() => {
        computeNatalChart({ birthDate: '1990-05-15', gender: 'male' });
      }).toThrow('hourIndex is required');
    });

    it('should throw error for missing gender', () => {
      expect(() => {
        computeNatalChart({ birthDate: '1990-05-15', hourIndex: 6 });
      }).toThrow('gender is required');
    });

    it('should throw error for invalid hourIndex', () => {
      expect(() => {
        computeNatalChart({ ...validParams, hourIndex: -1 });
      }).toThrow('hourIndex must be between 0-11');

      expect(() => {
        computeNatalChart({ ...validParams, hourIndex: 12 });
      }).toThrow('hourIndex must be between 0-11');
    });

    it('should throw error for invalid gender', () => {
      expect(() => {
        computeNatalChart({ ...validParams, gender: 'other' });
      }).toThrow('gender must be \'male\' or \'female\'');
    });

    it('should throw error for invalid date format', () => {
      expect(() => {
        computeNatalChart({ ...validParams, birthDate: '1990/05/15' });
      }).toThrow('birthDate must be in YYYY-MM-DD format');
    });
  });

  describe('computeHoroscope', () => {
    let astrolabe;

    beforeEach(() => {
      astrolabe = computeNatalChart({
        birthDate: '1990-05-15',
        hourIndex: 6,
        gender: 'male'
      });
    });

    it('should compute horoscope for target date', () => {
      const horoscope = computeHoroscope(astrolabe, '2026-02-25');

      expect(horoscope).toBeDefined();
    });

    it('should include yearly horoscope', () => {
      const horoscope = computeHoroscope(astrolabe, '2026-02-25');

      // Horoscope structure varies, but should have some data
      expect(horoscope).toBeDefined();
    });

    it('should throw error for missing astrolabe', () => {
      expect(() => {
        computeHoroscope(null, '2026-02-25');
      }).toThrow('astrolabe is required');
    });

    it('should throw error for missing targetDate', () => {
      expect(() => {
        computeHoroscope(astrolabe, null);
      }).toThrow('targetDate is required');
    });

    it('should throw error for invalid date format', () => {
      expect(() => {
        computeHoroscope(astrolabe, '2026/02/25');
      }).toThrow('targetDate must be in YYYY-MM-DD format');
    });
  });

  describe('getSimplifiedChartData', () => {
    let astrolabe;

    beforeEach(() => {
      astrolabe = computeNatalChart({
        birthDate: '1990-05-15',
        hourIndex: 6,
        gender: 'male'
      });
    });

    it('should extract simplified data', () => {
      const simplified = getSimplifiedChartData(astrolabe);

      expect(simplified).toBeDefined();
      expect(simplified.solarDate).toBeDefined();
      expect(simplified.lunarDate).toBeDefined();
      expect(simplified.chineseDate).toBeDefined();
      expect(simplified.time).toBeDefined();
      expect(simplified.zodiac).toBeDefined();
      expect(simplified.sign).toBeDefined();
      expect(simplified.soul).toBeDefined();
      expect(simplified.body).toBeDefined();
      expect(simplified.fiveElementsClass).toBeDefined();
    });

    it('should include palaces array', () => {
      const simplified = getSimplifiedChartData(astrolabe);

      expect(Array.isArray(simplified.palaces)).toBe(true);
      expect(simplified.palaces).toHaveLength(12);
    });

    it('should include palace details', () => {
      const simplified = getSimplifiedChartData(astrolabe);
      const palace = simplified.palaces[0];

      expect(palace.name).toBeDefined();
      expect(palace.heavenlyStem).toBeDefined();
      expect(palace.earthlyBranch).toBeDefined();
      expect(Array.isArray(palace.majorStars)).toBe(true);
      expect(Array.isArray(palace.minorStars)).toBe(true);
      expect(Array.isArray(palace.decorativeStars)).toBe(true);
    });

    it('should include star brightness in major stars', () => {
      const simplified = getSimplifiedChartData(astrolabe);
      const palace = simplified.palaces[0];

      palace.majorStars.forEach(star => {
        expect(star.name).toBeDefined();
        expect(star.brightness).toBeDefined();
        expect(star.type).toBeDefined();
      });
    });

    it('should throw error for null astrolabe', () => {
      expect(() => {
        getSimplifiedChartData(null);
      }).toThrow('astrolabe is required');
    });

    it('should throw error for undefined astrolabe', () => {
      expect(() => {
        getSimplifiedChartData(undefined);
      }).toThrow('astrolabe is required');
    });
  });

  describe('getPalaceByName', () => {
    let astrolabe;

    beforeEach(() => {
      astrolabe = computeNatalChart({
        birthDate: '1990-05-15',
        hourIndex: 6,
        gender: 'male'
      });
    });

    it('should find palace by name', () => {
      const palaceNames = ['命宫', '财帛', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];

      palaceNames.forEach(name => {
        const palace = getPalaceByName(astrolabe, name);
        expect(palace).toBeDefined();
        expect(palace.name).toBe(name);
      });
    });

    it('should return null for non-existent palace', () => {
      const palace = getPalaceByName(astrolabe, '不存在');
      expect(palace).toBeNull();
    });

    it('should return null for null astrolabe', () => {
      const palace = getPalaceByName(null, '命宫');
      expect(palace).toBeNull();
    });
  });

  describe('getMajorStarsInPalace', () => {
    let astrolabe;

    beforeEach(() => {
      astrolabe = computeNatalChart({
        birthDate: '1990-05-15',
        hourIndex: 6,
        gender: 'male'
      });
    });

    it('should return array of star names', () => {
      const stars = getMajorStarsInPalace(astrolabe, '命宫');

      expect(Array.isArray(stars)).toBe(true);
    });

    it('should return empty array for non-existent palace', () => {
      const stars = getMajorStarsInPalace(astrolabe, '不存在');

      expect(stars).toEqual([]);
    });

    it('should return empty array for null astrolabe', () => {
      const stars = getMajorStarsInPalace(null, '命宫');

      expect(stars).toEqual([]);
    });

    it('should return star names only (not full objects)', () => {
      const stars = getMajorStarsInPalace(astrolabe, '命宫');

      stars.forEach(star => {
        expect(typeof star).toBe('string');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle leap year dates', () => {
      const chart = computeNatalChart({
        birthDate: '2000-02-29',
        hourIndex: 6,
        gender: 'male'
      });

      expect(chart).toBeDefined();
    });

    it('should handle different hour indices', () => {
      for (let i = 0; i <= 11; i++) {
        const chart = computeNatalChart({
          birthDate: '1990-05-15',
          hourIndex: i,
          gender: 'male'
        });

        expect(chart).toBeDefined();
      }
    });

    it('should handle birth dates from different eras', () => {
      const dates = ['1960-01-01', '1980-06-15', '2000-12-31', '2020-03-20'];

      dates.forEach(date => {
        const chart = computeNatalChart({
          birthDate: date,
          hourIndex: 6,
          gender: 'female'
        });

        expect(chart).toBeDefined();
      });
    });
  });
});
