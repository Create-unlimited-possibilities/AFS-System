/**
 * TokenMonitor Unit Tests
 * Tests the token monitoring and conversation termination functionality
 *
 * @author AFS Team
 * @version 2.1.0 - Updated for dynamic context limits
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock modelInfoService before importing tokenMonitor
vi.mock('../../../src/core/llm/modelInfoService.js', () => ({
  default: {
    getContextLimit: vi.fn()
  }
}));

// Mock the logger
vi.mock('../../../src/core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import modelInfoService from '../../../src/core/llm/modelInfoService.js';
import {
  tokenMonitorNode,
  estimateTokens,
  getThresholds
} from '../../../src/modules/chat/nodes/tokenMonitor.js';

describe('TokenMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock return value
    modelInfoService.getContextLimit.mockResolvedValue(65536);
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for Chinese text correctly', () => {
      // Chinese characters: ~1.5 tokens each
      const chineseText = '你好世界'; // 4 characters
      const tokens = estimateTokens(chineseText);

      // 4 * 1.5 = 6 tokens (rounded up)
      expect(tokens).toBe(6);
    });

    it('should estimate tokens for English text correctly', () => {
      // ASCII: ~0.25 tokens per char (4 chars per token)
      const englishText = 'Hello World!'; // 12 characters
      const tokens = estimateTokens(englishText);

      // 12 * 0.25 = 3 tokens (rounded up)
      expect(tokens).toBe(3);
    });

    it('should estimate tokens for mixed content', () => {
      // Mix of Chinese and English
      const mixedText = 'Hello世界'; // 5 English + 2 Chinese
      const tokens = estimateTokens(mixedText);

      // English: 5 * 0.25 = 1.25
      // Chinese: 2 * 1.5 = 3
      // Total: ~4.25, rounded up to 5
      expect(tokens).toBeGreaterThanOrEqual(4);
      expect(tokens).toBeLessThanOrEqual(6);
    });

    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should return 0 for null/undefined', () => {
      expect(estimateTokens(null)).toBe(0);
      expect(estimateTokens(undefined)).toBe(0);
    });

    it('should handle CJK punctuation', () => {
      const textWithPunctuation = '，。！？'; // 4 CJK punctuation marks
      const tokens = estimateTokens(textWithPunctuation);

      // CJK punctuation: ~1.0 tokens each (but actual implementation varies)
      expect(tokens).toBeGreaterThanOrEqual(3);
    });

    it('should handle numbers', () => {
      const numbers = '1234567890'; // 10 ASCII digits
      const tokens = estimateTokens(numbers);

      // Numbers are ASCII: 10 * 0.25 = 2.5, rounded up to 3
      expect(tokens).toBeGreaterThanOrEqual(2);
    });

    it('should handle special characters', () => {
      const specialChars = '@#$%^&*()'; // 8 ASCII special chars
      const tokens = estimateTokens(specialChars);

      expect(tokens).toBeGreaterThanOrEqual(2);
    });

    it('should handle long text', () => {
      const longText = 'A'.repeat(1000); // 1000 ASCII chars
      const tokens = estimateTokens(longText);

      // 1000 * 0.25 = 250 tokens
      expect(tokens).toBe(250);
    });
  });

  describe('getThresholds', () => {
    it('should return threshold configuration', () => {
      const thresholds = getThresholds();

      expect(thresholds.fatiguePrompt).toBe(0.6);
      expect(thresholds.forceOffline).toBe(0.7);
    });
  });

  describe('tokenMonitorNode', () => {
    const createMockState = (overrides = {}) => ({
      metadata: {
        modelUsed: 'deepseek-r1:14b'
      },
      messages: [],
      systemPrompt: '',
      currentInput: '',
      retrievedMemories: [],
      ...overrides
    });

    it('should calculate token usage correctly', async () => {
      const state = createMockState({
        systemPrompt: 'System prompt',
        messages: [
          { content: 'Message 1' },
          { content: 'Message 2' }
        ],
        currentInput: 'User input',
        retrievedMemories: []
      });

      const result = await tokenMonitorNode(state);

      expect(result.tokenInfo).toBeDefined();
      expect(result.tokenInfo.usage.systemPrompt).toBeGreaterThan(0);
      expect(result.tokenInfo.usage.messages).toBeGreaterThan(0);
      expect(result.tokenInfo.usage.currentInput).toBeGreaterThan(0);
      expect(result.tokenInfo.usage.total).toBeGreaterThan(0);
    });

    it('should set action to continue when below 60% threshold', async () => {
      const state = createMockState({
        systemPrompt: 'Short', // ~1 token
        messages: [], // 0 tokens
        currentInput: 'Hi' // ~1 token
      });

      const result = await tokenMonitorNode(state);

      // Usage should be very low, so action should be 'continue'
      expect(result.tokenInfo.action).toBe('continue');
    });

    it('should set action to fatigue_prompt when at 60% threshold', async () => {
      // Create state with usage at ~60%
      const limit = 65536;
      const targetTokens = Math.floor(limit * 0.61); // Slightly above 60%

      // Create content that will result in ~60% usage
      const systemPrompt = 'A'.repeat(Math.floor(targetTokens * 0.8 / 0.25)); // ASCII
      const currentInput = 'B'.repeat(Math.floor(targetTokens * 0.2 / 0.25));

      const state = createMockState({
        systemPrompt,
        currentInput,
        messages: [],
        retrievedMemories: []
      });

      const result = await tokenMonitorNode(state);

      expect(result.tokenInfo.action).toBe('fatigue_prompt');
    });

    it('should set action to force_offline when at 70% threshold', async () => {
      // Create state with usage at ~70%
      const limit = 65536;
      const targetTokens = Math.floor(limit * 0.72); // Slightly above 70%

      // Create content that will result in ~72% usage
      const systemPrompt = 'A'.repeat(Math.floor(targetTokens * 0.9 / 0.25)); // ASCII
      const currentInput = 'B'.repeat(Math.floor(targetTokens * 0.1 / 0.25));

      const state = createMockState({
        systemPrompt,
        currentInput,
        messages: [],
        retrievedMemories: []
      });

      const result = await tokenMonitorNode(state);

      expect(result.tokenInfo.action).toBe('force_offline');
    });

    it('should include response buffer in total', async () => {
      const state = createMockState({
        systemPrompt: 'Test',
        currentInput: 'Test'
      });

      const result = await tokenMonitorNode(state);

      // Response buffer is 1000 tokens
      expect(result.tokenInfo.usage.responseBuffer).toBe(1000);
    });

    it('should store usage ratio as percentage in metadata', async () => {
      const state = createMockState({
        systemPrompt: 'Short',
        currentInput: 'Test'
      });

      const result = await tokenMonitorNode(state);

      expect(result.metadata.tokenInfo.usageRatio).toBeDefined();
      expect(result.metadata.tokenInfo.usageRatio).toBeLessThanOrEqual(100);
      expect(result.metadata.tokenInfo.action).toBeDefined();
    });

    it('should handle missing messages array', async () => {
      const state = createMockState({
        messages: undefined
      });

      const result = await tokenMonitorNode(state);

      expect(result.tokenInfo).toBeDefined();
      expect(result.tokenInfo.usage.messages).toBe(0);
    });

    it('should handle empty messages array', async () => {
      const state = createMockState({
        messages: []
      });

      const result = await tokenMonitorNode(state);

      expect(result.tokenInfo.usage.messages).toBe(0);
    });

    it('should handle retrieved memories', async () => {
      const state = createMockState({
        retrievedMemories: [
          { content: 'Memory 1 content here' },
          { summary: 'Memory 2 summary' },
          'Simple string memory'
        ]
      });

      const result = await tokenMonitorNode(state);

      expect(result.tokenInfo.usage.memories).toBeGreaterThan(0);
    });

    it('should use default model when not specified', async () => {
      const state = createMockState({
        metadata: {}
      });

      const result = await tokenMonitorNode(state);

      expect(result.tokenInfo.modelUsed).toBe('deepseek-r1:14b');
      expect(result.tokenInfo.contextLimit).toBe(65536);
    });

    it('should handle errors gracefully', async () => {
      // Create a state that might cause issues
      const state = {
        // Missing expected properties
        metadata: null
      };

      // Should not throw, but return state with error info
      const result = await tokenMonitorNode(state);

      expect(result.tokenInfo).toBeDefined();
      expect(result.tokenInfo.action).toBe('continue');
    });

    it('should include checkedAt timestamp', async () => {
      const state = createMockState();

      const result = await tokenMonitorNode(state);

      expect(result.tokenInfo.checkedAt).toBeDefined();
      expect(new Date(result.tokenInfo.checkedAt)).toBeInstanceOf(Date);
    });

    it('should use dynamic context limit from modelInfoService', async () => {
      modelInfoService.getContextLimit.mockResolvedValueOnce(131072);

      const state = createMockState({
        metadata: { modelUsed: 'ziwei-8b' }
      });

      const result = await tokenMonitorNode(state);

      expect(modelInfoService.getContextLimit).toHaveBeenCalledWith('ziwei-8b');
      expect(result.tokenInfo.contextLimit).toBe(131072);
    });

    it('should fallback to default when modelInfoService fails', async () => {
      modelInfoService.getContextLimit.mockRejectedValueOnce(new Error('API error'));

      const state = createMockState({
        metadata: { modelUsed: 'unknown-model' }
      });

      const result = await tokenMonitorNode(state);

      // modelInfoService returns default 65536 on error
      expect(result.tokenInfo.contextLimit).toBe(65536);
    });
  });

  describe('Token Threshold Actions', () => {
    it('should set fatigue_prompt action at 60% threshold', async () => {
      const limit = 65536;
      const targetTokens = Math.floor(limit * 0.65); // 65%

      const systemPrompt = 'A'.repeat(Math.floor(targetTokens / 0.25));

      const state = {
        metadata: { modelUsed: 'deepseek-r1:14b' },
        systemPrompt,
        messages: [],
        currentInput: '',
        retrievedMemories: []
      };

      const result = await tokenMonitorNode(state);

      expect(result.tokenInfo.action).toBe('fatigue_prompt');
    });

    it('should set force_offline action at 70% threshold', async () => {
      const limit = 65536;
      const targetTokens = Math.floor(limit * 0.75); // 75%

      const systemPrompt = 'A'.repeat(Math.floor(targetTokens / 0.25));

      const state = {
        metadata: { modelUsed: 'deepseek-r1:14b' },
        systemPrompt,
        messages: [],
        currentInput: '',
        retrievedMemories: []
      };

      const result = await tokenMonitorNode(state);

      expect(result.tokenInfo.action).toBe('force_offline');
    });
  });

  describe('Model-specific behavior', () => {
    it('should use context limits from modelInfoService for different models', async () => {
      const models = [
        { name: 'deepseek-r1:14b', expectedLimit: 65536 },
        { name: 'deepseek-r1', expectedLimit: 65536 },
        { name: 'qwen2.5', expectedLimit: 32768 },
        { name: 'unknown', expectedLimit: 65536 }
      ];

      for (const { name, expectedLimit } of models) {
        modelInfoService.getContextLimit.mockResolvedValueOnce(expectedLimit);

        const state = {
          metadata: { modelUsed: name },
          systemPrompt: 'Test',
          messages: [],
          currentInput: '',
          retrievedMemories: []
        };

        const result = await tokenMonitorNode(state);

        expect(modelInfoService.getContextLimit).toHaveBeenCalledWith(name);
        expect(result.tokenInfo.contextLimit).toBe(expectedLimit);
      }
    });
  });
});
