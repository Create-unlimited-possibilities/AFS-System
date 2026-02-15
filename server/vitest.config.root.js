/**
 * Vitest 配置 - 支持内存数据库测试
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    
    // 测试文件匹配模式
    include: [
      'tests/basic-simple.test.js',
      'tests/unit/*.test.js',
      'tests/integration/*.test.js'
    ],
    
    // 全局变量支持
    globals: true,
    
    // 每个测试文件的设置
    setupFiles: ['./tests/setup.js'],
    
    // 全局设置（一次性的）
    globalSetup: ['./tests/global-setup.js'],
    globalTeardown: ['./tests/global-teardown.js'],
    
    // 超时设置
    testTimeout: 15000,  // 增加到15秒，适应数据库操作
    hookTimeout: 10000,
    
    // 报告器
    reporters: ['default', 'verbose'],
    
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/test.js',
        '**/*.test.js',
        '**/*.spec.js',
        '**/migrations/**',
        '**/seeds/**'
      ],
      // 设置覆盖率目标
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80
    },
    
    // 并行配置
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false  // 允许并行执行
      }
    },
    
    // 监控模式配置
    watch: {
      include: ['tests/**/*.test.js', 'src/**/*.js']
    }
  }
})