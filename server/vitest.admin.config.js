/**
 * Vitest configuration for Admin E2E Tests
 * Uses real database connections (not mocks)
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/admin/setup.js'],
    timeout: 30000, // 30 second timeout for E2E tests
    include: ['tests/admin/**/*.test.js'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    isolate: false, // Share database connection between tests
    // Disable coverage for E2E tests
    coverage: {
      enabled: false
    },
    // Prevent test files from importing from each other
    allowOnly: false,
    // Show full test output
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './test-results/admin-e2e-results.json'
    }
  },
  resolve: {
    alias: {
      '@': './src'
    }
  }
});
