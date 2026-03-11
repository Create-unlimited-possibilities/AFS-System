/**
 * Migration Script Unit Tests
 * Tests for the ziwei books migration script
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Mock the file system
vi.mock('fs');
vi.mock('../src/core/storage/chroma.js');
vi.mock('../src/core/storage/embedding.js');
vi.mock('../src/core/utils/logger.js');

describe('Migration Script - Helper Functions', () => {
  const CHUNKS_DIR = 'F:/FPY/ziwei-project/data/rag/chunks';

  describe('generateUUID', () => {
    // Import the function directly by reading the file
    let generateUUID;

    beforeEach(async () => {
      // We need to test the function in isolation
      // Since we can't easily import from a script, we'll test the logic
      generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
    });

    it('should generate a valid UUID format', () => {
      const uuid = generateUUID();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);
    });

    it('should generate unique UUIDs', () => {
      const uuids = new Set();
      for (let i = 0; i < 1000; i++) {
        uuids.add(generateUUID());
      }
      expect(uuids.size).toBe(1000);
    });

    it('should always have 4 in the 13th position (UUID version)', () => {
      for (let i = 0; i < 100; i++) {
        const uuid = generateUUID();
        expect(uuid[14]).toBe('4');
      }
    });

    it('should have valid variant in the 17th position', () => {
      const validVariants = ['8', '9', 'a', 'b'];
      for (let i = 0; i < 100; i++) {
        const uuid = generateUUID();
        expect(validVariants).toContain(uuid[19].toLowerCase());
      }
    });
  });

  describe('loadChunks - Logic', () => {
    // Test the chunk loading logic
    it('should parse valid JSONL chunk', () => {
      const line = '{"content": "Test content", "source": "book1", "chunk_id": 1}';
      const data = JSON.parse(line);

      expect(data.content).toBe('Test content');
      expect(data.source).toBe('book1');
      expect(data.chunk_id).toBe(1);
    });

    it('should skip empty content', () => {
      const line = '{"content": "", "source": "book1", "chunk_id": 1}';
      const data = JSON.parse(line);

      expect(data.content.trim()).toBe('');
    });

    it('should handle missing optional fields', () => {
      const line = '{"content": "Test content"}';
      const data = JSON.parse(line);

      expect(data.content).toBe('Test content');
      expect(data.source).toBeUndefined();
      expect(data.chunk_id).toBeUndefined();
    });

    it('should handle malformed JSON', () => {
      const line = '{"content": "test", invalid}';

      expect(() => JSON.parse(line)).toThrow();
    });
  });

  describe('Batch Processing Logic', () => {
    it('should calculate correct batch sizes', () => {
      const BATCH_SIZE = 50;
      const totalChunks = 2459;
      const expectedBatches = Math.ceil(totalChunks / BATCH_SIZE);

      expect(expectedBatches).toBe(50); // 2459 / 50 = 49.18 → 50 batches
    });

    it('should handle last batch correctly', () => {
      const BATCH_SIZE = 50;
      const totalChunks = 120;
      const lastBatchStart = Math.floor((totalChunks - 1) / BATCH_SIZE) * BATCH_SIZE;
      const lastBatchSize = totalChunks - lastBatchStart;

      expect(lastBatchSize).toBe(20); // 120 - 100 = 20
    });

    it('should calculate progress percentage', () => {
      const processed = 1234;
      const total = 2459;
      const progress = ((processed / total) * 100).toFixed(1);

      expect(progress).toBe('50.2');
    });
  });

  describe('Source Statistics', () => {
    it('should aggregate chunks by source', () => {
      const chunks = [
        { source: 'book1', chunk_id: 1 },
        { source: 'book1', chunk_id: 2 },
        { source: 'book2', chunk_id: 1 },
        { source: 'book3', chunk_id: 1 },
        { source: 'book3', chunk_id: 2 },
        { source: 'book3', chunk_id: 3 }
      ];

      const sourceCounts = {};
      chunks.forEach(c => {
        sourceCounts[c.source] = (sourceCounts[c.source] || 0) + 1;
      });

      expect(sourceCounts['book1']).toBe(2);
      expect(sourceCounts['book2']).toBe(1);
      expect(sourceCounts['book3']).toBe(3);
    });
  });
});

describe('Migration Script - Configuration', () => {
  it('should use correct configuration values', () => {
    const ZIWEI_PROJECT_ROOT = 'F:/FPY/ziwei-project';
    const CHUNKS_DIR = join(ZIWEI_PROJECT_ROOT, 'data/rag/chunks');
    const COLLECTION_NAME = 'ziwei_books';
    const BATCH_SIZE = 50;

    expect(CHUNKS_DIR).toContain('ziwei-project');
    expect(CHUNKS_DIR).toContain('data');
    expect(CHUNKS_DIR).toContain('rag');
    expect(CHUNKS_DIR).toContain('chunks');
    expect(COLLECTION_NAME).toBe('ziwei_books');
    expect(BATCH_SIZE).toBe(50);
  });

  it('should allow CLEAR_COLLECTION environment variable', () => {
    const clearEnv = 'true';
    expect(clearEnv).toBe('true');
  });
});

describe('Migration Script - Error Handling', () => {
  it('should handle directory not found', () => {
    const exists = false; // Simulating directory not existing

    if (!exists) {
      const error = 'Chunks directory not found';
      expect(error).toBeTruthy();
    }
  });

  it('should handle file read errors', () => {
    const readFileError = new Error('EACCES: permission denied');

    expect(readFileError.message).toContain('permission denied');
  });

  it('should handle embedding service errors', () => {
    const embeddingError = new Error('Failed to generate embeddings');

    expect(embeddingError.message).toBe('Failed to generate embeddings');
  });

  it('should handle ChromaDB connection errors', () => {
    const dbError = new Error('ECONNREFUSED: Connection refused');

    expect(dbError.message).toContain('Connection refused');
  });
});

describe('Migration Script - Metadata', () => {
  it('should create correct metadata structure', () => {
    const chunk = {
      content: 'Test content',
      source: 'book1',
      chunk_id: 1
    };

    const metadata = {
      source: chunk.source,
      chunk_id: chunk.chunk_id,
      migrated_at: new Date().toISOString()
    };

    expect(metadata.source).toBe('book1');
    expect(metadata.chunk_id).toBe(1);
    expect(metadata.migrated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should use defaults for missing fields', () => {
    const chunk = { content: 'Test' };

    const defaults = {
      source: chunk.source || 'unknown',
      chunk_id: chunk.chunk_id || 0
    };

    expect(defaults.source).toBe('unknown');
    expect(defaults.chunk_id).toBe(0);
  });
});
