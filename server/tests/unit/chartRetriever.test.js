/**
 * Chart Retriever Node Unit Tests
 * Tests for the chart retriever node in XiaoShuDong workflow
 * Updated for v3.0 - reads from storage instead of real-time calculation
 *
 * @author AFS Team
 * @version 3.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import XiaoShuDongState from '../../src/modules/xiaoshudong/state/XiaoShuDongState.js';
import {
  chartRetrieverNode,
  getRelevantPalaces,
  hasChart,
  getFormattedChartText
} from '../../src/modules/xiaoshudong/nodes/chartRetriever.js';

// Mock ZiweiChartService
const mockChartData = {
  _id: 'chart123',
  userId: 'user123',
  solarDate: '1990-05-15',
  lunarDate: '1990-04-21',
  chineseDate: '庚午年四月廿一',
  zodiac: '马',
  fiveElementsClass: '木五局',
  soul: '紫微',
  body: '天府',
  palaces: [
    {
      name: '命宫',
      heavenlyStem: '庚',
      earthlyBranch: '午',
      majorStars: [{ name: '紫微', brightness: '庙' }],
      minorStars: [],
      adjectiveStars: []
    },
    {
      name: '兄弟宫',
      heavenlyStem: '辛',
      earthlyBranch: '未',
      majorStars: [{ name: '天机', brightness: '旺' }],
      minorStars: [],
      adjectiveStars: []
    },
    {
      name: '夫妻宫',
      heavenlyStem: '壬',
      earthlyBranch: '申',
      majorStars: [{ name: '太阳', brightness: '庙' }],
      minorStars: [],
      adjectiveStars: []
    },
    {
      name: '子女宫',
      heavenlyStem: '癸',
      earthlyBranch: '酉',
      majorStars: [],
      minorStars: [{ name: '左辅' }],
      adjectiveStars: []
    },
    {
      name: '财帛宫',
      heavenlyStem: '甲',
      earthlyBranch: '戌',
      majorStars: [{ name: '武曲', brightness: '旺' }, { name: '贪狼', brightness: '平' }],
      minorStars: [],
      adjectiveStars: []
    },
    {
      name: '疾厄宫',
      heavenlyStem: '乙',
      earthlyBranch: '亥',
      majorStars: [{ name: '天同', brightness: '利' }],
      minorStars: [],
      adjectiveStars: []
    },
    {
      name: '迁移宫',
      heavenlyStem: '丙',
      earthlyBranch: '子',
      majorStars: [{ name: '廉贞', brightness: '庙' }],
      minorStars: [],
      adjectiveStars: []
    },
    {
      name: '交友宫',
      heavenlyStem: '丁',
      earthlyBranch: '丑',
      majorStars: [],
      minorStars: [],
      adjectiveStars: []
    },
    {
      name: '官禄宫',
      heavenlyStem: '戊',
      earthlyBranch: '寅',
      majorStars: [{ name: '天府', brightness: '庙' }],
      minorStars: [],
      adjectiveStars: []
    },
    {
      name: '田宅宫',
      heavenlyStem: '己',
      earthlyBranch: '卯',
      majorStars: [{ name: '太阴', brightness: '旺' }],
      minorStars: [],
      adjectiveStars: []
    },
    {
      name: '福德宫',
      heavenlyStem: '庚',
      earthlyBranch: '辰',
      majorStars: [{ name: '巨门', brightness: '庙' }],
      minorStars: [],
      adjectiveStars: []
    },
    {
      name: '父母宫',
      heavenlyStem: '辛',
      earthlyBranch: '巳',
      majorStars: [{ name: '天相', brightness: '庙' }],
      minorStars: [],
      adjectiveStars: []
    }
  ]
};

vi.mock('../../src/modules/ziwei/services/ziweiChartService.js', () => ({
  default: {
    getChart: vi.fn(),
    getFromLocalFile: vi.fn()
  }
}));

// Mock logger
vi.mock('../../src/core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

import ZiweiChartService from '../../src/modules/ziwei/services/ziweiChartService.js';

describe('ChartRetrieverNode v3.0', () => {
  let mockState;

  beforeEach(() => {
    mockState = new XiaoShuDongState({
      userId: 'user123',
      currentInput: '我想知道我的事业发展'
    });
    vi.clearAllMocks();
  });

  describe('chartRetrieverNode', () => {
    it('should retrieve chart from MongoDB storage', async () => {
      ZiweiChartService.getChart.mockResolvedValue(mockChartData);

      const result = await chartRetrieverNode(mockState);

      expect(result.natalChart).toBeDefined();
      expect(result.natalChart.solarDate).toBe('1990-05-15');
      expect(result.metadata.chartRetrieved).toBe(true);
      expect(result.metadata.chartSource).toBe('mongodb');
      expect(result.formattedChartText).toBeDefined();
    });

    it('should fallback to local file when MongoDB fails', async () => {
      ZiweiChartService.getChart.mockRejectedValue(new Error('MongoDB error'));
      ZiweiChartService.getFromLocalFile.mockResolvedValue({
        ...mockChartData,
        _id: null // Local file doesn't have MongoDB _id
      });

      const result = await chartRetrieverNode(mockState);

      expect(result.metadata.chartRetrieved).toBe(true);
      expect(result.metadata.chartSource).toBe('local_file');
    });

    it('should handle no chart found', async () => {
      ZiweiChartService.getChart.mockRejectedValue(new Error('Not found'));
      ZiweiChartService.getFromLocalFile.mockResolvedValue(null);

      const result = await chartRetrieverNode(mockState);

      expect(result.metadata.chartRetrieved).toBe(false);
      expect(result.metadata.chartRetrievalError).toContain('No chart data found');
    });

    it('should identify relevant palaces based on input keywords', async () => {
      ZiweiChartService.getChart.mockResolvedValue(mockChartData);

      const result = await chartRetrieverNode(mockState);

      expect(result.relevantPalaces).toBeDefined();
      expect(result.relevantPalaces.length).toBeGreaterThan(0);
      expect(result.relevantPalaces[0].name).toBe('命宫');
      expect(result.relevantPalaces[0].keyword).toBe('事业');
    });

    it('should identify multiple relevant palaces', async () => {
      mockState.currentInput = '我的财运和婚姻怎么样';
      ZiweiChartService.getChart.mockResolvedValue(mockChartData);

      const result = await chartRetrieverNode(mockState);

      const palaceNames = result.relevantPalaces.map(p => p.name);
      expect(palaceNames).toContain('财帛宫');
      expect(palaceNames).toContain('夫妻宫');
    });

    it('should return empty relevant palaces when no keywords match', async () => {
      mockState.currentInput = '今天天气怎么样';
      ZiweiChartService.getChart.mockResolvedValue(mockChartData);

      const result = await chartRetrieverNode(mockState);

      expect(result.relevantPalaces).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      ZiweiChartService.getChart.mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      ZiweiChartService.getFromLocalFile.mockImplementation(() => {
        throw new Error('File error');
      });

      const result = await chartRetrieverNode(mockState);

      expect(result.metadata.chartRetrieved).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should preserve existing state properties', async () => {
      mockState.userName = 'Test User';
      mockState.sessionId = 'session456';
      ZiweiChartService.getChart.mockResolvedValue(mockChartData);

      const result = await chartRetrieverNode(mockState);

      expect(result.userName).toBe('Test User');
      expect(result.sessionId).toBe('session456');
    });
  });

  describe('formatChartForLLM', () => {
    it('should not include table characters', async () => {
      ZiweiChartService.getChart.mockResolvedValue(mockChartData);

      const result = await chartRetrieverNode(mockState);

      expect(result.formattedChartText).not.toContain('|');
      expect(result.formattedChartText).not.toContain('---|');
    });

    it('should not include constellation (星座)', async () => {
      ZiweiChartService.getChart.mockResolvedValue(mockChartData);

      const result = await chartRetrieverNode(mockState);

      expect(result.formattedChartText).not.toContain('星座');
    });

    it('should not include horoscope analysis (运限)', async () => {
      ZiweiChartService.getChart.mockResolvedValue(mockChartData);

      const result = await chartRetrieverNode(mockState);

      expect(result.formattedChartText).not.toContain('运限');
      expect(result.formattedChartText).not.toContain('大限');
      expect(result.formattedChartText).not.toContain('流年');
    });

    it('should include basic info', async () => {
      ZiweiChartService.getChart.mockResolvedValue(mockChartData);

      const result = await chartRetrieverNode(mockState);

      expect(result.formattedChartText).toContain('公历');
      expect(result.formattedChartText).toContain('农历');
      expect(result.formattedChartText).toContain('四柱');
      expect(result.formattedChartText).toContain('生肖');
    });

    it('should include all 12 palaces', async () => {
      ZiweiChartService.getChart.mockResolvedValue(mockChartData);

      const result = await chartRetrieverNode(mockState);

      expect(result.formattedChartText).toContain('命宫');
      expect(result.formattedChartText).toContain('兄弟宫');
      expect(result.formattedChartText).toContain('夫妻宫');
      expect(result.formattedChartText).toContain('子女宫');
      expect(result.formattedChartText).toContain('财帛宫');
      expect(result.formattedChartText).toContain('疾厄宫');
      expect(result.formattedChartText).toContain('迁移宫');
      expect(result.formattedChartText).toContain('交友宫');
      expect(result.formattedChartText).toContain('官禄宫');
      expect(result.formattedChartText).toContain('田宅宫');
      expect(result.formattedChartText).toContain('福德宫');
      expect(result.formattedChartText).toContain('父母宫');
    });

    it('should include star brightness', async () => {
      ZiweiChartService.getChart.mockResolvedValue(mockChartData);

      const result = await chartRetrieverNode(mockState);

      expect(result.formattedChartText).toContain('紫微(庙)');
      expect(result.formattedChartText).toContain('武曲(旺)');
    });

    it('should handle palace with no major stars', async () => {
      ZiweiChartService.getChart.mockResolvedValue(mockChartData);

      const result = await chartRetrieverNode(mockState);

      expect(result.formattedChartText).toContain('交友宫');
      expect(result.formattedChartText).toContain('无主星');
    });
  });

  describe('getRelevantPalaces', () => {
    it('should return relevantPalaces from state', () => {
      mockState.relevantPalaces = [
        { name: '命宫', keyword: '事业', majorStars: ['紫微'] }
      ];

      const result = getRelevantPalaces(mockState);

      expect(result).toEqual(mockState.relevantPalaces);
    });

    it('should return empty array when no relevant palaces', () => {
      const result = getRelevantPalaces(mockState);

      expect(result).toEqual([]);
    });
  });

  describe('hasChart', () => {
    it('should return true when chart is retrieved', () => {
      mockState.metadata = { chartRetrieved: true };
      mockState.natalChart = { solarDate: '1990-05-15' };

      expect(hasChart(mockState)).toBe(true);
    });

    it('should return false when chartRetrieved is false', () => {
      mockState.metadata = { chartRetrieved: false };
      mockState.natalChart = { solarDate: '1990-05-15' };

      expect(hasChart(mockState)).toBe(false);
    });

    it('should return false when natalChart is null', () => {
      mockState.metadata = { chartRetrieved: true };
      mockState.natalChart = null;

      expect(hasChart(mockState)).toBe(false);
    });
  });

  describe('getFormattedChartText', () => {
    it('should return formattedChartText from state', () => {
      mockState.formattedChartText = '# Test markdown';

      const result = getFormattedChartText(mockState);

      expect(result).toBe('# Test markdown');
    });

    it('should return empty string when not set', () => {
      const result = getFormattedChartText(mockState);

      expect(result).toBe('');
    });
  });

  describe('Keyword Matching', () => {
    const keywordTests = [
      { input: '我的事业怎么样', expectedPalace: '命宫' },
      { input: '财运如何', expectedPalace: '财帛宫' },
      { input: '感情问题', expectedPalace: '夫妻宫' },
      { input: '婚姻状况', expectedPalace: '夫妻宫' },
      { input: '身体健康', expectedPalace: '疾厄宫' },
      { input: '家庭事务', expectedPalace: '田宅宫' },
      { input: '子女教育', expectedPalace: '子女宫' },
      { input: '朋友圈', expectedPalace: '交友宫' },
      { input: '父母健康', expectedPalace: '父母宫' },
      { input: '出差旅行', expectedPalace: '迁移宫' }
    ];

    keywordTests.forEach(({ input, expectedPalace }) => {
      it(`should identify ${expectedPalace} for input "${input}"`, async () => {
        mockState.currentInput = input;
        ZiweiChartService.getChart.mockResolvedValue(mockChartData);

        const result = await chartRetrieverNode(mockState);

        expect(result.relevantPalaces.some(p => p.name === expectedPalace)).toBe(true);
      });
    });
  });
});
