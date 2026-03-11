/**
 * ZiweiChart Service Unit Tests
 * Tests for the ziwei chart storage service
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

const testUserId = '507f1f77bcf86cd799439011';
const validProfile = {
  gender: 'male',
  birthDate: '1990-05-15',
  birthHour: 6,
};

// Mock computeNatalChart to avoid actual iztro dependency
const mockAstrolabe = {
  gender: 'male',
  solarDate: '1990-05-15',
  lunarDate: '1990-04-21',
  chineseDate: '庚午年 辛巳月 丙寅日',
  time: '丙寅时',
  timeRange: '03:00-05:00',
  sign: '双子座',
  zodiac: '马',
  earthlyBranchOfSoulPalace: '寅',
  earthlyBranchOfBodyPalace: '申',
  soul: { name: '紫微', type: 'lucidity', brightness: '庙' },
  body: { name: '天相', type: 'assistant', brightness: '庙' },
  fiveElementsClass: '土五局',
  rawDates: {
    lunarDate: {
      lunarYear: '1990',
      lunarMonth: '04',
      lunarDay: '21',
      isLeap: false,
    },
    chineseDate: {
      yearly: '庚午',
      monthly: '辛巳',
      daily: '丙寅',
      hourly: '丙寅',
    },
  },
  palaces: Array.from({ length: 12 }, (_, i) => ({
    index: i,
    name: ['命宫', '财帛', '兄弟', '夫妻', '子女', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'][i],
    isBodyPalace: i === 6,
    isOriginalPalace: i === 0,
    heavenlyStem: '丙',
    earthlyBranch: ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'][i],
    majorStars: i === 0 ? [{ name: '紫微', type: 'lucidity', brightness: '庙' }] : [],
    minorStars: [],
    adjectiveStars: [],
    changsheng12: [],
    boshi12: [],
    jiangqian12: [],
    suiqian12: [],
    decadal: [],
    ages: [],
  })),
  copyright: 'iztro',
};

// Mock ziweiService
vi.mock('../../src/core/ziwei/ziweiService.js', () => ({
  computeNatalChart: vi.fn(({ birthDate, hourIndex, gender, isSolar }) => {
    return mockAstrolabe;
  }),
}));

// Mock DualStorage
vi.mock('../../src/core/storage/dual.js', () => ({
  default: class {
    constructor() {
      this.basePath = '/tmp/test-afs-data';
    }
    async initialize() {}
  },
}));

// Setup and cleanup
beforeEach(async () => {
  // Create test directory
  const testDir = path.join('/tmp/test-afs-data', String(testUserId), 'ziwei');
  await fs.mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  // Clean up test files
  const testBaseDir = path.join('/tmp/test-afs-data');
  try {
    await fs.rm(testBaseDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
});

describe('ZiweiChart Service Unit Tests', () => {
  describe('generateAndStoreChart', () => {
    it('should throw error for missing gender', async () => {
      const { default: ziweiChartService } = await import('../../src/modules/ziwei/service.js');
      const invalidProfile = { ...validProfile, gender: undefined };

      await expect(
        ziweiChartService.generateAndStoreChart(testUserId, invalidProfile)
      ).rejects.toThrow('gender is required');
    });

    it('should throw error for missing birthDate', async () => {
      const { default: ziweiChartService } = await import('../../src/modules/ziwei/service.js');
      const invalidProfile = { ...validProfile, birthDate: undefined };

      await expect(
        ziweiChartService.generateAndStoreChart(testUserId, invalidProfile)
      ).rejects.toThrow('birthDate is required');
    });

    it('should throw error for missing birthHour', async () => {
      const { default: ziweiChartService } = await import('../../src/modules/ziwei/service.js');
      const invalidProfile = { ...validProfile, birthHour: undefined };

      await expect(
        ziweiChartService.generateAndStoreChart(testUserId, invalidProfile)
      ).rejects.toThrow('birthHour is required');
    });

    it('should handle Chinese gender characters (男)', async () => {
      const { default: ziweiChartService } = await import('../../src/modules/ziwei/service.js');
      const maleProfile = { ...validProfile, gender: '男' };

      // Should not throw
      const result = await ziweiChartService.generateAndStoreChart(testUserId, maleProfile);
      expect(result).toBeDefined();
      expect(result.gender).toBe('男');
    });

    it('should handle Chinese gender characters (女)', async () => {
      const { default: ziweiChartService } = await import('../../src/modules/ziwei/service.js');
      const testUserId2 = '507f1f77bcf86cd799439012';
      const femaleProfile = { ...validProfile, gender: '女' };

      const result = await ziweiChartService.generateAndStoreChart(testUserId2, femaleProfile);
      expect(result).toBeDefined();
      expect(result.gender).toBe('女');
    });

    it('should save chart to file system', async () => {
      const { default: ziweiChartService } = await import('../../src/modules/ziwei/service.js');
      await ziweiChartService.generateAndStoreChart(testUserId, validProfile);

      const filePath = path.join('/tmp/test-afs-data', String(testUserId), 'ziwei', 'chart.json');
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should convert birthHour (0-23) to hourIndex (0-11)', async () => {
      const { default: ziweiChartService } = await import('../../src/modules/ziwei/service.js');
      const profile = { ...validProfile, birthHour: 14 }; // 2pm should map to index 7

      const result = await ziweiChartService.generateAndStoreChart(testUserId, profile);
      expect(result).toBeDefined();
      expect(result.solarDate).toBe(validProfile.birthDate);
    });

    it('should handle birthHour 23 (子时)', async () => {
      const { default: ziweiChartService } = await import('../../src/modules/ziwei/service.js');
      const testUserId2 = '507f1f77bcf86cd799439012';
      const profile = { ...validProfile, birthHour: 23 };

      const result = await ziweiChartService.generateAndStoreChart(testUserId2, profile);
      expect(result).toBeDefined();
    });

    it('should handle Date object for birthDate', async () => {
      const { default: ziweiChartService } = await import('../../src/modules/ziwei/service.js');
      const testUserId2 = '507f1f77bcf86cd799439012';
      const profile = { ...validProfile, birthDate: new Date('1990-05-15') };

      const result = await ziweiChartService.generateAndStoreChart(testUserId2, profile);
      expect(result).toBeDefined();
      expect(result.solarDate).toBe('1990-05-15');
    });

    it('should handle isSolar parameter', async () => {
      const { default: ziweiChartService } = await import('../../src/modules/ziwei/service.js');
      const testUserId2 = '507f1f77bcf86cd799439012';
      const profile = { ...validProfile, isSolar: false };

      const result = await ziweiChartService.generateAndStoreChart(testUserId2, profile);
      expect(result).toBeDefined();
      expect(result.birthData.isSolar).toBe(false);
    });
  });

  describe('hasChart', () => {
    it('should return false when chart does not exist', async () => {
      const { default: ziweiChartService } = await import('../../src/modules/ziwei/service.js');
      const hasChart = await ziweiChartService.hasChart('non-existent-user');
      expect(hasChart).toBe(false);
    });
  });

  describe('batchGenerateForUsers', () => {
    it('should skip users with incomplete profiles', async () => {
      const { default: ziweiChartService } = await import('../../src/modules/ziwei/service.js');
      const users = [
        { _id: testUserId, profile: validProfile },
        { _id: '507f1f77bcf86cd799439012', profile: { gender: 'male' } }, // Missing birthDate and birthHour
        { _id: '507f1f77bcf86cd799439013', profile: { ...validProfile, gender: 'female' } },
      ];

      const result = await ziweiChartService.batchGenerateForUsers(users);

      expect(result.total).toBe(3);
      expect(result.failed).toBe(1);
      expect(result.errors[0].reason).toBe('Incomplete profile data');
    });

    it('should handle generation errors gracefully', async () => {
      const { default: ziweiChartService } = await import('../../src/modules/ziwei/service.js');
      const users = [
        { _id: testUserId, profile: validProfile },
        { _id: '507f1f77bcf86cd799439012', profile: { gender: 'invalid', birthDate: 'invalid', birthHour: 25 } },
      ];

      const result = await ziweiChartService.batchGenerateForUsers(users);

      expect(result.total).toBe(2);
      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
