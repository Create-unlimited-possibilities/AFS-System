/**
 * Ziwei 8B Model Configuration Tests
 * Tests for the Ollama modelfile configuration
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const MODELFILE_PATH = join(process.cwd(), 'config/ziwei-8b.modelfile');

describe('Ziwei 8B Modelfile Configuration', () => {
  let modelfileContent;

  beforeEach(() => {
    if (existsSync(MODELFILE_PATH)) {
      modelfileContent = readFileSync(MODELFILE_PATH, 'utf-8');
    } else {
      modelfileContent = '';
    }
  });

  describe('File Existence', () => {
    it('should have modelfile at correct path', () => {
      expect(existsSync(MODELFILE_PATH)).toBe(true);
    });

    it('should be readable', () => {
      expect(modelfileContent).toBeDefined();
      expect(modelfileContent.length).toBeGreaterThan(0);
    });
  });

  describe('FROM Statement', () => {
    it('should specify correct GGUF model path', () => {
      expect(modelfileContent).toContain('FROM F:/FPY/ziwei-project/models/gguf/');
      expect(modelfileContent).toContain('DeepSeek-R1-0528-Qwen3-8B-checkpoint-2745_q5_k_m.gguf');
    });

    it('should have FROM at the beginning', () => {
      const lines = modelfileContent.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
      expect(lines[0]).toContain('FROM');
    });
  });

  describe('Model Parameters', () => {
    it('should set temperature to 0.7', () => {
      expect(modelfileContent).toContain('PARAMETER temperature 0.7');
    });

    it('should set top_p to 0.9', () => {
      expect(modelfileContent).toContain('PARAMETER top_p 0.9');
    });

    it('should set top_k to 40', () => {
      expect(modelfileContent).toContain('PARAMETER top_k 40');
    });

    it('should set num_ctx to 4096', () => {
      expect(modelfileContent).toContain('PARAMETER num_ctx 4096');
    });

    it('should set repeat_penalty to 1.1', () => {
      expect(modelfileContent).toContain('PARAMETER repeat_penalty 1.1');
    });

    it('should set num_predict to 2048', () => {
      expect(modelfileContent).toContain('PARAMETER num_predict 2048');
    });
  });

  describe('System Prompt', () => {
    it('should include SYSTEM directive', () => {
      expect(modelfileContent).toContain('SYSTEM');
    });

    it('should define ziwei analyst persona', () => {
      expect(modelfileContent).toContain('紫微斗数命理分析师');
    });

    it('should mention professional analysis principles', () => {
      expect(modelfileContent).toContain('专业性');
      expect(modelfileContent).toContain('通俗易懂');
      expect(modelfileContent).toContain('深度分析');
      expect(modelfileContent).toContain('积极引导');
    });

    it('should include guidance on response structure', () => {
      expect(modelfileContent).toContain('结构清晰');
    });
  });

  describe('Comments and Documentation', () => {
    it('should include usage instructions in comments', () => {
      expect(modelfileContent).toContain('ollama create');
      expect(modelfileContent).toContain('ollama run');
    });

    it('should include model description', () => {
      expect(modelfileContent).toContain('DeepSeek-R1-0528-Qwen3-8B');
      expect(modelfileContent).toContain('ziwei');
    });

    it('should document model purpose', () => {
      expect(modelfileContent).toContain('fortune-telling analysis');
    });
  });

  describe('Configuration Validation', () => {
    it('should have valid temperature range (0-1)', () => {
      const match = modelfileContent.match(/PARAMETER temperature (\d+\.\d+)/);
      if (match) {
        const temp = parseFloat(match[1]);
        expect(temp).toBeGreaterThanOrEqual(0);
        expect(temp).toBeLessThanOrEqual(1);
      }
    });

    it('should have valid top_p range (0-1)', () => {
      const match = modelfileContent.match(/PARAMETER top_p (\d+\.\d+)/);
      if (match) {
        const topP = parseFloat(match[1]);
        expect(topP).toBeGreaterThanOrEqual(0);
        expect(topP).toBeLessThanOrEqual(1);
      }
    });

    it('should have reasonable context window', () => {
      const match = modelfileContent.match(/PARAMETER num_ctx (\d+)/);
      if (match) {
        const ctx = parseInt(match[1]);
        expect(ctx).toBeGreaterThan(0);
      }
    });

    it('should have reasonable max tokens', () => {
      const match = modelfileContent.match(/PARAMETER num_predict (\d+)/);
      if (match) {
        const predict = parseInt(match[1]);
        expect(predict).toBeGreaterThan(0);
      }
    });
  });

  describe('Expected Usage', () => {
    it('should document create command', () => {
      expect(modelfileContent).toMatch(/ollama create ziwei-8b -f/);
      expect(modelfileContent).toContain('server/config/ziwei-8b.modelfile');
    });

    it('should document run command', () => {
      expect(modelfileContent).toMatch(/ollama run ziwei-8b/);
      expect(modelfileContent).toContain('请分析命宫在午宫');
    });
  });

  describe('Chinese Language Support', () => {
    it('should use Chinese system prompt', () => {
      expect(modelfileContent).toContain('你是一位专业的');
      expect(modelfileContent).toContain('命理分析师');
    });

    it('should have Chinese analysis principles', () => {
      expect(modelfileContent).toContain('命盘信息');
      expect(modelfileContent).toContain('命理分析');
    });
  });

  describe('Format Compliance', () => {
    it('should follow Ollama modelfile format', () => {
      // Check for proper FROM statement
      expect(modelfileContent).toMatch(/^FROM\s+\S+/m);

      // Check for PARAMETER statements
      expect(modelfileContent).toMatch(/PARAMETER \w+ \S+/);

      // Check for SYSTEM statement
      expect(modelfileContent).toMatch(/^SYSTEM\s+/m);
    });

    it('should not have syntax errors', () => {
      // Basic validation - no empty lines with FROM
      const lines = modelfileContent.split('\n');
      let lastLineWasFrom = false;

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) {
          lastLineWasFrom = false;
          continue;
        }

        // FROM should only appear at the beginning (ignoring comments)
        if (trimmed.startsWith('FROM')) {
          // Only allow FROM as the first non-comment line
          const previousNonCommentLines = lines.slice(0, lines.indexOf(line))
            .filter(l => l.trim() && !l.trim().startsWith('#'));
          expect(previousNonCommentLines.length).toBe(0);
        }
      }
    });
  });
});
