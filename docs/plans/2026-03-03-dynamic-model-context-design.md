# Dynamic Model Context Length - Design Document

## Overview

Replace hardcoded model context limits with dynamic fetching from Ollama API, enabling accurate token monitoring across different models.

## Problem Statement

Current implementation uses hardcoded `MODEL_LIMITS` in `tokenMonitor.js`:
- Requires code changes when adding new models
- Default value (65536) may be incorrect for unknown models
- Actual model configuration (e.g., `ziwei-8b` uses 4096 in Modelfile but supports 131072) is not reflected

## Solution

Fetch model context length dynamically from Ollama `/api/show` endpoint and cache the results.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Startup / First Use                           │
│                                                                 │
│  OllamaModelInfoService                                         │
│  ├── fetchModelInfo(modelName)                                  │
│  │   └── POST /api/show → extract context_length               │
│  └── Cache to memory (Map<modelName, contextLength>)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    tokenMonitorNode Runtime                      │
│                                                                 │
│  1. Get model name: state.metadata.modelUsed                    │
│  2. Query cache: modelInfoService.getContextLimit(modelName)    │
│  3. If not cached: fetchModelInfo() and cache                   │
│  4. Calculate usage: totalTokens / contextLimit                 │
│  5. Fixed threshold check: 60% / 70%                            │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. OllamaModelInfoService (New)

**File:** `server/src/core/llm/modelInfoService.js`

**Responsibilities:**
- Fetch model info from Ollama `/api/show` endpoint
- Extract `context_length` from `model_info` field
- Cache results in memory
- Provide fallback when API unavailable

**Key Methods:**
```javascript
class OllamaModelInfoService {
  // Get context limit for a model (with caching)
  async getContextLimit(modelName)

  // Force refresh cache for a model
  async refreshContextLimit(modelName)

  // Clear all cache
  clearCache()
}
```

**API Response Parsing:**
```javascript
// From: POST http://localhost:11434/api/show {"model": "ziwei-8b"}
// Extract: model_info["qwen3.context_length"] → 131072
// Fallback chain: model_info.*.context_length → parameters.num_ctx → 65536
```

### 2. tokenMonitor.js (Modified)

**Changes:**
- Remove hardcoded `MODEL_LIMITS` constant
- Import and use `OllamaModelInfoService`
- Replace static lookup with async dynamic fetch

**Before:**
```javascript
const contextLimit = MODEL_LIMITS[modelUsed] || MODEL_LIMITS.default;
```

**After:**
```javascript
const contextLimit = await modelInfoService.getContextLimit(modelUsed);
```

## Error Handling

| Scenario | Fallback |
|----------|----------|
| Ollama service unavailable | 65536 (default) |
| Model not found | 65536 (default) |
| API timeout (5s) | 65536 (default) |
| `context_length` field missing | 65536 (default) |

## Configuration

**Environment Variables:**
- `OLLAMA_BASE_URL` - Ollama server URL (existing)
- `MODEL_INFO_CACHE_TTL` - Cache TTL in ms (default: 3600000 = 1 hour)
- `MODEL_INFO_DEFAULT_LIMIT` - Fallback context limit (default: 65536)

## Thresholds (Unchanged)

```javascript
const THRESHOLDS = {
  fatiguePrompt: 0.6,    // 60% - show fatigue dialog
  forceOffline: 0.7      // 70% - force offline
};
```

Fixed percentage thresholds work well because:
- 32K model at 60% = ~19K tokens (safe margin)
- 128K model at 60% = ~77K tokens (safe margin)
- Same "safety ratio" adapts to different model capacities

## Testing Strategy

1. **Unit Tests:**
   - ModelInfoService context extraction logic
   - Cache hit/miss behavior
   - Fallback handling

2. **Integration Tests:**
   - tokenMonitor with dynamic context limit
   - Error scenarios (Ollama unavailable)

## Migration Notes

- No database migration required
- No breaking API changes
- Backward compatible with existing configuration

## Files Changed

| File | Action |
|------|--------|
| `server/src/core/llm/modelInfoService.js` | Create |
| `server/src/core/llm/index.js` | Modify (export new service) |
| `server/src/modules/chat/nodes/tokenMonitor.js` | Modify (use dynamic limits) |
| `server/tests/unit/llm/modelInfoService.test.js` | Create |
| `server/tests/unit/chat/tokenMonitor.test.js` | Modify |

## Success Criteria

- [ ] Model context limits fetched dynamically from Ollama
- [ ] Cache working (no repeated API calls for same model)
- [ ] Fallback to default when API unavailable
- [ ] All existing tests pass
- [ ] New unit tests for modelInfoService
- [ ] TypeScript compilation passes (if applicable)
