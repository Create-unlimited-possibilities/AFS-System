const { test, describe, expect } = require('@jest/globals');

describe('Simple Test', () => {
  test('should pass', () => {
    expect(2 + 2).toBe(4);
  });
});