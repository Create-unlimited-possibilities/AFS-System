/**
 * Intent Classifier Node Unit Tests
 * Tests for LLM-based intent classification in XiaoShuDong workflow
 *
 * @author AFS Team
 * @version 2.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  intentClassifierNode,
  getIntentSummary,
  isEmotionalIntent,
  isAdviceIntent,
  getAdviceDirections
} from '../../src/modules/xiaoshudong/nodes/intentClassifier.js';

// Mock the logger
vi.mock('../../src/core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock the LLM client
vi.mock('../../src/core/llm/client.js', () => ({
  createDefaultLLMClient: vi.fn(() => ({
    generate: vi.fn(async (prompt, options) => {
      // Simulate LLM responses based on prompt content
      if (prompt.includes('很难过') && prompt.includes('怎么办')) {
        return JSON.stringify({
          isEmotional: true,
          needsAdvice: true,
          confidence: 0.85,
          directionPhrases: ['人生方向']
        });
      }
      if (prompt.includes('难过') || prompt.includes('焦虑') || prompt.includes('累')) {
        return JSON.stringify({
          isEmotional: true,
          needsAdvice: false,
          confidence: 0.9,
          directionPhrases: []
        });
      }
      if (prompt.includes('运势') || prompt.includes('怎么办') || prompt.includes('帮我看')) {
        return JSON.stringify({
          isEmotional: false,
          needsAdvice: true,
          confidence: 0.9,
          directionPhrases: ['运势']
        });
      }
      if (prompt.includes('事业') || prompt.includes('财运') || prompt.includes('感情')) {
        return JSON.stringify({
          isEmotional: false,
          needsAdvice: true,
          confidence: 0.85,
          directionPhrases: ['事业发展']
        });
      }
      // Default response
      return JSON.stringify({
        isEmotional: true,
        needsAdvice: false,
        confidence: 0.5,
        directionPhrases: []
      });
    })
  }))
}));

describe('IntentClassifierNode', () => {
  let mockState;

  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      currentInput: '',
      intent: {
        isEmotional: false,
        needsAdvice: false,
        confidence: 0
      },
      metadata: {},
      messages: []
    };
  });

  describe('intentClassifierNode', () => {
    it('should classify purely emotional input using LLM', async () => {
      mockState.currentInput = '我今天很难过，心情不好';
      const result = await intentClassifierNode(mockState);

      expect(result.intent.isEmotional).toBe(true);
      expect(result.intent.needsAdvice).toBe(false);
      expect(result.intent.confidence).toBeGreaterThan(0);
      expect(result.metadata.intentClassified).toBe(true);
    });

    it('should classify purely advice-seeking input using LLM', async () => {
      mockState.currentInput = '我最近运势怎么样？';
      const result = await intentClassifierNode(mockState);

      expect(result.intent.isEmotional).toBe(false);
      expect(result.intent.needsAdvice).toBe(true);
      expect(result.intent.confidence).toBeGreaterThan(0);
    });

    it('should classify mixed emotional + advice input', async () => {
      mockState.currentInput = '我最近很难过，不知道该怎么办';
      const result = await intentClassifierNode(mockState);

      expect(result.intent.isEmotional).toBe(true);
      expect(result.intent.needsAdvice).toBe(true);
      expect(result.intent.confidence).toBeGreaterThan(0);
    });

    it('should use precheck for very short input', async () => {
      mockState.currentInput = '嗨';
      const result = await intentClassifierNode(mockState);

      expect(result.intent.isEmotional).toBe(true);
      expect(result.metadata.classificationMethod).toBe('precheck');
    });

    it('should handle empty input gracefully', async () => {
      mockState.currentInput = '';
      const result = await intentClassifierNode(mockState);

      expect(result.intent.isEmotional).toBe(true);
    });

    it('should create intent object if not present', async () => {
      delete mockState.intent;
      mockState.currentInput = '我很难过';

      const result = await intentClassifierNode(mockState);

      expect(result.intent).toBeDefined();
      expect(result.intent.isEmotional).toBe(true);
    });

    it('should create metadata if not present', async () => {
      delete mockState.metadata;
      mockState.currentInput = '我很难过';

      const result = await intentClassifierNode(mockState);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.intentClassified).toBe(true);
    });

    it('should include advice phrases when needsAdvice is true', async () => {
      mockState.currentInput = '我的事业发展如何？';
      const result = await intentClassifierNode(mockState);

      expect(result.intent.needsAdvice).toBe(true);
      expect(result.intent.advicePhrases).toBeDefined();
      expect(Array.isArray(result.intent.advicePhrases)).toBe(true);
    });

    it('should consider conversation history for context', async () => {
      mockState.currentInput = '那接下来呢？';
      mockState.messages = [
        { role: 'user', content: '我想了解我的事业' },
        { role: 'assistant', content: '好的，让我来帮你分析' }
      ];

      const result = await intentClassifierNode(mockState);

      expect(result.intent).toBeDefined();
      // The LLM should consider the context about career advice
    });
  });

  describe('isEmotionalIntent', () => {
    it('should return true for emotional intent', () => {
      const intent = { isEmotional: true, needsAdvice: false };
      expect(isEmotionalIntent(intent)).toBe(true);
    });

    it('should return false for non-emotional intent', () => {
      const intent = { isEmotional: false, needsAdvice: true };
      expect(isEmotionalIntent(intent)).toBe(false);
    });

    it('should handle null intent', () => {
      expect(isEmotionalIntent(null)).toBe(false);
    });
  });

  describe('isAdviceIntent', () => {
    it('should return true for advice intent', () => {
      const intent = { isEmotional: false, needsAdvice: true };
      expect(isAdviceIntent(intent)).toBe(true);
    });

    it('should return false for non-advice intent', () => {
      const intent = { isEmotional: true, needsAdvice: false };
      expect(isAdviceIntent(intent)).toBe(false);
    });

    it('should handle null intent', () => {
      expect(isAdviceIntent(null)).toBe(false);
    });
  });

  describe('getAdviceDirections', () => {
    it('should return advice phrases from intent', () => {
      const intent = { advicePhrases: ['事业', '财运'] };
      expect(getAdviceDirections(intent)).toEqual(['事业', '财运']);
    });

    it('should return direction phrases as fallback', () => {
      const intent = { directionPhrases: ['感情'] };
      expect(getAdviceDirections(intent)).toEqual(['感情']);
    });

    it('should return empty array for no phrases', () => {
      const intent = {};
      expect(getAdviceDirections(intent)).toEqual([]);
    });

    it('should handle null intent', () => {
      expect(getAdviceDirections(null)).toEqual([]);
    });
  });

  describe('getIntentSummary', () => {
    it('should return emotional summary for emotional intent', () => {
      const intent = { isEmotional: true, needsAdvice: false, confidence: 0.8 };
      expect(getIntentSummary(intent)).toBe('情感倾诉');
    });

    it('should return advice summary for advice intent', () => {
      const intent = { isEmotional: false, needsAdvice: true, confidence: 0.8 };
      expect(getIntentSummary(intent)).toBe('寻求建议');
    });

    it('should return combined summary for mixed intent', () => {
      const intent = { isEmotional: true, needsAdvice: true, confidence: 0.9 };
      expect(getIntentSummary(intent)).toBe('情感倾诉 + 寻求建议');
    });

    it('should return default for null intent', () => {
      expect(getIntentSummary(null)).toBe('未知意图');
    });

    it('should return general for no clear intent', () => {
      const intent = { isEmotional: false, needsAdvice: false, confidence: 0 };
      expect(getIntentSummary(intent)).toBe('一般对话');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle state without addError method', async () => {
      const stateWithoutError = {
        currentInput: 'test',
        intent: {},
        messages: []
      };

      // Should not throw even if addError is not defined
      const result = await intentClassifierNode(stateWithoutError);
      expect(result.intent).toBeDefined();
    });

    it('should preserve existing state properties', async () => {
      mockState.userId = 'user123';
      mockState.sessionId = 'session456';
      mockState.currentInput = '我很难过';

      const result = await intentClassifierNode(mockState);

      expect(result.userId).toBe('user123');
      expect(result.sessionId).toBe('session456');
    });

    it('should update existing intent object', async () => {
      mockState.intent = {
        isEmotional: false,
        needsAdvice: false,
        confidence: 0.5,
        customField: 'preserved'
      };
      mockState.currentInput = '我很焦虑';

      const result = await intentClassifierNode(mockState);

      expect(result.intent.isEmotional).toBe(true);
      expect(result.intent.customField).toBe('preserved');
    });

    it('should handle malformed LLM response', async () => {
      // Override the mock for this specific test
      const { createDefaultLLMClient } = await import('../../src/core/llm/client.js');
      createDefaultLLMClient.mockReturnValueOnce({
        generate: vi.fn(async () => 'This is not valid JSON')
      });

      mockState.currentInput = '测试消息';
      const result = await intentClassifierNode(mockState);

      // Should fallback to default intent
      expect(result.intent).toBeDefined();
    });

    it('should handle LLM error gracefully', async () => {
      // Override the mock for this specific test
      const { createDefaultLLMClient } = await import('../../src/core/llm/client.js');
      createDefaultLLMClient.mockReturnValueOnce({
        generate: vi.fn(async () => {
          throw new Error('LLM connection failed');
        })
      });

      mockState.currentInput = '测试消息';
      const result = await intentClassifierNode(mockState);

      // Should fallback to default intent
      expect(result.intent).toBeDefined();
      expect(result.intent.isEmotional).toBe(true);
    });
  });

  describe('Classification Method Tracking', () => {
    it('should track LLM classification method', async () => {
      mockState.currentInput = '我的事业发展如何？';
      const result = await intentClassifierNode(mockState);

      expect(result.metadata.classificationMethod).toBe('llm');
    });

    it('should track precheck classification method', async () => {
      mockState.currentInput = '嗨';
      const result = await intentClassifierNode(mockState);

      expect(result.metadata.classificationMethod).toBe('precheck');
    });
  });
});
