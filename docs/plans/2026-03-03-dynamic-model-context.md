# Dynamic Model Context Length - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded model context limits with dynamic fetching from Ollama API.

**Architecture:** Create a new OllamaModelInfoService that fetches model info from Ollama's `/api/show` endpoint, extracts `context_length` from the response, and caches it in memory. Modify tokenMonitor to use this service instead of hardcoded limits.

**Tech Stack:** Node.js, Express, Ollama API, Vitest

**Design Doc:** `docs/plans/2026-03-03-dynamic-model-context-design.md`

---

## Task 1: Create OllamaModelInfoService

**Files:**
- Create: `server/src/core/llm/modelInfoService.js`
- Create: `server/tests/unit/llm/modelInfoService.test.js`

### Step 1: Write the failing test

Create `server/tests/unit/llm/modelInfoService.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OllamaModelInfoService from '../../../src/core/llm/modelInfoService.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('OllamaModelInfoService', () => {
  let service;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, OLLAMA_BASE_URL: 'http://localhost:11434' };
    service = new OllamaModelInfoService();
  });

  afterEach(() => {
    process.env = originalEnv;
    service.clearCache();
  });

  describe('getContextLimit', () => {
    it('should fetch and return context_length from Ollama API', async () => {
      // Mock successful API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model_info: {
            'qwen3.context_length': 131072,
            'qwen3.embedding_length': 4096
          },
          parameters: 'num_ctx 4096'
        })
      });

      const result = await service.getContextLimit('test-model');

      expect(result).toBe(131072);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/show',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ model: 'test-model' })
        })
      );
    });

    it('should return cached value on second call', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model_info: { 'qwen3.context_length': 65536 }
        })
      });

      await service.getContextLimit('cached-model');
      await service.getContextLimit('cached-model');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should return default when API fails', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.getContextLimit('unknown-model');

      expect(result).toBe(65536);
    });

    it('should return default when context_length not found', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ model_info: {} })
      });

      const result = await service.getContextLimit('no-context-model');

      expect(result).toBe(65536);
    });

    it('should extract context_length from different model families', async () => {
      // Test llama family
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model_info: { 'llama.context_length': 8192 }
        })
      });

      const result = await service.getContextLimit('llama-model');
      expect(result).toBe(8192);
    });

    it('should fallback to num_ctx parameter if context_length missing', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model_info: {},
          parameters: 'num_ctx 16384\ntemperature 0.7'
        })
      });

      const result = await service.getContextLimit('param-model');

      expect(result).toBe(16384);
    });
  });

  describe('clearCache', () => {
    it('should clear cached model info', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model_info: { 'qwen3.context_length': 32768 }
        })
      });

      await service.getContextLimit('clear-test');
      service.clearCache();

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model_info: { 'qwen3.context_length': 32768 }
        })
      });

      await service.getContextLimit('clear-test');

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
```

### Step 2: Run test to verify it fails

Run:
```bash
cd server && npm run test:unit -- tests/unit/llm/modelInfoService.test.js
```

Expected: FAIL with "Cannot find module" or similar error

### Step 3: Write minimal implementation

Create `server/src/core/llm/modelInfoService.js`:

```javascript
/**
 * Ollama Model Info Service
 * Fetches and caches model context length from Ollama API
 *
 * @author AFS Team
 * @version 1.0.0
 */

import logger from '../utils/logger.js';

const modelInfoLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'MODEL_INFO_SERVICE' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'MODEL_INFO_SERVICE' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'MODEL_INFO_SERVICE' })
};

// Default fallback context limit
const DEFAULT_CONTEXT_LIMIT = 65536;

// API timeout in milliseconds
const API_TIMEOUT = 5000;

/**
 * Ollama Model Info Service
 * Provides dynamic model context length information
 */
class OllamaModelInfoService {
  constructor() {
    this.cache = new Map();
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://modelserver:11434';
  }

  /**
   * Get context limit for a model (with caching)
   * @param {string} modelName - Model name (e.g., 'deepseek-r1:14b')
   * @returns {Promise<number>} Context limit in tokens
   */
  async getContextLimit(modelName) {
    // Check cache first
    if (this.cache.has(modelName)) {
      modelInfoLogger.info(`Cache hit for model: ${modelName}`);
      return this.cache.get(modelName);
    }

    // Fetch from Ollama API
    try {
      const contextLimit = await this._fetchContextLimit(modelName);
      this.cache.set(modelName, contextLimit);
      modelInfoLogger.info(`Fetched context limit for ${modelName}: ${contextLimit}`);
      return contextLimit;
    } catch (error) {
      modelInfoLogger.warn(`Failed to fetch context limit for ${modelName}, using default: ${error.message}`);
      return DEFAULT_CONTEXT_LIMIT;
    }
  }

  /**
   * Fetch context limit from Ollama API
   * @param {string} modelName - Model name
   * @returns {Promise<number>} Context limit
   * @private
   */
  async _fetchContextLimit(modelName) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await fetch(`${this.baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      return this._extractContextLength(data);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Extract context length from API response
   * @param {Object} data - API response
   * @returns {number} Context length
   * @private
   */
  _extractContextLength(data) {
    // Try to find context_length in model_info
    const modelInfo = data.model_info || {};

    // Look for any key ending with context_length
    for (const [key, value] of Object.entries(modelInfo)) {
      if (key.endsWith('.context_length') || key === 'context_length') {
        return value;
      }
    }

    // Fallback: parse from parameters string
    const parameters = data.parameters || '';
    const numCtxMatch = parameters.match(/num_ctx\s+(\d+)/);
    if (numCtxMatch) {
      return parseInt(numCtxMatch[1], 10);
    }

    // No context length found, use default
    return DEFAULT_CONTEXT_LIMIT;
  }

  /**
   * Force refresh cache for a model
   * @param {string} modelName - Model name
   * @returns {Promise<number>} Fresh context limit
   */
  async refreshContextLimit(modelName) {
    this.cache.delete(modelName);
    return this.getContextLimit(modelName);
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
    modelInfoLogger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      models: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export default new OllamaModelInfoService();
```

### Step 4: Run test to verify it passes

Run:
```bash
cd server && npm run test:unit -- tests/unit/llm/modelInfoService.test.js
```

Expected: PASS (all tests green)

### Step 5: Commit

```bash
git add server/src/core/llm/modelInfoService.js server/tests/unit/llm/modelInfoService.test.js
git commit -m "feat(llm): add OllamaModelInfoService for dynamic context length

- Fetch model info from Ollama /api/show endpoint
- Extract context_length from model_info
- Cache results in memory
- Fallback to 65536 when API unavailable

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Export OllamaModelInfoService from index.js

**Files:**
- Modify: `server/src/core/llm/index.js`

### Step 1: Write the test

Add to `server/tests/unit/llm/modelInfoService.test.js` or verify existing export:

```javascript
describe('Module exports', () => {
  it('should export OllamaModelInfoService from index', async () => {
    const llmModule = await import('../../../src/core/llm/index.js');
    expect(llmModule.modelInfoService).toBeDefined();
  });
});
```

### Step 2: Run test to verify it fails

Run:
```bash
cd server && npm run test:unit -- tests/unit/llm/modelInfoService.test.js
```

Expected: FAIL - modelInfoService not exported

### Step 3: Modify index.js

Modify `server/src/core/llm/index.js`:

```javascript
// server/src/core/llm/index.js

import LLMClient, { createDefaultLLMClient } from './client.js';
import LLMConfig, { llmConfig } from './config.js';
import modelInfoService from './modelInfoService.js';

export {
  LLMClient,
  createDefaultLLMClient,
  LLMConfig,
  llmConfig,
  modelInfoService
};

export default LLMClient;
```

### Step 4: Run test to verify it passes

Run:
```bash
cd server && npm run test:unit -- tests/unit/llm/modelInfoService.test.js
```

Expected: PASS

### Step 5: Commit

```bash
git add server/src/core/llm/index.js server/tests/unit/llm/modelInfoService.test.js
git commit -m "feat(llm): export modelInfoService from index

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Update tokenMonitor to use dynamic context limits

**Files:**
- Modify: `server/src/modules/chat/nodes/tokenMonitor.js`
- Modify: `server/tests/unit/chat/tokenMonitor.test.js`

### Step 1: Update the test

Modify `server/tests/unit/chat/tokenMonitor.test.js` to mock modelInfoService:

Add at the top of the file:

```javascript
import { vi } from 'vitest';

// Mock modelInfoService before importing tokenMonitor
vi.mock('../../../src/core/llm/modelInfoService.js', () => ({
  default: {
    getContextLimit: vi.fn()
  }
}));

import modelInfoService from '../../../src/core/llm/modelInfoService.js';
```

Update existing test that expects hardcoded limits:

```javascript
describe('tokenMonitorNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock return value
    modelInfoService.getContextLimit.mockResolvedValue(65536);
  });

  // ... existing tests ...

  it('should use dynamic context limit from modelInfoService', async () => {
    modelInfoService.getContextLimit.mockResolvedValueOnce(131072);

    const state = {
      metadata: { modelUsed: 'ziwei-8b' },
      systemPrompt: 'Test prompt',
      messages: [],
      currentInput: 'Hello'
    };

    const result = await tokenMonitorNode(state);

    expect(modelInfoService.getContextLimit).toHaveBeenCalledWith('ziwei-8b');
    expect(result.tokenInfo.contextLimit).toBe(131072);
  });

  it('should fallback to default when modelInfoService fails', async () => {
    modelInfoService.getContextLimit.mockRejectedValueOnce(new Error('API error'));

    const state = {
      metadata: { modelUsed: 'unknown-model' },
      systemPrompt: 'Test',
      messages: [],
      currentInput: 'Hi'
    };

    const result = await tokenMonitorNode(state);

    // modelInfoService returns default 65536 on error
    expect(result.tokenInfo.contextLimit).toBe(65536);
  });
});
```

### Step 2: Run test to verify it fails

Run:
```bash
cd server && npm run test:unit -- tests/unit/chat/tokenMonitor.test.js
```

Expected: Some tests FAIL due to missing mock or implementation

### Step 3: Modify tokenMonitor.js

Modify `server/src/modules/chat/nodes/tokenMonitor.js`:

Replace the hardcoded MODEL_LIMITS and update the logic:

```javascript
/**
 * Token Monitor Node
 * Monitors token usage and triggers warnings/termination when approaching context limits
 *
 * @author AFS Team
 * @version 2.1.0 - Dynamic context limits
 */

import logger from '../../../core/utils/logger.js';
import modelInfoService from '../../../core/llm/modelInfoService.js';

const tokenLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'TOKEN_MONITOR' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'TOKEN_MONITOR' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'TOKEN_MONITOR' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'TOKEN_MONITOR' }),
};

// Thresholds for token-based prompts (fixed percentages)
const THRESHOLDS = {
  fatiguePrompt: 0.6,    // 60% - show fatigue dialog with user choice
  forceOffline: 0.7      // 70% - force offline and trigger indexing
};

// Response buffer for LLM generation
const RESPONSE_BUFFER = 1000;

/**
 * Token Monitor Node
 * Calculates token usage and determines if conversation should be warned or terminated
 *
 * @param {Object} state - Current conversation state
 * @returns {Promise<Object>} Updated state with tokenInfo
 */
export async function tokenMonitorNode(state) {
  try {
    tokenLogger.info('[TokenMonitor] Starting token monitoring');

    const modelUsed = state.metadata?.modelUsed || 'deepseek-r1:14b';

    // Get context limit dynamically from modelInfoService
    const contextLimit = await modelInfoService.getContextLimit(modelUsed);

    // Calculate token usage
    const tokenUsage = calculateConversationTokens(state);
    const totalTokens = tokenUsage.total + RESPONSE_BUFFER;
    const usageRatio = totalTokens / contextLimit;

    tokenLogger.info('[TokenMonitor] Token usage calculated', {
      systemPrompt: tokenUsage.systemPrompt,
      messages: tokenUsage.messages,
      memories: tokenUsage.memories,
      currentInput: tokenUsage.currentInput,
      total: tokenUsage.total,
      withBuffer: totalTokens,
      contextLimit,
      usageRatio: (usageRatio * 100).toFixed(1) + '%'
    });

    // Determine action based on thresholds
    let action = 'continue';

    if (usageRatio >= THRESHOLDS.forceOffline) {
      // 70% - Force offline: trigger memory save and indexing
      action = 'force_offline';
      tokenLogger.warn('[TokenMonitor] Token usage at 70% - forcing offline for indexing', {
        usageRatio: (usageRatio * 100).toFixed(1) + '%'
      });
    } else if (usageRatio >= THRESHOLDS.fatiguePrompt) {
      // 60% - Show fatigue dialog with user choice
      // Only show if user hasn't already chosen to continue
      if (!state.metadata?.userChoseToContinue) {
        action = 'fatigue_prompt';
        tokenLogger.info('[TokenMonitor] Token usage at 60% - triggering fatigue dialog', {
          usageRatio: (usageRatio * 100).toFixed(1) + '%'
        });
      } else {
        // User chose to continue, keep conversation going until 70%
        action = 'continue_after_fatigue';
        tokenLogger.info('[TokenMonitor] User chose to continue after fatigue prompt', {
          usageRatio: (usageRatio * 100).toFixed(1) + '%'
        });
      }
    }

    // Store token info in state
    const tokenInfo = {
      modelUsed,
      contextLimit,
      usage: {
        systemPrompt: tokenUsage.systemPrompt,
        messages: tokenUsage.messages,
        memories: tokenUsage.memories,
        currentInput: tokenUsage.currentInput,
        responseBuffer: RESPONSE_BUFFER,
        total: totalTokens
      },
      usageRatio,
      action,
      checkedAt: new Date().toISOString()
    };

    state.tokenInfo = tokenInfo;

    // Update metadata with token info and action-specific flags
    const metadataUpdates = {
      tokenInfo: {
        usageRatio: Math.round(usageRatio * 100),
        action
      }
    };

    // Set action-specific metadata flags
    if (action === 'fatigue_prompt') {
      metadataUpdates.showFatiguePrompt = true;
      metadataUpdates.fatiguePromptType = 'soft';
      metadataUpdates.usagePercent = Math.round(usageRatio * 100);
    } else if (action === 'force_offline') {
      metadataUpdates.forceOffline = true;
      metadataUpdates.needMemoryUpdate = true;
      metadataUpdates.sessionStatus = 'indexing';
      metadataUpdates.usagePercent = Math.round(usageRatio * 100);
    }

    state.metadata = {
      ...state.metadata,
      ...metadataUpdates
    };

    return state;

  } catch (error) {
    tokenLogger.error('[TokenMonitor] Error during token monitoring', {
      error: error.message,
      stack: error.stack
    });

    // On error, allow conversation to continue
    state.tokenInfo = {
      action: 'continue',
      error: error.message
    };

    return state;
  }
}

/**
 * Calculate token usage for all conversation components
 * @param {Object} state - Conversation state
 * @returns {Object} Token counts by component
 */
function calculateConversationTokens(state) {
  const counts = {
    systemPrompt: 0,
    messages: 0,
    memories: 0,
    currentInput: 0,
    total: 0
  };

  // System prompt tokens
  if (state.systemPrompt) {
    counts.systemPrompt = estimateTokens(state.systemPrompt);
  }

  // Message history tokens
  if (state.messages && Array.isArray(state.messages)) {
    for (const msg of state.messages) {
      if (msg.content) {
        counts.messages += estimateTokens(msg.content);
      }
    }
  }

  // Retrieved memories tokens
  if (state.retrievedMemories && Array.isArray(state.retrievedMemories)) {
    for (const memory of state.retrievedMemories) {
      // Memory could be string or object with content
      const content = typeof memory === 'string'
        ? memory
        : (memory.content || memory.summary || JSON.stringify(memory));
      counts.memories += estimateTokens(content);
    }
  }

  // Current input tokens
  if (state.currentInput) {
    counts.currentInput = estimateTokens(state.currentInput);
  }

  // Calculate total
  counts.total = counts.systemPrompt + counts.messages + counts.memories + counts.currentInput;

  return counts;
}

/**
 * Estimate token count for text
 * Uses character-based estimation:
 * - Chinese characters: ~1.5 tokens each
 * - English/ASCII: ~0.25 tokens per character (4 chars per token)
 *
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
export function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;

  let tokenCount = 0;

  for (const char of text) {
    const code = char.charCodeAt(0);

    if (code >= 0x4E00 && code <= 0x9FFF) {
      // CJK Unified Ideographs (Chinese characters)
      tokenCount += 1.5;
    } else if (code >= 0x3400 && code <= 0x4DBF) {
      // CJK Extension A
      tokenCount += 1.5;
    } else if (code >= 0x20000 && code <= 0x2A6DF) {
      // CJK Extension B
      tokenCount += 1.5;
    } else if (code >= 0x3000 && code <= 0x303F) {
      // CJK Symbols and Punctuation
      tokenCount += 1.0;
    } else if (code < 128) {
      // ASCII characters
      tokenCount += 0.25;
    } else {
      // Other Unicode (punctuation, symbols, etc.)
      tokenCount += 0.5;
    }
  }

  return Math.ceil(tokenCount);
}

/**
 * Get current thresholds
 * @returns {Object} Threshold configuration
 */
export function getThresholds() {
  return { ...THRESHOLDS };
}

export default tokenMonitorNode;
```

### Step 4: Run test to verify it passes

Run:
```bash
cd server && npm run test:unit -- tests/unit/chat/tokenMonitor.test.js
```

Expected: PASS

### Step 5: Run syntax check

Run:
```bash
cd server && node --check src/modules/chat/nodes/tokenMonitor.js
```

Expected: No output (success)

### Step 6: Commit

```bash
git add server/src/modules/chat/nodes/tokenMonitor.js server/tests/unit/chat/tokenMonitor.test.js
git commit -m "refactor(tokenMonitor): use dynamic context limits from modelInfoService

- Remove hardcoded MODEL_LIMITS constant
- Fetch context limit dynamically via modelInfoService
- Keep fixed 60%/70% threshold percentages
- Add comprehensive test mocks

BREAKING CHANGE: context limits now fetched from Ollama API

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Integration verification

**Files:**
- Verify: `server/src/modules/chat/orchestrator.js` (no changes needed)

### Step 1: Run all chat-related unit tests

Run:
```bash
cd server && npm run test:unit -- tests/unit/chat/
```

Expected: All tests PASS

### Step 2: Run full test suite

Run:
```bash
cd server && npm run test:unit
```

Expected: All tests PASS

### Step 3: Manual verification (optional)

Start the server and verify logs show dynamic context limits:

```bash
cd server && npm run dev
```

Check logs for messages like:
```
[MODEL_INFO_SERVICE] Fetched context limit for deepseek-r1:14b: 65536
[MODEL_INFO_SERVICE] Cache hit for model: deepseek-r1:14b
```

### Step 4: Final commit

```bash
git add -A
git status
git commit -m "feat: complete dynamic model context length implementation

- OllamaModelInfoService fetches context_length from /api/show
- tokenMonitor uses dynamic limits with fixed 60%/70% thresholds
- Full test coverage with mocks
- Caching for performance

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary

| Task | Files Changed | Key Changes |
|------|--------------|-------------|
| 1 | modelInfoService.js, test | New service for fetching/caching model info |
| 2 | index.js | Export new service |
| 3 | tokenMonitor.js, test | Use dynamic limits instead of hardcoded |
| 4 | - | Integration verification |

## Rollback Plan

If issues arise:
```bash
git revert HEAD~3  # Revert all 3 commits
```

## Success Criteria

- [ ] OllamaModelInfoService fetches context_length from Ollama API
- [ ] Cache working (no repeated API calls for same model)
- [ ] Fallback to 65536 when API unavailable
- [ ] All existing tests pass
- [ ] New unit tests for modelInfoService pass
- [ ] tokenMonitor tests pass with new mocks
