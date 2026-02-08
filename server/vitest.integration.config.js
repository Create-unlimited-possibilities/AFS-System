import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // 不使用 setup.vitest.js，因为集成测试需要真实的数据库和 LLM 连接
    setupFiles: [],
    timeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.js'],
      exclude: [
        'src/**/*.test.js',
        'src/server.js',
        'src/mongodb/**',
        'src/utils/logger.js'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': './src'
    }
  },
  define: {
    'import.meta.vitest': undefined
  }
});
