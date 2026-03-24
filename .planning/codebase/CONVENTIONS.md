# Coding Conventions

**Analysis Date:** 2026-03-24

## Project Overview

This is a monorepo-style codebase with two main subprojects:
- **server/**: Node.js backend with ES Modules (Express + MongoDB + LangGraph)
- **web/**: Next.js 15 frontend with TypeScript and Tailwind CSS

## Naming Patterns

### Files

**Backend (JavaScript):**
- Use camelCase for module files: `intentClassifier.js`, `chartRagRetriever.js`
- Use PascalCase for class/model files: `User.js`, `ChatSession.js`
- Test files: `*.test.js` pattern
- Configuration files: `*.config.js` or `*.config.cjs`

**Frontend (TypeScript/React):**
- Use PascalCase for component files: `NodeEditor.tsx`, `PromptEditor.tsx`
- Use camelCase for hook files: `useLangGraph.ts`
- Use camelCase for utility files: `admin-api.ts`
- Type definition files co-located with implementation

### Functions

- Use camelCase for all function names
- Use verb-noun pattern for actions: `getUsers()`, `createQuestion()`, `updateNodeConfig()`
- Boolean functions use `is/has/can/should` prefixes: `isEmotionalIntent()`, `shouldContinue()`
- Async functions do not require special naming suffix

```javascript
// Good
async function getUserById(userId) { ... }
function isSessionIndexing(sessionId) { ... }
function shouldContinue(node) { ... }
```

### Variables

- Use camelCase for variables and properties
- Use UPPER_SNAKE_CASE for constants (rarely used)
- Private class properties use underscore prefix: `_data`

```javascript
const sessionId = 'session_123';
const mockState = { ... };
const LLM_CONFIG = { ... };  // Constants
```

### Types (TypeScript)

- Use PascalCase for interface and type names
- Use descriptive names with clear intent
- Props interfaces use `ComponentNameProps` suffix

```typescript
interface NodeEditorProps {
  node: LangGraphNode;
  models: AvailableModels | null;
  onSave: (updates: UpdatePayload) => void;
  onCancel: () => void;
}

interface LLMConfig {
  source: 'ollama' | 'api';
  model: string;
  temperature: number;
  maxTokens: number;
}
```

## Code Style

### Formatting

**Backend:**
- No project-level formatter configuration detected
- Uses ES Modules (`"type": "module"` in `server/package.json`)
- File extension `.js` required in imports

**Frontend:**
- TypeScript strict mode enabled
- Uses Next.js built-in ESLint configuration (`eslint-config-next`)
- Tailwind CSS for styling with class-variance-authority (CVA) patterns

### Linting

**Backend:**
- No explicit ESLint configuration in project root
- Relies on IDE/editor defaults

**Frontend:**
- ESLint via `eslint-config-next` v15.1.0
- Run with: `npm run lint`

### TypeScript Configuration

**Frontend (`web/tsconfig.json`):**
```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

## Import Organization

### Backend

```javascript
// 1. External packages
import winston from 'winston';
import path from 'path';
import mongoose from 'mongoose';

// 2. Internal modules (using relative paths)
import logger from '../../core/utils/logger.js';
import User from '../user/model.js';
import { PromptAssembler } from '../rolecard/v2/index.js';
```

### Frontend

```typescript
// 1. React/Next.js
import { useState, useCallback } from 'react';
import type { Metadata } from 'next';

// 2. External packages
import { Save, X } from 'lucide-react';

// 3. UI components (using @ alias)
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// 4. Local modules (using @ alias)
import { adminApiRequest } from '@/lib/admin-api';
import type { LangGraphNode } from '../hooks/useLangGraph';
```

### Path Aliases

**Backend:**
- Configured in Vitest: `@` -> `./src`
- Imports use relative paths in source code

**Frontend:**
- Configured in `tsconfig.json`: `@/*` -> `./*`
- Used throughout: `@/components/ui/button`, `@/lib/admin-api`

## Error Handling

### Patterns

**Backend Controller Pattern:**
```javascript
async getUsers(req, res) {
  try {
    const result = await adminService.getUsers({ page, limit, search, role, isActive });
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[AdminController] getUsers error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

**Service Layer Pattern:**
```javascript
async getUserById(userId) {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new Error('User not found');
  }
  return user;
}
```

**Frontend Hook Pattern:**
```typescript
try {
  const result = await adminApiRequest<ResponseType>('/api/endpoint');
  if (result.success) {
    setData(result.data);
  }
} catch (err) {
  setError(err instanceof Error ? err.message : 'Operation failed');
} finally {
  setIsLoading(false);
}
```

### Response Format

All API responses follow this pattern:
```javascript
// Success
{
  success: true,
  data: { ... },
  // Additional fields as needed
}

// Error
{
  success: false,
  error: 'Error message'
}
```

## Logging

### Framework

**Backend:** Winston logger (`server/src/core/utils/logger.js`)

**Log Levels:**
- `info`: Standard operations
- `error`: Errors and exceptions
- `warn`: Warnings and edge cases
- `debug`: Development debugging

### Usage Patterns

```javascript
import logger from '../../core/utils/logger.js';

// Standard logging
logger.info('[ModuleName] Operation completed', { userId, duration });

// Error logging
logger.error('[ModuleName] Operation failed:', error);

// Module-specific loggers
import { apiLogger, authLogger, dbLogger } from '../../core/utils/logger.js';
apiLogger.info(`${req.method} ${req.originalUrl}`, { requestId, userId });
```

### Log Format

```
[timestamp] [level] [module] [requestId] [User:userId] message
```

**Log Files:**
- `logs/combined.log` - All info and above
- `logs/error.log` - Errors only
- `logs/debug.log` - Debug level

## Comments

### JSDoc/TSDoc

Used for module-level documentation and public APIs:

```javascript
/**
 * Admin Controller
 * Handles admin API requests
 *
 * @author AFS Team
 * @version 1.0.0
 */

/**
 * Get users with pagination and filters
 * @param {string} page - Page number
 * @param {string} limit - Items per page
 * @returns {Promise<Object>} Paginated user list
 */
async getUsers(req, res) { ... }
```

### Inline Comments

Used sparingly for complex logic explanations:

```javascript
// Verify roleCard actually exists in file system (not just in MongoDB)
const actualRoleCard = await dualStorage.loadRoleCardV2(userId);
```

### Section Comments

Use comment blocks to organize code sections:

```javascript
// ==================== Indexing Wait Mechanism ====================

// ======== Memory Deletion ========

// ======== Recycle Bin ========
```

## Function Design

### Size

- Keep functions focused on a single responsibility
- Controller methods typically 10-30 lines
- Service methods can be longer but should be decomposable

### Parameters

- Use destructuring for multiple parameters
- Provide default values where appropriate

```javascript
async getUsers({ page = 1, limit = 20, search = '', role = '', isActive = '' }) { ... }

async updateNodeConfig(flowId, nodeId, updates) { ... }
```

### Return Values

- Services return data objects or throw errors
- Controllers format responses consistently
- Async functions always return Promises

```javascript
// Service returns data
return {
  users,
  pagination: { page, limit, total, pages }
};

// Controller wraps in response
res.json({ success: true, ...result });
```

## Module Design

### Exports

**Default export for single class/function:**
```javascript
// logger.js
export default logger;

// service.js
class AdminService { ... }
export default new AdminService();
```

**Named exports for utilities and multiple items:**
```javascript
// index.js
export { PromptAssembler } from './PromptAssembler.js';
export { CalibrationLayer } from './CalibrationLayer.js';

// hooks/useLangGraph.ts
export function useLangGraph() { ... }
export interface LangGraphNode { ... }
```

### Barrel Files

Used for clean imports from subdirectories:
```javascript
// server/src/modules/rolecard/v2/index.js
export { PromptAssembler } from './PromptAssembler.js';
export { CalibrationLayer } from './CalibrationLayer.js';
```

### Class Organization

```javascript
class ClassName {
  // 1. Constructor
  constructor() { ... }

  // 2. Public methods (grouped by feature)
  async publicMethod1() { ... }
  async publicMethod2() { ... }

  // 3. Private methods (if any)
  _privateHelper() { ... }
}
```

---

*Convention analysis: 2026-03-24*
