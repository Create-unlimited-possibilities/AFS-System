import { describe, it, expect, beforeEach } from 'vitest';
import VectorIndexService from '../../src/services/vectorIndexService.js';

describe('VectorIndexService', () => {
  let vectorService;

  beforeEach(() => {
    vectorService = new VectorIndexService();
  });

  it('should throw error when trying to use uninitialized service', async () => {
    expect(vectorService.getCollection('user123')).rejects.toThrow();
  });
});