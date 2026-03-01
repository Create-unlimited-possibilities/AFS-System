/**
 * Unit Tests for Fortune Generator Node
 * Tests for generating fortune-telling responses using 8B model
 * Updated for v2.0 - uses generateReportFromPrompt with dynamic prompt assembly
 *
 * @author AFS Team
 * @version 2.0.0
 *
 * NOTE: Some tests that require complex async mocking have been moved to
 * integration tests due to vitest module mocking limitations.
 * See: tests/integration/xiaoshudong/ for full workflow tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to ensure mockStore is available before vi.mock runs
const mockStore = vi.hoisted(() => ({
  implementation: null
}));

// Mock the configLoader first (no side effects)
vi.mock('../../src/modules/langgraph/configLoader.js', () => ({
  configLoader: {
    getPrompt: vi.fn(() => '## 分析要求\n请根据以上命盘信息进行分析。')
  }
}));

// Mock the logger (no side effects)
vi.mock('../../src/core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock ziweiLlm - use a function that delegates to the store
vi.mock('../../src/core/ziwei/ziweiLlm.js', () => ({
  default: {
    generateReportFromPrompt: async (prompt) => {
      if (mockStore.implementation) {
        return await mockStore.implementation(prompt);
      }
      return '';
    }
  }
}));

// Import AFTER mocks are defined
import {
  fortuneGeneratorNode,
  hasFortuneResponse,
  getFortuneResponse,
  formatFortuneResponse
} from '../../src/modules/xiaoshudong/nodes/fortuneGenerator.js';
import XiaoShuDongState from '../../src/modules/xiaoshudong/state/XiaoShuDongState.js';

describe('Fortune Generator Node', () => {
  beforeEach(() => {
    // Reset the mock store
    mockStore.implementation = null;
  });

  describe('fortuneGeneratorNode - Core Behavior', () => {
    it('should skip generation when formattedChartText and natalChart are missing', async () => {
      const state = new XiaoShuDongState({
        userId: 'user123',
        currentInput: '我的事业如何'
      });

      const result = await fortuneGeneratorNode(state);

      expect(result.fortuneResponse).toBe('');
      expect(result.metadata.fortuneGenerated).toBe(false);
      expect(result.metadata.fortuneGenerationError).toBe('No chart data available');
    });

    it('should use natalChart when formattedChartText is missing', async () => {
      const state = new XiaoShuDongState({
        userId: 'user123',
        currentInput: '我的事业如何',
        natalChart: {
          solarDate: '1990-05-15',
          palaces: []
        }
      });

      mockStore.implementation = async () => 'Test response';

      const result = await fortuneGeneratorNode(state);

      expect(result.fortuneResponse).toBe('Test response');
      expect(result.metadata.fortuneGenerated).toBe(true);
    });
  });

  describe('hasFortuneResponse', () => {
    it('should return true when fortune was generated and has content', () => {
      const state = new XiaoShuDongState();
      state.metadata = { fortuneGenerated: true };
      state.fortuneResponse = 'Test response';

      expect(hasFortuneResponse(state)).toBe(true);
    });

    it('should return false when fortuneGenerated is false', () => {
      const state = new XiaoShuDongState();
      state.metadata = { fortuneGenerated: false };
      state.fortuneResponse = 'Test response';

      expect(hasFortuneResponse(state)).toBe(false);
    });

    it('should return false when fortuneResponse is empty', () => {
      const state = new XiaoShuDongState();
      state.metadata = { fortuneGenerated: true };
      state.fortuneResponse = '';

      expect(hasFortuneResponse(state)).toBe(false);
    });

    it('should return false when fortuneResponse is null', () => {
      const state = new XiaoShuDongState();
      state.metadata = { fortuneGenerated: true };
      state.fortuneResponse = null;

      expect(hasFortuneResponse(state)).toBe(false);
    });

    it('should return false when metadata is undefined', () => {
      const state = new XiaoShuDongState();
      state.fortuneResponse = 'Test response';

      expect(hasFortuneResponse(state)).toBe(false);
    });
  });

  describe('getFortuneResponse', () => {
    it('should return fortune response from state', () => {
      const state = new XiaoShuDongState();
      state.fortuneResponse = 'Test fortune response';

      expect(getFortuneResponse(state)).toBe('Test fortune response');
    });

    it('should return empty string when fortuneResponse is undefined', () => {
      const state = new XiaoShuDongState();

      expect(getFortuneResponse(state)).toBe('');
    });

    it('should return empty string when fortuneResponse is null', () => {
      const state = new XiaoShuDongState();
      state.fortuneResponse = null;

      expect(getFortuneResponse(state)).toBe('');
    });
  });

  describe('formatFortuneResponse', () => {
    it('should format response with header by default', () => {
      const state = new XiaoShuDongState();
      state.fortuneResponse = 'Test content';
      state.metadata = { modelUsed: 'ziwei-8b' };

      const result = formatFortuneResponse(state);

      expect(result).toContain('## 命理分析');
      expect(result).toContain('Test content');
    });

    it('should exclude header when includeHeader is false', () => {
      const state = new XiaoShuDongState();
      state.fortuneResponse = 'Test content';

      const result = formatFortuneResponse(state, { includeHeader: false });

      expect(result).not.toContain('## 命理分析');
      expect(result).toContain('Test content');
    });

    it('should include metadata when includeMetadata is true', () => {
      const state = new XiaoShuDongState();
      state.fortuneResponse = 'Test content';
      state.metadata = {
        modelUsed: 'ziwei-8b',
        fortuneGenerationDuration: 1500
      };

      const result = formatFortuneResponse(state, { includeMetadata: true });

      expect(result).toContain('分析模型：ziwei-8b');
      expect(result).toContain('生成时间：1500ms');
    });

    it('should not include metadata when includeMetadata is false', () => {
      const state = new XiaoShuDongState();
      state.fortuneResponse = 'Test content';
      state.metadata = { modelUsed: 'ziwei-8b' };

      const result = formatFortuneResponse(state, { includeMetadata: false });

      expect(result).not.toContain('分析模型：');
      expect(result).not.toContain('生成时间：');
    });

    it('should return empty string when no fortune response', () => {
      const state = new XiaoShuDongState();
      state.fortuneResponse = '';

      expect(formatFortuneResponse(state)).toBe('');
    });

    it('should handle missing metadata gracefully', () => {
      const state = new XiaoShuDongState();
      state.fortuneResponse = 'Test content';
      state.metadata = { modelUsed: 'ziwei-8b' };

      const result = formatFortuneResponse(state, { includeMetadata: true });

      expect(result).toContain('分析模型：ziwei-8b');
      expect(result).not.toContain('生成时间：');
    });

    it('should preserve newlines in fortune response', () => {
      const state = new XiaoShuDongState();
      state.fortuneResponse = 'Line 1\n\nLine 2\nLine 3';

      const result = formatFortuneResponse(state, { includeHeader: false });

      expect(result).toContain('Line 1\n\nLine 2\nLine 3');
    });
  });
});
