/**
 * LLM Index Export Tests
 * Verifies that all expected exports are available from the LLM index module
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, test, expect } from 'vitest';
import { modelInfoService, multiLLMClient, getLLMService } from '../../src/core/llm/index.js';
import LLMService from '../../src/core/llm/index.js';

describe('LLM Index Exports', () => {
  describe('modelInfoService export', () => {
    test('should export modelInfoService', () => {
      expect(modelInfoService).toBeDefined();
    });

    test('modelInfoService should have getContextLimit method', () => {
      expect(modelInfoService.getContextLimit).toBeDefined();
      expect(typeof modelInfoService.getContextLimit).toBe('function');
    });

    test('modelInfoService should have refreshContextLimit method', () => {
      expect(modelInfoService.refreshContextLimit).toBeDefined();
      expect(typeof modelInfoService.refreshContextLimit).toBe('function');
    });

    test('modelInfoService should have clearCache method', () => {
      expect(modelInfoService.clearCache).toBeDefined();
      expect(typeof modelInfoService.clearCache).toBe('function');
    });

    test('modelInfoService should have getCacheStats method', () => {
      expect(modelInfoService.getCacheStats).toBeDefined();
      expect(typeof modelInfoService.getCacheStats).toBe('function');
    });
  });

  describe('multiLLMClient export', () => {
    test('should export multiLLMClient', () => {
      expect(multiLLMClient).toBeDefined();
    });

    test('multiLLMClient should have generate method', () => {
      expect(multiLLMClient.generate).toBeDefined();
      expect(typeof multiLLMClient.generate).toBe('function');
    });
  });

  describe('getLLMService export', () => {
    test('should export getLLMService function', () => {
      expect(getLLMService).toBeDefined();
      expect(typeof getLLMService).toBe('function');
    });

    test('getLLMService should return LLMService instance', () => {
      const service = getLLMService();
      expect(service).toBeDefined();
      expect(service.chat).toBeDefined();
      expect(service.generate).toBeDefined();
      expect(service.healthCheck).toBeDefined();
    });
  });

  describe('default export', () => {
    test('should export LLMService as default', () => {
      expect(LLMService).toBeDefined();
    });
  });
});
