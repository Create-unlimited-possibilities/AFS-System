/**
 * XiaoShuDong State Class Unit Tests
 * Tests for the conversation state management in XiaoShuDong workflow
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import XiaoShuDongState from '../../src/modules/xiaoshudong/state/XiaoShuDongState.js';

describe('XiaoShuDongState', () => {
  let state;

  beforeEach(() => {
    state = new XiaoShuDongState({
      userId: 'user123',
      userName: 'Test User',
      sessionId: 'session456'
    });
  });

  describe('Constructor', () => {
    it('should create state with default values', () => {
      const emptyState = new XiaoShuDongState();

      expect(emptyState.userId).toBe('');
      expect(emptyState.userName).toBe('');
      expect(emptyState.messages).toEqual([]);
      expect(emptyState.currentInput).toBe('');
      expect(emptyState.generatedResponse).toBe('');
      expect(emptyState.natalChart).toBe(null);
      expect(emptyState.horoscope).toBe(null);
      expect(emptyState.ragContext).toEqual([]);
      expect(emptyState.fortuneResponse).toBe('');
      expect(emptyState.emotionalResponse).toBe('');
      expect(emptyState.finalResponse).toBe('');
      expect(emptyState.errors).toEqual([]);
    });

    it('should create state with provided values', () => {
      expect(state.userId).toBe('user123');
      expect(state.userName).toBe('Test User');
      expect(state.metadata.sessionId).toBe('session456');
    });

    it('should initialize intent with default values', () => {
      expect(state.intent).toEqual({
        isEmotional: false,
        needsAdvice: false,
        confidence: 0
      });
    });

    it('should initialize metadata with defaults', () => {
      expect(state.metadata.chartRetrieved).toBe(false);
      expect(state.metadata.ragRetrieved).toBe(false);
      expect(state.metadata.modelUsed).toBe('');
      expect(state.metadata.processingTime).toBe(0);
      expect(state.metadata.intentClassified).toBe(false);
    });

    it('should merge provided metadata with defaults', () => {
      const customState = new XiaoShuDongState({
        metadata: {
          customField: 'customValue',
          processingTime: 100
        }
      });

      expect(customState.metadata.customField).toBe('customValue');
      expect(customState.metadata.processingTime).toBe(100);
      expect(customState.metadata.chartRetrieved).toBe(false); // Default preserved
    });

    it('should accept custom intent values', () => {
      const customState = new XiaoShuDongState({
        intent: {
          isEmotional: true,
          needsAdvice: true,
          confidence: 0.9
        }
      });

      expect(customState.intent.isEmotional).toBe(true);
      expect(customState.intent.needsAdvice).toBe(true);
      expect(customState.intent.confidence).toBe(0.9);
    });
  });

  describe('setState', () => {
    it('should update state fields', () => {
      state.setState({
        currentInput: 'Hello',
        userName: 'Updated Name'
      });

      expect(state.currentInput).toBe('Hello');
      expect(state.userName).toBe('Updated Name');
    });

    it('should return this for chaining', () => {
      const result = state.setState({ currentInput: 'test' });
      expect(result).toBe(state);
    });

    it('should update multiple fields at once', () => {
      state.setState({
        currentInput: 'input',
        generatedResponse: 'response',
        fortuneResponse: 'fortune'
      });

      expect(state.currentInput).toBe('input');
      expect(state.generatedResponse).toBe('response');
      expect(state.fortuneResponse).toBe('fortune');
    });
  });

  describe('addMessage', () => {
    it('should add message to history', () => {
      state.addMessage('user', 'Hello');

      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].role).toBe('user');
      expect(state.messages[0].content).toBe('Hello');
    });

    it('should add timestamp to message', () => {
      const beforeTime = Date.now();
      state.addMessage('user', 'test');
      const afterTime = Date.now();

      expect(state.messages[0].timestamp).toBeInstanceOf(Date);
      expect(state.messages[0].timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(state.messages[0].timestamp.getTime()).toBeLessThanOrEqual(afterTime);
    });

    it('should add metadata to message', () => {
      const metadata = { sentiment: 'positive' };
      state.addMessage('assistant', 'Response', metadata);

      expect(state.messages[0].metadata).toEqual(metadata);
    });

    it('should use empty metadata as default', () => {
      state.addMessage('user', 'test');

      expect(state.messages[0].metadata).toEqual({});
    });

    it('should return this for chaining', () => {
      const result = state.addMessage('user', 'test');
      expect(result).toBe(state);
    });

    it('should add multiple messages', () => {
      state.addMessage('user', 'Hello');
      state.addMessage('assistant', 'Hi there');
      state.addMessage('user', 'How are you?');

      expect(state.messages).toHaveLength(3);
    });
  });

  describe('addError', () => {
    it('should add error to errors list', () => {
      const error = new Error('Test error');
      state.addError(error);

      expect(state.errors).toHaveLength(1);
      expect(state.errors[0].message).toBe('Test error');
    });

    it('should add timestamp to error', () => {
      const beforeTime = Date.now();
      const error = new Error('test');
      state.addError(error);
      const afterTime = Date.now();

      expect(state.errors[0].timestamp).toBeInstanceOf(Date);
      expect(state.errors[0].timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(state.errors[0].timestamp.getTime()).toBeLessThanOrEqual(afterTime);
    });

    it('should preserve stack trace', () => {
      const error = new Error('test');
      state.addError(error);

      expect(state.errors[0].stack).toBe(error.stack);
    });

    it('should return this for chaining', () => {
      const error = new Error('test');
      const result = state.addError(error);
      expect(result).toBe(state);
    });

    it('should add multiple errors', () => {
      state.addError(new Error('Error 1'));
      state.addError(new Error('Error 2'));

      expect(state.errors).toHaveLength(2);
    });
  });

  describe('hasBirthInfo', () => {
    it('should return false when natalChart is null', () => {
      expect(state.hasBirthInfo()).toBe(false);
    });

    it('should return true when natalChart is set', () => {
      state.natalChart = { some: 'data' };
      expect(state.hasBirthInfo()).toBe(true);
    });

    it('should return false when natalChart is undefined', () => {
      state.natalChart = undefined;
      expect(state.hasBirthInfo()).toBe(false);
    });

    it('should return true for empty object natalChart', () => {
      state.natalChart = {};
      expect(state.hasBirthInfo()).toBe(true);
    });
  });

  describe('hasRagContext', () => {
    it('should return false when ragContext is empty', () => {
      expect(state.hasRagContext()).toBe(false);
    });

    it('should return true when ragContext has items', () => {
      state.ragContext = [{ content: 'test' }];
      expect(state.hasRagContext()).toBe(true);
    });

    it('should return false when ragContext is null', () => {
      state.ragContext = null;
      expect(state.hasRagContext()).toBe(false);
    });

    it('should return false when ragContext is undefined', () => {
      state.ragContext = undefined;
      expect(state.hasRagContext()).toBe(false);
    });
  });

  describe('hasFortuneResponse', () => {
    it('should return false when fortuneResponse is empty', () => {
      expect(state.hasFortuneResponse()).toBe(false);
    });

    it('should return true when fortuneResponse has content', () => {
      state.fortuneResponse = 'Some fortune text';
      expect(state.hasFortuneResponse()).toBe(true);
    });

    it('should return false for whitespace-only response', () => {
      state.fortuneResponse = '   ';
      expect(state.hasFortuneResponse()).toBe(false);
    });
  });

  describe('hasEmotionalResponse', () => {
    it('should return false when emotionalResponse is empty', () => {
      expect(state.hasEmotionalResponse()).toBe(false);
    });

    it('should return true when emotionalResponse has content', () => {
      state.emotionalResponse = 'Some emotional text';
      expect(state.hasEmotionalResponse()).toBe(true);
    });

    it('should return false for whitespace-only response', () => {
      state.emotionalResponse = '   ';
      expect(state.hasEmotionalResponse()).toBe(false);
    });
  });

  describe('getIntentSummary', () => {
    it('should return emotional summary for emotional intent', () => {
      state.intent.isEmotional = true;
      state.intent.needsAdvice = false;

      expect(state.getIntentSummary()).toBe('情感倾诉');
    });

    it('should return advice summary for advice intent', () => {
      state.intent.isEmotional = false;
      state.intent.needsAdvice = true;

      expect(state.getIntentSummary()).toBe('寻求建议');
    });

    it('should return combined summary for mixed intent', () => {
      state.intent.isEmotional = true;
      state.intent.needsAdvice = true;

      expect(state.getIntentSummary()).toBe('情感倾诉 + 寻求建议');
    });

    it('should return general for no clear intent', () => {
      state.intent.isEmotional = false;
      state.intent.needsAdvice = false;

      expect(state.getIntentSummary()).toBe('一般对话');
    });
  });

  describe('getSummary', () => {
    it('should return state summary', () => {
      state.addMessage('user', 'test');
      state.addError(new Error('test'));
      state.intent.isEmotional = true;

      const summary = state.getSummary();

      expect(summary.userId).toBe('user123');
      expect(summary.sessionId).toBe('session456');
      expect(summary.intent).toBe('情感倾诉');
      expect(summary.hasChart).toBe(false);
      expect(summary.hasRagContext).toBe(false);
      expect(summary.hasFortuneResponse).toBe(false);
      expect(summary.hasEmotionalResponse).toBe(false);
      expect(summary.messageCount).toBe(1);
      expect(summary.errorCount).toBe(1);
      expect(summary.processingTime).toBe(0);
    });

    it('should reflect updated state', () => {
      state.natalChart = { data: 'test' };
      state.ragContext = [{ content: 'rag' }];
      state.fortuneResponse = 'fortune';
      state.emotionalResponse = 'emotional';

      const summary = state.getSummary();

      expect(summary.hasChart).toBe(true);
      expect(summary.hasRagContext).toBe(true);
      expect(summary.hasFortuneResponse).toBe(true);
      expect(summary.hasEmotionalResponse).toBe(true);
    });
  });

  describe('reset', () => {
    it('should create fresh state with preserved user info', () => {
      state.addMessage('user', 'old message');
      state.currentInput = 'old input';

      const freshState = state.reset();

      expect(freshState.userId).toBe('user123');
      expect(freshState.userName).toBe('Test User');
      expect(freshState.metadata.sessionId).toBe('session456');
      expect(freshState.messages).toEqual([]);
      expect(freshState.currentInput).toBe('');
    });

    it('should accept new initial data', () => {
      const freshState = state.reset({
        currentInput: 'new input'
      });

      expect(freshState.currentInput).toBe('new input');
    });

    it('should not modify original state', () => {
      state.addMessage('user', 'test');
      state.reset();

      expect(state.messages).toHaveLength(1);
    });
  });

  describe('toJSON', () => {
    it('should serialize state to plain object', () => {
      state.addMessage('user', 'test');
      state.addError(new Error('test error'));

      const json = state.toJSON();

      expect(json.userId).toBe('user123');
      expect(json.userName).toBe('Test User');
      expect(json.messages).toHaveLength(1);
      expect(json.errors).toHaveLength(1);
    });

    it('should exclude stack trace from JSON errors', () => {
      state.addError(new Error('test'));

      const json = state.toJSON();

      expect(json.errors[0].message).toBe('test');
      expect(json.errors[0].stack).toBeUndefined();
      expect(json.errors[0].timestamp).toBeDefined();
    });

    it('should include all major fields', () => {
      const json = state.toJSON();

      expect(json).toHaveProperty('userId');
      expect(json).toHaveProperty('userName');
      expect(json).toHaveProperty('messages');
      expect(json).toHaveProperty('currentInput');
      expect(json).toHaveProperty('intent');
      expect(json).toHaveProperty('natalChart');
      expect(json).toHaveProperty('horoscope');
      expect(json).toHaveProperty('ragContext');
      expect(json).toHaveProperty('fortuneResponse');
      expect(json).toHaveProperty('emotionalResponse');
      expect(json).toHaveProperty('finalResponse');
      expect(json).toHaveProperty('metadata');
      expect(json).toHaveProperty('errors');
    });
  });

  describe('fromJSON', () => {
    it('should create state from JSON object', () => {
      const jsonData = {
        userId: 'user456',
        userName: 'JSON User',
        currentInput: 'test input',
        intent: {
          isEmotional: true,
          needsAdvice: false,
          confidence: 0.8
        }
      };

      const newState = XiaoShuDongState.fromJSON(jsonData);

      expect(newState.userId).toBe('user456');
      expect(newState.userName).toBe('JSON User');
      expect(newState.currentInput).toBe('test input');
      expect(newState.intent.isEmotional).toBe(true);
    });

    it('should handle empty JSON', () => {
      const newState = XiaoShuDongState.fromJSON({});

      expect(newState.userId).toBe('');
      expect(newState.messages).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null initialData', () => {
      const nullState = new XiaoShuDongState(null);

      expect(nullState.userId).toBe('');
      expect(nullState.messages).toEqual([]);
    });

    it('should handle undefined initialData', () => {
      const undefinedState = new XiaoShuDongState(undefined);

      expect(undefinedState.userId).toBe('');
    });

    it('should preserve prototype methods after setState', () => {
      state.setState({ customField: 'value' });

      expect(typeof state.addMessage).toBe('function');
      expect(typeof state.hasBirthInfo).toBe('function');
      expect(typeof state.getIntentSummary).toBe('function');
    });
  });
});
