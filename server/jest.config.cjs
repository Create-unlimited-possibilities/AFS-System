module.exports = {
  // 测试环境
  testEnvironment: 'node',
  
  // 模块文件扩展名
  moduleFileExtensions: ['js', 'json'],
  
  // 测试文件匹配模式
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // 忽略的路径
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // 覆盖率配置
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/server.js',
    '!src/mongodb/**',
    '!src/utils/logger.js' // 排除日志文件
  ],
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Mock 配置
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // 超时设置
  testTimeout: 10000,
  
  // 转换配置
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Setup 文件
  setupFilesAfterEnv: ['./tests/setup.js'],
  
  // 详细输出
  verbose: true,
  
  // 并发执行
  maxWorkers: '50%',
  
  // 错误时停止
  bail: false,
  
  // 忽略警告
  errorOnDeprecated: false,
  
  
};