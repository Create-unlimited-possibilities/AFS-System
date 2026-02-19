/**
 * TokenMonitor Unit Tests
 * Tests the token monitoring and conversation termination functionality
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  tokenMonitorNode,
  estimateTokens,
  detectEndIntent,
  getModelContextLimit,
  getThresholds
} from '../../../src/modules/chat/nodes/tokenMonitor.js';

// Mock the logger
vi.mock('../../../src/core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('TokenMonitor', () => {
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

  describe('detectEndIntent', () => {
    it('should detect exact goodbye phrases', () => {
      const goodbyes = ['再见', '拜拜', '不聊了', 'bye', 'goodbye'];

      for (const phrase of goodbyes) {
        const result = detectEndIntent(phrase);

        expect(result.isEndIntent).toBe(true);
        expect(result.confidence).toBe(1.0);
        expect(result.matchType).toBe('exact');
      }
    });

    it('should detect goodbye phrases in longer messages', () => {
      const messages = [
        '我们下次再聊吧，再见',
        '我先走了，拜拜',
        '今天先这样，bye'
      ];

      for (const message of messages) {
        const result = detectEndIntent(message);

        expect(result.isEndIntent).toBe(true);
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
        expect(result.matchType).toBe('include');
      }
    });

    it('should give higher confidence when phrase is at end', () => {
      const atEnd = detectEndIntent('我们聊得很开心，再见');
      const inMiddle = detectEndIntent('再见，我们下次再聊');

      expect(atEnd.confidence).toBeGreaterThan(inMiddle.confidence);
    });

    it('should detect partial matches with keywords', () => {
      const result = detectEndIntent('我觉得可以结束了');

      expect(result.isEndIntent).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.matchType).toBe('keyword');
    });

    it('should return false for normal conversation', () => {
      const normalMessages = [
        '今天天气真好',
        '你觉得呢？',
        '我还有个问题想问',
        '这个话题很有意思'
      ];

      for (const message of normalMessages) {
        const result = detectEndIntent(message);
        expect(result.isEndIntent).toBe(false);
      }
    });

    it('should handle null/undefined input', () => {
      expect(detectEndIntent(null).isEndIntent).toBe(false);
      expect(detectEndIntent(undefined).isEndIntent).toBe(false);
      expect(detectEndIntent('').isEndIntent).toBe(false);
    });

    it('should handle case insensitivity', () => {
      const result = detectEndIntent('BYE BYE');

      expect(result.isEndIntent).toBe(true);
    });

    it('should detect multiple end keywords with higher confidence', () => {
      const result = detectEndIntent('再见，不聊了，拜拜');

      expect(result.isEndIntent).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('getModelContextLimit', () => {
    it('should return correct limit for deepseek-r1:14b', () => {
      const limit = getModelContextLimit('deepseek-r1:14b');
      expect(limit).toBe(65536);
    });

    it('should return correct limit for deepseek-r1', () => {
      const limit = getModelContextLimit('deepseek-r1');
      expect(limit).toBe(65536);
    });

    it('should return correct limit for qwen2.5', () => {
      const limit = getModelContextLimit('qwen2.5');
      expect(limit).toBe(32768);
    });

    it('should return default limit for unknown models', () => {
      const limit = getModelContextLimit('unknown-model');
      expect(limit).toBe(65536);
    });
  });

  describe('getThresholds', () => {
    it('should return threshold configuration', () => {
      const thresholds = getThresholds();

      expect(thresholds.gentleReminder).toBe(0.6);
      expect(thresholds.forceTerminate).toBe(0.7);
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
      expect(result.tokenInfo.message).toBeNull();
    });

    it('should set action to remind when at 60% threshold', async () => {
      // Create state with usage at ~60%
      const limit = getModelContextLimit('deepseek-r1:14b');
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

      expect(result.tokenInfo.action).toBe('remind');
      expect(result.tokenInfo.message).not.toBeNull();
    });

    it('should set action to terminate when at 70% threshold', async () => {
      // Create state with usage at ~70%
      const limit = getModelContextLimit('deepseek-r1:14b');
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

      expect(result.tokenInfo.action).toBe('terminate');
      expect(result.tokenInfo.message).not.toBeNull();
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
  });

  describe('Token Threshold Actions', () => {
    it('should return reminder message at 60% threshold', async () => {
      const limit = getModelContextLimit('deepseek-r1:14b');
      const targetTokens = Math.floor(limit * 0.65); // 65%

      const systemPrompt = 'A'.repeat(Math.floor(targetTokens / 0.25));

      const state = {
        metadata: { modelUsed: 'deepseek-r1:14b' },
        systemPrompt,
        messages: [],
        currentInput: '',
        retrievedMemories: [],
        userName: '测试用户'
      };

      const result = await tokenMonitorNode(state);

      expect(result.tokenInfo.action).toBe('remind');
      expect(result.tokenInfo.message).toContain('测试用户');
    });

    it('should return termination message at 70% threshold', async () => {
      const limit = getModelContextLimit('deepseek-r1:14b');
      const targetTokens = Math.floor(limit * 0.75); // 75%

      const systemPrompt = 'A'.repeat(Math.floor(targetTokens / 0.25));

      const state = {
        metadata: { modelUsed: 'deepseek-r1:14b' },
        systemPrompt,
        messages: [],
        currentInput: '',
        retrievedMemories: [],
        userName: '测试用户'
      };

      const result = await tokenMonitorNode(state);

      expect(result.tokenInfo.action).toBe('terminate');
      expect(result.tokenInfo.message).toBeDefined();
    });
  });

  describe('Model-specific behavior', () => {
    it('should use correct limits for different models', async () => {
      const models = [
        { name: 'deepseek-r1:14b', expectedLimit: 65536 },
        { name: 'deepseek-r1', expectedLimit: 65536 },
        { name: 'qwen2.5', expectedLimit: 32768 },
        { name: 'unknown', expectedLimit: 65536 }
      ];

      for (const { name, expectedLimit } of models) {
        const state = {
          metadata: { modelUsed: name },
          systemPrompt: 'Test',
          messages: [],
          currentInput: '',
          retrievedMemories: []
        };

        const result = await tokenMonitorNode(state);

        expect(result.tokenInfo.contextLimit).toBe(expectedLimit);
      }
    });
  });
});
