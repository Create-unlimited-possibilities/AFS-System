/**
 * Unit Tests for XiaoShuDong Edges
 * Tests for workflow routing and conditional edges
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect } from 'vitest';
import { getNextNode, shouldContinue, edges } from '../../src/modules/xiaoshudong/edges.js';
import XiaoShuDongState from '../../src/modules/xiaoshudong/state/XiaoShuDongState.js';

describe('XiaoShuDong Edges', () => {
  describe('getNextNode', () => {
    describe('from intent_classifier', () => {
      it('should route to chart_retriever when needsAdvice is true', () => {
        const state = new XiaoShuDongState();
        state.intent = { isEmotional: false, needsAdvice: true, confidence: 0.8 };

        const next = getNextNode('intent_classifier', state);

        expect(next).toBe('chart_retriever');
      });

      it('should route to chart_retriever when both intents are true', () => {
        const state = new XiaoShuDongState();
        state.intent = { isEmotional: true, needsAdvice: true, confidence: 0.9 };

        const next = getNextNode('intent_classifier', state);

        expect(next).toBe('chart_retriever');
      });

      it('should route to response_polisher for emotional-only intent', () => {
        const state = new XiaoShuDongState();
        state.intent = { isEmotional: true, needsAdvice: false, confidence: 0.7 };

        const next = getNextNode('intent_classifier', state);

        expect(next).toBe('response_polisher');
      });

      it('should route to chart_retriever by default when intent is unclear', () => {
        const state = new XiaoShuDongState();
        state.intent = { isEmotional: false, needsAdvice: false, confidence: 0.3 };

        const next = getNextNode('intent_classifier', state);

        expect(next).toBe('chart_retriever');
      });

      it('should handle missing intent object', () => {
        const state = new XiaoShuDongState();
        // Don't set intent

        const next = getNextNode('intent_classifier', state);

        expect(next).toBe('chart_retriever');
      });
    });

    describe('from chart_retriever', () => {
      it('should route to rag_retriever when chart was retrieved', () => {
        const state = new XiaoShuDongState();
        state.metadata = { chartRetrieved: true };

        const next = getNextNode('chart_retriever', state);

        expect(next).toBe('rag_retriever');
      });

      it('should route to response_polisher when chart was not retrieved', () => {
        const state = new XiaoShuDongState();
        state.metadata = { chartRetrieved: false };

        const next = getNextNode('chart_retriever', state);

        expect(next).toBe('response_polisher');
      });

      it('should route to response_polisher when metadata is missing', () => {
        const state = new XiaoShuDongState();
        // Don't set metadata

        const next = getNextNode('chart_retriever', state);

        expect(next).toBe('response_polisher');
      });
    });

    describe('from rag_retriever', () => {
      it('should always route to fortune_generator', () => {
        const state = new XiaoShuDongState();

        const next = getNextNode('rag_retriever', state);

        expect(next).toBe('fortune_generator');
      });
    });

    describe('from fortune_generator', () => {
      it('should always route to response_polisher', () => {
        const state = new XiaoShuDongState();

        const next = getNextNode('fortune_generator', state);

        expect(next).toBe('response_polisher');
      });
    });

    describe('from response_polisher', () => {
      it('should route to output', () => {
        const state = new XiaoShuDongState();

        const next = getNextNode('response_polisher', state);

        expect(next).toBe('output');
      });
    });

    describe('unknown nodes', () => {
      it('should route to output for unknown nodes', () => {
        const state = new XiaoShuDongState();

        const next = getNextNode('unknown_node', state);

        expect(next).toBe('output');
      });
    });
  });

  describe('shouldContinue', () => {
    it('should return false for output', () => {
      expect(shouldContinue('output')).toBe(false);
    });

    it('should return false for null', () => {
      expect(shouldContinue(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(shouldContinue(undefined)).toBe(false);
    });

    it('should return true for valid nodes', () => {
      expect(shouldContinue('intent_classifier')).toBe(true);
      expect(shouldContinue('chart_retriever')).toBe(true);
      expect(shouldContinue('rag_retriever')).toBe(true);
      expect(shouldContinue('fortune_generator')).toBe(true);
      expect(shouldContinue('response_polisher')).toBe(true);
    });
  });

  describe('edges object', () => {
    it('should have all defined edges', () => {
      expect(edges).toHaveProperty('intent_classifier');
      expect(edges).toHaveProperty('chart_retriever');
      expect(edges).toHaveProperty('rag_retriever');
      expect(edges).toHaveProperty('fortune_generator');
      expect(edges).toHaveProperty('response_polisher');
    });

    it('should define sequential flow', () => {
      expect(edges.intent_classifier).toBe('chart_retriever');
      expect(edges.chart_retriever).toBe('rag_retriever');
      expect(edges.rag_retriever).toBe('fortune_generator');
      expect(edges.fortune_generator).toBe('response_polisher');
      expect(edges.response_polisher).toBe('output');
    });
  });

  describe('integration scenarios', () => {
    it('should handle full advice workflow path', () => {
      const state = new XiaoShuDongState();
      state.intent = { isEmotional: true, needsAdvice: true, confidence: 0.8 };
      state.metadata = { chartRetrieved: true };

      // Simulate workflow progression
      let current = 'intent_classifier';
      const path = [current];

      while (shouldContinue(current)) {
        current = getNextNode(current, state);
        if (!shouldContinue(current)) break;
        path.push(current);
      }

      expect(path).toEqual([
        'intent_classifier',
        'chart_retriever',
        'rag_retriever',
        'fortune_generator',
        'response_polisher'
      ]);
    });

    it('should handle emotional-only workflow path', () => {
      const state = new XiaoShuDongState();
      state.intent = { isEmotional: true, needsAdvice: false, confidence: 0.7 };

      // Simulate workflow progression
      let current = 'intent_classifier';
      const path = [current];

      while (shouldContinue(current)) {
        current = getNextNode(current, state);
        if (!shouldContinue(current)) break;
        path.push(current);
      }

      expect(path).toEqual([
        'intent_classifier',
        'response_polisher'
      ]);
    });

    it('should handle no-chart workflow path', () => {
      const state = new XiaoShuDongState();
      state.intent = { isEmotional: false, needsAdvice: true, confidence: 0.8 };
      state.metadata = { chartRetrieved: false };

      // Simulate workflow progression
      let current = 'intent_classifier';
      const path = [current];

      while (shouldContinue(current)) {
        current = getNextNode(current, state);
        if (!shouldContinue(current)) break;
        path.push(current);
      }

      expect(path).toEqual([
        'intent_classifier',
        'chart_retriever',
        'response_polisher'
      ]);
    });
  });
});
