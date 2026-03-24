# Testing Patterns

**Analysis Date:** 2026-03-24

## Test Framework

### Primary: Vitest

**Configuration:** `server/vitest.config.js`

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.vitest.js'],
    timeout: 10000,
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
  }
});
```

### Secondary: Jest

**Configuration:** `server/jest.config.cjs`

Jest is available as an alternative runner for compatibility. Uses Babel for transformation.

```javascript
module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js', '!src/server.js'],
  coverageThreshold: { global: { branches: 80, functions: 80, lines: 80, statements: 80 } },
  setupFilesAfterEnv: ['./tests/setup.js'],
  testTimeout: 10000
};
```

### Run Commands

```bash
# Vitest (primary)
npm run test                  # Run all tests
npm run test:watch            # Watch mode
npm run test:coverage         # Generate coverage report
npm run test:unit             # Run unit tests only
npm run test:integration      # Run integration tests only
npm run test:ci               # CI mode with coverage

# Jest (alternative)
npm run test:jest             # Run with Jest
```

## Test File Organization

### Location

Tests are co-located in `server/tests/` directory, organized by type:

```
server/tests/
├── setup.vitest.js          # Vitest global setup
├── setup.js                 # Jest global setup
├── basic.test.js            # Basic sanity tests
├── verify.js                # Verification utilities
├── global-setup.js          # Global setup hooks
├── global-teardown.js       # Global teardown hooks
├── unit/                    # Unit tests
│   ├── chatSession.test.js
│   ├── intentClassifier.test.js
│   ├── edges.test.js
│   ├── llmClient.test.js
│   ├── memory/
│   │   ├── Compressor.test.js
│   │   └── MemoryStore.test.js
│   └── v2/
│       ├── promptAssembler.test.js
│       └── calibrationLayer.test.js
├── integration/             # Integration tests
│   ├── roleCardGenerator.test.js
│   ├── storage-api.test.js
│   ├── memory/
│   │   └── memory-flow.test.js
│   └── xiaoshudong/
│       └── workflow.test.js
├── admin/                   # Admin endpoint tests
│   ├── admin-auth.test.js
│   ├── admin-users.test.js
│   └── admin-dashboard.test.js
├── services/                # Service layer tests
│   ├── assistService.test.js
│   └── simpleSyncQueue.test.js
├── models/                  # Model tests
│   └── answer.test.js
└── utils/                   # Test utilities
    ├── database-manager.js
    └── test-factory.js
```

### Naming

- All test files use `.test.js` suffix
- Pattern: `<moduleName>.test.js`
- Integration tests often include descriptive suffix: `<feature>-api.test.js`

## Test Structure

### Suite Organization

```javascript
/**
 * Intent Classifier Node Unit Tests
 * Tests for LLM-based intent classification in XiaoShuDong workflow
 *
 * @author AFS Team
 * @version 2.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { intentClassifierNode, getIntentSummary } from '../../src/modules/xiaoshudong/nodes/intentClassifier.js';

// Mock dependencies at the top
vi.mock('../../src/core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('IntentClassifierNode', () => {
  let mockState;

  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      currentInput: '',
      intent: { isEmotional: false, needsAdvice: false, confidence: 0 },
      metadata: {},
      messages: []
    };
  });

  describe('intentClassifierNode', () => {
    it('should classify purely emotional input using LLM', async () => {
      mockState.currentInput = 'I am feeling very sad today';
      const result = await intentClassifierNode(mockState);

      expect(result.intent.isEmotional).toBe(true);
      expect(result.intent.needsAdvice).toBe(false);
      expect(result.intent.confidence).toBeGreaterThan(0);
    });

    it('should handle empty input gracefully', async () => {
      mockState.currentInput = '';
      const result = await intentClassifierNode(mockState);

      expect(result.intent.isEmotional).toBe(true);
    });
  });

  describe('getIntentSummary', () => {
    it('should return emotional summary for emotional intent', () => {
      const intent = { isEmotional: true, needsAdvice: false, confidence: 0.8 };
      expect(getIntentSummary(intent)).toBe('Emotional venting');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed LLM response', async () => {
      // Override mock for specific test
      const { createDefaultLLMClient } = await import('../../src/core/llm/client.js');
      createDefaultLLMClient.mockReturnValueOnce({
        generate: vi.fn(async () => 'Invalid JSON')
      });

      const result = await intentClassifierNode(mockState);
      expect(result.intent).toBeDefined();
    });
  });
});
```

### Patterns

**Setup (beforeEach):**
```javascript
beforeEach(() => {
  vi.clearAllMocks();
  mockState = { ...baseState };
});
```

**Global Setup (beforeAll):**
```javascript
beforeAll(() => {
  // Suppress console in tests
  console.log = vi.fn();
  console.error = vi.fn();
});
```

**Teardown (afterAll):**
```javascript
afterAll(() => {
  // Restore original console
  Object.assign(console, originalConsole);
});
```

## Mocking

### Framework

Uses Vitest's `vi` for mocking, with Jest compatibility via `global.jest = vi` in setup.

### Mocking External Dependencies

```javascript
// Mock logger
vi.mock('../../src/core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock LLM client with conditional responses
vi.mock('../../src/core/llm/client.js', () => ({
  createDefaultLLMClient: vi.fn(() => ({
    generate: vi.fn(async (prompt, options) => {
      if (prompt.includes('sad')) {
        return JSON.stringify({ isEmotional: true, needsAdvice: false });
      }
      return JSON.stringify({ isEmotional: false, needsAdvice: true });
    })
  }))
}));
```

### Mocking Mongoose

```javascript
vi.mock('mongoose', async (importOriginal) => {
  const actual = await importOriginal();

  class MockSchema {
    constructor(definition) {
      this.definition = definition;
      this.Types = { ObjectId: vi.fn(), Mixed: vi.fn() };
    }
    index() { return this; }
  }

  return {
    default: { Schema: MockSchema, model: vi.fn() },
    Schema: MockSchema
  };
});
```

### Mocking Models

```javascript
vi.mock('../../src/models/ChatSession.js', () => {
  class MockChatSession {
    constructor(data) {
      Object.assign(this, data);
    }
    static findById(id) {
      return vi.fn().mockResolvedValue(new MockChatSession({ _id: id }));
    }
    async save() {
      return this;
    }
  }
  return { default: MockChatSession };
});
```

### What to Mock

- External services (LLM APIs, database connections)
- Logger calls (to reduce test noise)
- File system operations
- Network requests

### What NOT to Mock

- Pure utility functions (test them directly)
- Data transformation logic
- Business logic in the unit under test

## Fixtures and Factories

### Test Data Factory (Global Setup)

Defined in `tests/setup.vitest.js`:

```javascript
global.testUtils = {
  createMockUser: (overrides = {}) => ({
    _id: '507f1f77bcf86cd799439011',
    uniqueCode: 'TEST123456789012',
    email: 'test@example.com',
    name: 'Test User',
    role: '507f1f77bcf86cd799439012',
    isActive: true,
    companionChat: {
      roleCard: { personality: 'Gentle', background: 'Retired teacher' }
    },
    ...overrides
  }),

  createMockChatSession: (overrides = {}) => ({
    _id: '507f1f77bcf86cd799439013',
    sessionId: 'session_123456',
    targetUserId: '507f1f77bcf86cd799439011',
    interlocutorUserId: '507f1f77bcf86cd799439012',
    relation: 'stranger',
    sentimentScore: 50,
    messages: [],
    isActive: true,
    ...overrides
  }),

  createMockResponse: () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis()
  }),

  createMockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    user: global.testUtils.createMockUser(),
    ...overrides
  }),

  waitFor: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms))
};
```

### Test Data Constants

```javascript
global.testData = {
  sentimentTestData: [
    { message: 'I am happy today', expected: { sentiment: 'positive', score: 5 } },
    { message: 'Something sad happened', expected: { sentiment: 'negative', score: -5 } },
    { message: '', expected: { sentiment: 'neutral', score: 0 } }
  ]
};
```

### Usage in Tests

```javascript
it('should process user request', async () => {
  const mockUser = global.testUtils.createMockUser({ name: 'Custom Name' });
  const mockReq = global.testUtils.createMockRequest({ body: { userId: mockUser._id } });
  const mockRes = global.testUtils.createMockResponse();

  await controller.getUserById(mockReq, mockRes);

  expect(mockRes.json).toHaveBeenCalledWith(
    expect.objectContaining({ success: true })
  );
});
```

## Coverage

### Requirements

**Target:** 80% coverage threshold for all metrics

```javascript
coverage: {
  thresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}
```

### Exclusions

The following are excluded from coverage:
- Test files themselves (`src/**/*.test.js`)
- Server entry point (`src/server.js`)
- MongoDB connection setup (`src/mongodb/**`)
- Logger utility (`src/utils/logger.js`)

### View Coverage

```bash
npm run test:coverage

# Output formats:
# - text (console)
# - lcov (for CI tools)
# - html (open coverage/index.html)
```

## Test Types

### Unit Tests

**Location:** `server/tests/unit/`

**Scope:** Test individual functions, classes, and modules in isolation.

**Characteristics:**
- Fast execution
- Heavy use of mocks
- Focus on single responsibility
- Test edge cases and error handling

```javascript
describe('isEmotionalIntent', () => {
  it('should return true for emotional intent', () => {
    const intent = { isEmotional: true, needsAdvice: false };
    expect(isEmotionalIntent(intent)).toBe(true);
  });

  it('should handle null intent', () => {
    expect(isEmotionalIntent(null)).toBe(false);
  });
});
```

### Integration Tests

**Location:** `server/tests/integration/`

**Scope:** Test multiple components working together.

**Characteristics:**
- May use real database connections (test database)
- Test API endpoints end-to-end
- Verify data flow between modules
- Longer execution time

```javascript
describe('Storage API Integration', () => {
  it('should store and retrieve data correctly', async () => {
    const response = await request(app)
      .post('/api/storage')
      .send({ key: 'test', value: 'data' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

### E2E Tests

**Status:** Not currently implemented

The project does not have a dedicated E2E testing framework. Integration tests cover the critical workflows.

## Common Patterns

### Async Testing

```javascript
// Using async/await (preferred)
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

// Testing rejections
it('should reject on error', async () => {
  await expect(errorFunction()).rejects.toThrow('Error message');
});
```

### Error Testing

```javascript
it('should handle errors gracefully', async () => {
  const { createDefaultLLMClient } = await import('../../src/core/llm/client.js');
  createDefaultLLMClient.mockReturnValueOnce({
    generate: vi.fn(async () => { throw new Error('Connection failed'); })
  });

  const result = await intentClassifierNode(mockState);

  // Should fallback gracefully
  expect(result.intent).toBeDefined();
  expect(result.intent.isEmotional).toBe(true);
});
```

### State Mutation Testing

```javascript
it('should preserve existing state properties', async () => {
  mockState.userId = 'user123';
  mockState.sessionId = 'session456';

  const result = await processNode(mockState);

  expect(result.userId).toBe('user123');
  expect(result.sessionId).toBe('session456');
});
```

### Workflow/Path Testing

```javascript
it('should handle full workflow path', () => {
  const state = new State();
  state.intent = { isEmotional: true, needsAdvice: true };

  let current = 'start';
  const path = [current];

  while (shouldContinue(current)) {
    current = getNextNode(current, state);
    if (!shouldContinue(current)) break;
    path.push(current);
  }

  expect(path).toEqual(['start', 'node1', 'node2', 'end']);
});
```

## Frontend Testing

### Status

**Not implemented.** The web frontend (`web/`) does not currently have test files. Testing infrastructure is limited to the backend.

### Recommended Setup (Future)

For Next.js 15 + React 19 frontend, consider:
- **Vitest** for unit/component tests
- **React Testing Library** for component testing
- **Playwright** or **Cypress** for E2E tests

```bash
# Recommended additions to web/package.json
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

---

*Testing analysis: 2026-03-24*
