# Backend Modular Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor server/src/ from layer-based structure to feature-based module structure while maintaining all API routes.

**Architecture:** Move files from controllers/, services/, repositories/, models/, routes/ into modules/{module-name}/ directories. Create core/ directory for shared infrastructure (storage, llm, utils). Update all import paths and verify API functionality.

**Tech Stack:** Node.js, Express, ES Modules, Mongoose

---

## Pre-requisites

- All Docker containers running
- API currently functional at http://localhost:3001
- Frontend accessible at http://localhost:3002

---

## Task 1: Create Git Backup Tag

**Files:**
- N/A (Git operation)

**Step 1: Create backup tag**

Run:
```bash
git tag pre-modular-refactor-20260215
```

Expected: Tag created

**Step 2: Verify tag**

Run:
```bash
git tag -l "pre-modular*"
```

Expected: `pre-modular-refactor-20260215`

---

## Task 2: Create New Directory Structure

**Files:**
- Create: `server/src/modules/`
- Create: `server/src/modules/auth/`
- Create: `server/src/modules/user/`
- Create: `server/src/modules/qa/`
- Create: `server/src/modules/qa/services/`
- Create: `server/src/modules/qa/repositories/`
- Create: `server/src/modules/qa/models/`
- Create: `server/src/modules/qa/routes/`
- Create: `server/src/modules/assist/`
- Create: `server/src/modules/chat/`
- Create: `server/src/modules/chat/nodes/`
- Create: `server/src/modules/chat/edges/`
- Create: `server/src/modules/chat/state/`
- Create: `server/src/modules/rolecard/`
- Create: `server/src/modules/rolecard/generators/`
- Create: `server/src/modules/sentiment/`
- Create: `server/src/modules/settings/`
- Create: `server/src/modules/roles/`
- Create: `server/src/modules/roles/models/`
- Create: `server/src/core/`
- Create: `server/src/core/storage/`
- Create: `server/src/core/llm/`
- Create: `server/src/core/llm/prompts/`
- Create: `server/src/core/middleware/`
- Create: `server/src/core/hooks/`
- Create: `server/src/core/utils/`
- Create: `server/src/core/config/`

**Step 1: Create all directories**

Run:
```bash
cd F:/FPY/AFS-System/server/src
mkdir -p modules/auth
mkdir -p modules/user
mkdir -p modules/qa/{services,repositories,models,routes}
mkdir -p modules/assist
mkdir -p modules/chat/{nodes,edges,state}
mkdir -p modules/rolecard/generators
mkdir -p modules/sentiment
mkdir -p modules/settings
mkdir -p modules/roles/models
mkdir -p core/{storage,llm/prompts,middleware,hooks,utils,config}
```

Expected: All directories created

**Step 2: Verify structure**

Run:
```bash
ls -la modules/ core/
```

Expected: All directories visible

---

## Task 3: Move Auth Module Files

**Files:**
- Move: `server/src/controllers/AuthController.js` → `server/src/modules/auth/controller.js`
- Move: `server/src/services/authService.js` → `server/src/modules/auth/service.js`
- Move: `server/src/routes/auth/index.js` → `server/src/modules/auth/route.js`
- Move: `server/src/middleware/auth.js` → `server/src/modules/auth/middleware.js`
- Move: `server/src/middleware/permission.js` → `server/src/core/middleware/permission.js`

**Step 1: Move controller**

Run:
```bash
cd F:/FPY/AFS-System/server/src
mv controllers/AuthController.js modules/auth/controller.js
```

**Step 2: Move service**

Run:
```bash
mv services/authService.js modules/auth/service.js
```

**Step 3: Move route**

Run:
```bash
mv routes/auth/index.js modules/auth/route.js
```

**Step 4: Move middleware**

Run:
```bash
mv middleware/auth.js modules/auth/middleware.js
mv middleware/permission.js core/middleware/permission.js
```

**Step 5: Update imports in auth/controller.js**

Change:
```javascript
import authService from '../services/authService.js';
```
To:
```javascript
import authService from './service.js';
```

**Step 6: Update imports in auth/route.js**

Change:
```javascript
import authController from '../../controllers/AuthController.js';
import assistController from '../../controllers/AssistController.js';
import { protect } from '../../middleware/auth.js';
```
To:
```javascript
import authController from './controller.js';
// assistController will be imported from assist module later
import { protect } from './middleware.js';
```

**Step 7: Update exports in auth/middleware.js**

Add at end:
```javascript
export { protect };
```

**Step 8: Create core/middleware/index.js**

Create file with:
```javascript
export { protect } from './auth/protect.js';
export { requirePermission, requirePermissionMiddleware } from './permission.js';
```

Note: We'll create auth/protect.js symlink or copy later.

---

## Task 4: Move User Module Files

**Files:**
- Move: `server/src/controllers/UserController.js` → `server/src/modules/user/controller.js`
- Move: `server/src/services/userService.js` → `server/src/modules/user/service.js`
- Move: `server/src/repositories/UserRepository.js` → `server/src/modules/user/repository.js`
- Move: `server/src/models/User.js` → `server/src/modules/user/model.js`
- Move: `server/src/routes/users.js` → `server/src/modules/user/route.js`

**Step 1: Move all user files**

Run:
```bash
cd F:/FPY/AFS-System/server/src
mv controllers/UserController.js modules/user/controller.js
mv services/userService.js modules/user/service.js
mv repositories/UserRepository.js modules/user/repository.js
mv models/User.js modules/user/model.js
mv routes/users.js modules/user/route.js
```

**Step 2: Update imports in user/controller.js**

Change imports to use relative paths within module.

**Step 3: Update imports in user/service.js**

Change imports to use relative paths within module.

**Step 4: Update imports in user/repository.js**

Change model import to:
```javascript
import User from './model.js';
```

---

## Task 5: Move Q&A Module Files

**Files:**
- Move: `server/src/controllers/AnswerController.js` → `server/src/modules/qa/controller.js`
- Move: `server/src/services/AnswerService.js` → `server/src/modules/qa/services/answer.js`
- Move: `server/src/services/QuestionService.js` → `server/src/modules/qa/services/question.js`
- Move: `server/src/repositories/AnswerRepository.js` → `server/src/modules/qa/repositories/answer.js`
- Move: `server/src/repositories/QuestionRepository.js` → `server/src/modules/qa/repositories/question.js`
- Move: `server/src/models/Answer.js` → `server/src/modules/qa/models/answer.js`
- Move: `server/src/models/Question.js` → `server/src/modules/qa/models/question.js`
- Move: `server/src/routes/answers.js` → `server/src/modules/qa/routes/answers.js`
- Move: `server/src/routes/questions.js` → `server/src/modules/qa/routes/questions.js`

**Step 1: Move all qa files**

Run:
```bash
cd F:/FPY/AFS-System/server/src
mv controllers/AnswerController.js modules/qa/controller.js
mv services/AnswerService.js modules/qa/services/answer.js
mv services/QuestionService.js modules/qa/services/question.js
mv repositories/AnswerRepository.js modules/qa/repositories/answer.js
mv repositories/QuestionRepository.js modules/qa/repositories/question.js
mv models/Answer.js modules/qa/models/answer.js
mv models/Question.js modules/qa/models/question.js
mv routes/answers.js modules/qa/routes/answers.js
mv routes/questions.js modules/qa/routes/questions.js
```

**Step 2: Update all imports in qa module files**

Update to use relative paths within module.

---

## Task 6: Move Assist Module Files (Independently)

**Files:**
- Move: `server/src/controllers/AssistController.js` → `server/src/modules/assist/controller.js`
- Move: `server/src/services/assistService.js` → `server/src/modules/assist/service.js`
- Move: `server/src/repositories/AssistRelationRepository.js` → `server/src/modules/assist/repository.js`
- Move: `server/src/models/AssistRelation.js` → `server/src/modules/assist/model.js`
- Create: `server/src/modules/assist/route.js` (new independent route)

**Step 1: Move all assist files**

Run:
```bash
cd F:/FPY/AFS-System/server/src
mv controllers/AssistController.js modules/assist/controller.js
mv services/assistService.js modules/assist/service.js
mv repositories/AssistRelationRepository.js modules/assist/repository.js
mv models/AssistRelation.js modules/assist/model.js
```

**Step 2: Create new assist/route.js**

Create with routes extracted from auth module:
```javascript
import express from 'express';
import assistController from './controller.js';
import { protect } from '../auth/middleware.js';

const router = express.Router();

router.get('/search', protect, (req, res) => {
  assistController.searchUser(req, res);
});
router.post('/verify', protect, (req, res) => {
  assistController.createRelation(req, res);
});
router.get('/relations', protect, (req, res) => {
  assistController.getRelations(req, res);
});
router.get('/helpers', protect, (req, res) => {
  assistController.getHelpers(req, res);
});
router.delete('/relations/:relationId', protect, (req, res) => {
  assistController.deleteRelation(req, res);
});
router.get('/check-incomplete', protect, (req, res) => {
  assistController.getIncompleteRelations(req, res);
});
router.post('/batch-update-relations', protect, (req, res) => {
  assistController.batchUpdateRelations(req, res);
});

export default router;
```

**Step 3: Update imports in assist module files**

Update all imports to use relative paths.

---

## Task 7: Move Chat Module Files

**Files:**
- Move: `server/src/controllers/ChatController.js` → `server/src/modules/chat/controller.js`
- Move: `server/src/services/chat/*` → `server/src/modules/chat/*`
- Move: `server/src/models/ChatSession.js` → `server/src/modules/chat/model.js`
- Move: `server/src/routes/chat.js` → `server/src/modules/chat/route.js`

**Step 1: Move all chat files**

Run:
```bash
cd F:/FPY/AFS-System/server/src
mv controllers/ChatController.js modules/chat/controller.js
mv services/chat/* modules/chat/
mv models/ChatSession.js modules/chat/model.js
mv routes/chat.js modules/chat/route.js
rmdir services/chat
```

**Step 2: Update imports in chat module files**

Update all imports to use new paths:
- `../../utils/logger.js` → `../../core/utils/logger.js`
- `../../models/ChatSession.js` → `./model.js`

---

## Task 8: Move RoleCard Module Files

**Files:**
- Move: `server/src/controllers/RoleCardController.js` → `server/src/modules/rolecard/controller.js`
- Move: `server/src/services/langchain/roleCardGenerator.js` → `server/src/modules/rolecard/generators/generatorA.js`
- Move: `server/src/services/langchain/roleCardGeneratorB.js` → `server/src/modules/rolecard/generators/generatorB.js`
- Move: `server/src/services/langchain/assistantsGuidelinesPreprocessor.js` → `server/src/modules/rolecard/preprocessor.js`
- Move: `server/src/config/roleCardConfig.js` → `server/src/modules/rolecard/config.js`
- Move: `server/src/routes/rolecard.js` → `server/src/modules/rolecard/route.js`

**Step 1: Move all rolecard files**

Run:
```bash
cd F:/FPY/AFS-System/server/src
mv controllers/RoleCardController.js modules/rolecard/controller.js
mv services/langchain/roleCardGenerator.js modules/rolecard/generators/generatorA.js
mv services/langchain/roleCardGeneratorB.js modules/rolecard/generators/generatorB.js
mv services/langchain/assistantsGuidelinesPreprocessor.js modules/rolecard/preprocessor.js
mv config/roleCardConfig.js modules/rolecard/config.js
mv routes/rolecard.js modules/rolecard/route.js
```

**Step 2: Update imports in rolecard module files**

Update all imports to use new relative paths.

---

## Task 9: Move Sentiment Module Files

**Files:**
- Move: `server/src/controllers/SentimentController.js` → `server/src/modules/sentiment/controller.js`
- Move: `server/src/services/langchain/sentimentManager.js` → `server/src/modules/sentiment/manager.js`
- Move: `server/src/routes/sentiment.js` → `server/src/modules/sentiment/route.js`

**Step 1: Move all sentiment files**

Run:
```bash
cd F:/FPY/AFS-System/server/src
mv controllers/SentimentController.js modules/sentiment/controller.js
mv services/langchain/sentimentManager.js modules/sentiment/manager.js
mv routes/sentiment.js modules/sentiment/route.js
```

**Step 2: Update imports in sentiment module files**

Update all imports to use new relative paths.

---

## Task 10: Move Settings Module Files

**Files:**
- Move: `server/src/controllers/SettingsController.js` → `server/src/modules/settings/controller.js`
- Move: `server/src/services/settingsService.js` → `server/src/modules/settings/service.js`
- Move: `server/src/routes/settings.js` → `server/src/modules/settings/route.js`

**Step 1: Move all settings files**

Run:
```bash
cd F:/FPY/AFS-System/server/src
mv controllers/SettingsController.js modules/settings/controller.js
mv services/settingsService.js modules/settings/service.js
mv routes/settings.js modules/settings/route.js
```

**Step 2: Update imports in settings module files**

Update all imports.

---

## Task 11: Move Roles Module Files

**Files:**
- Move: `server/src/controllers/RoleController.js` → `server/src/modules/roles/controller.js`
- Move: `server/src/services/roleService.js` → `server/src/modules/roles/service.js`
- Move: `server/src/models/Role.js` → `server/src/modules/roles/models/role.js`
- Move: `server/src/models/Permission.js` → `server/src/modules/roles/models/permission.js`
- Move: `server/src/routes/roles.js` → `server/src/modules/roles/route.js`

**Step 1: Move all roles files**

Run:
```bash
cd F:/FPY/AFS-System/server/src
mv controllers/RoleController.js modules/roles/controller.js
mv services/roleService.js modules/roles/service.js
mv models/Role.js modules/roles/models/role.js
mv models/Permission.js modules/roles/models/permission.js
mv routes/roles.js modules/roles/route.js
```

**Step 2: Update imports in roles module files**

Update all imports.

---

## Task 12: Move Core Storage Files

**Files:**
- Move: `server/src/services/dualStorage.js` → `server/src/core/storage/dual.js`
- Move: `server/src/services/fileStorage.js` → `server/src/core/storage/file.js`
- Move: `server/src/services/storageService.js` → `server/src/core/storage/service.js`
- Move: `server/src/services/vectorIndexService.js` → `server/src/core/storage/vector.js`
- Move: `server/src/services/EmbeddingService.js` → `server/src/core/storage/embedding.js`
- Move: `server/src/services/simpleSyncQueue.js` → `server/src/core/storage/syncQueue.js`
- Move: `server/src/utils/rolecardStorage.js` → `server/src/core/storage/rolecard.js`

**Step 1: Move all storage files**

Run:
```bash
cd F:/FPY/AFS-System/server/src
mv services/dualStorage.js core/storage/dual.js
mv services/fileStorage.js core/storage/file.js
mv services/storageService.js core/storage/service.js
mv services/vectorIndexService.js core/storage/vector.js
mv services/EmbeddingService.js core/storage/embedding.js
mv services/simpleSyncQueue.js core/storage/syncQueue.js
mv utils/rolecardStorage.js core/storage/rolecard.js
```

**Step 2: Create core/storage/index.js**

```javascript
export { default as dualStorage } from './dual.js';
export { default as fileStorage } from './file.js';
export { default as storageService } from './service.js';
export { default as vectorIndexService } from './vector.js';
export { default as embeddingService } from './embedding.js';
export { default as simpleSyncQueue } from './syncQueue.js';
export { default as rolecardStorage } from './rolecard.js';
```

---

## Task 13: Move Core LLM Files

**Files:**
- Move: `server/src/utils/llmClient.js` → `server/src/core/llm/client.js`
- Move: `server/src/services/langchain/llmConfig.js` → `server/src/core/llm/config.js`
- Move: `server/src/services/langchain/multiLLMClient.js` → `server/src/core/llm/multi.js`
- Move: `server/src/services/langchain/prompts/*` → `server/src/core/llm/prompts/`

**Step 1: Move all llm files**

Run:
```bash
cd F:/FPY/AFS-System/server/src
mv utils/llmClient.js core/llm/client.js
mv services/langchain/llmConfig.js core/llm/config.js
mv services/langchain/multiLLMClient.js core/llm/multi.js
mv services/langchain/prompts/* core/llm/prompts/
```

**Step 2: Create core/llm/index.js**

```javascript
export { default as LLMClient, createDefaultLLMClient, createSentimentLLMClient } from './client.js';
export { default as llmConfig } from './config.js';
export { default as multiLLMClient } from './multi.js';
```

---

## Task 14: Move Core Utils and Hooks

**Files:**
- Move: `server/src/utils/logger.js` → `server/src/core/utils/logger.js`
- Move: `server/src/utils/response.js` → `server/src/core/utils/response.js`
- Move: `server/src/utils/ProgressTracker.js` → `server/src/core/utils/progress.js`
- Move: `server/src/utils/simpleFileLock.js` → `server/src/core/utils/lock.js`
- Move: `server/src/utils/tokenCounter.js` → `server/src/core/utils/tokens.js`
- Move: `server/src/services/autoHookRegistry.js` → `server/src/core/hooks/registry.js`

**Step 1: Move all utility files**

Run:
```bash
cd F:/FPY/AFS-System/server/src
mv utils/logger.js core/utils/logger.js
mv utils/response.js core/utils/response.js
mv utils/ProgressTracker.js core/utils/progress.js
mv utils/simpleFileLock.js core/utils/lock.js
mv utils/tokenCounter.js core/utils/tokens.js
mv services/autoHookRegistry.js core/hooks/registry.js
```

**Step 2: Create core/utils/index.js**

```javascript
export { default as logger } from './logger.js';
export { default as response } from './response.js';
export { ProgressTracker } from './progress.js';
export { acquireLock, releaseLock } from './lock.js';
export { default as tokenCounter } from './tokens.js';
```

---

## Task 15: Update server.js Entry Point

**Files:**
- Modify: `server/src/server.js`

**Step 1: Update all imports in server.js**

Change from:
```javascript
import authRouter from './routes/auth/index.js';
import answersRouter from './routes/answers.js';
import usersRouter from './routes/users.js';
import rolesRouter from './routes/roles.js';
import settingsRouter from './routes/settings.js';
import questionsRouter from './routes/questions.js';
import chatRouter from './routes/chat.js';
import rolecardRouter from './routes/rolecard.js';
import sentimentRouter from './routes/sentiment.js';
import { protect } from './middleware/auth.js';
import AutoHookRegistry from './services/autoHookRegistry.js';
import SimpleSyncQueue from './services/simpleSyncQueue.js';
import dualStorage from './services/dualStorage.js';
```

To:
```javascript
import authRouter from './modules/auth/route.js';
import assistRouter from './modules/assist/route.js';
import usersRouter from './modules/user/route.js';
import rolesRouter from './modules/roles/route.js';
import settingsRouter from './modules/settings/route.js';
import answersRouter from './modules/qa/routes/answers.js';
import questionsRouter from './modules/qa/routes/questions.js';
import chatRouter from './modules/chat/route.js';
import rolecardRouter from './modules/rolecard/route.js';
import sentimentRouter from './modules/sentiment/route.js';
import { protect } from './modules/auth/middleware.js';
import AutoHookRegistry from './core/hooks/registry.js';
import SimpleSyncQueue from './core/storage/syncQueue.js';
import dualStorage from './core/storage/dual.js';
```

**Step 2: Add assist router registration**

Add after auth router:
```javascript
app.use('/api/auth', authRouter);
app.use('/api/assist', protect, assistRouter);  // NEW: Independent assist routes
```

**Step 3: Remove assist routes from auth module's route.js**

Remove the assist-related routes from `modules/auth/route.js` (they now have their own module).

---

## Task 16: Update All Cross-Module Imports

**Files:**
- All module files that import from other modules or core

**Step 1: Create a script to find and update imports**

Run to find files needing import updates:
```bash
cd F:/FPY/AFS-System/server/src
grep -r "from '\.\./\.\./" modules/ --include="*.js" | head -50
```

**Step 2: Update imports systematically**

For each module, update imports:

**Pattern for core imports:**
- `../utils/logger.js` → `../../core/utils/logger.js`
- `../services/dualStorage.js` → `../../core/storage/dual.js`
- `../models/User.js` → `../user/model.js` (cross-module)

**Pattern for cross-module imports:**
- `../../models/User.js` → `../../modules/user/model.js`
- `../../models/Answer.js` → `../../modules/qa/models/answer.js`

---

## Task 17: Clean Up Empty Directories

**Files:**
- Delete: `server/src/controllers/` (if empty)
- Delete: `server/src/services/` (if empty)
- Delete: `server/src/repositories/` (if empty)
- Delete: `server/src/models/` (if empty)
- Delete: `server/src/routes/` (if empty)
- Delete: `server/src/middleware/` (if empty)
- Delete: `server/src/config/` (if empty)
- Delete: `server/src/utils/` (if empty)

**Step 1: Remove empty directories**

Run:
```bash
cd F:/FPY/AFS-System/server/src
rmdir controllers services repositories models routes middleware config utils 2>/dev/null || echo "Some directories not empty"
rmdir services/langchain services/langchain/prompts 2>/dev/null || echo "Langchain dirs cleaned"
```

---

## Task 18: Rebuild Docker and Test

**Files:**
- N/A

**Step 1: Rebuild server container**

Run:
```bash
cd F:/FPY/AFS-System
docker compose build server
docker compose up -d server
```

**Step 2: Check server logs for errors**

Run:
```bash
docker compose logs server --tail 50
```

Expected: No import errors, server starts successfully

**Step 3: Test health endpoint**

Run:
```bash
curl http://localhost:3001/api/health
```

Expected: `{"status":"ok",...}`

---

## Task 19: Test All API Endpoints

**Files:**
- N/A

**Step 1: Test auth endpoints**

Run:
```bash
curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test"}'
```

Expected: Response with token or error (not 404/500)

**Step 2: Test users endpoint (requires token)**

Run with valid token:
```bash
curl http://localhost:3001/api/users -H "Authorization: Bearer YOUR_TOKEN"
```

Expected: User list or auth error (not 404)

**Step 3: Test frontend access**

Open browser: http://localhost:3002

Expected: Frontend loads, login works

**Step 4: Test full user flow**

1. Login on frontend
2. Navigate to questions page
3. Check dashboard
4. Verify no console errors

---

## Task 20: Commit Changes

**Files:**
- All modified files

**Step 1: Stage all changes**

Run:
```bash
cd F:/FPY/AFS-System
git add server/src/
```

**Step 2: Commit**

Run:
```bash
git commit -m "refactor: modularize backend source code structure

- Move from layer-based (controllers/services/models/routes) to feature-based modules
- Create modules/: auth, user, qa, assist, chat, rolecard, sentiment, settings, roles
- Create core/: storage, llm, middleware, hooks, utils
- Assist module now independent with /api/assist routes
- Update all import paths to new structure
- All API endpoints remain unchanged and functional"
```

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| 1 | Create backup tag | ⬜ |
| 2 | Create directory structure | ⬜ |
| 3 | Move auth module | ⬜ |
| 4 | Move user module | ⬜ |
| 5 | Move qa module | ⬜ |
| 6 | Move assist module (independent) | ⬜ |
| 7 | Move chat module | ⬜ |
| 8 | Move rolecard module | ⬜ |
| 9 | Move sentiment module | ⬜ |
| 10 | Move settings module | ⬜ |
| 11 | Move roles module | ⬜ |
| 12 | Move core storage | ⬜ |
| 13 | Move core llm | ⬜ |
| 14 | Move core utils/hooks | ⬜ |
| 15 | Update server.js | ⬜ |
| 16 | Update cross-module imports | ⬜ |
| 17 | Clean up empty dirs | ⬜ |
| 18 | Rebuild and test Docker | ⬜ |
| 19 | Test all API endpoints | ⬜ |
| 20 | Commit changes | ⬜ |

---

## Rollback

If issues occur:
```bash
git checkout pre-modular-refactor-20260215
docker compose build server
docker compose up -d server
```
