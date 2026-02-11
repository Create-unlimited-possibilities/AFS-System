# LangGraph Dual Mode Support - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable LangGraph to support both Method A (dynamic rolecard) and Method B (static systemPrompt from local files), ensuring Method B's markdown rolecard is correctly integrated.

**Architecture:** Add `roleCardMode` parameter to distinguish modes; key nodes (roleCardAssemble, sentimentAnalyzer, relationConfirm) execute different logic based on mode; Method B loads systemPrompt from local file storage while Method A preserves existing functionality.

**Tech Stack:** Node.js (ES6), Mongoose, LangGraph (custom implementation), fs-extra

---

## Overview

This plan modifies the LangGraph conversation system to support two rolecard generation methods:

- **Method A (dynamic)**: Uses DynamicRoleCardAssembler to generate rolecard on each message, supports family/friend/stranger relationships, includes sentiment analysis.
- **Method B (static)**: Uses pre-generated systemPrompt from local file storage (`server/storage/rolecards/`), only supports family/friend relationships, sentiment analysis is skipped.

### Key Changes

| Component | Method A (dynamic) | Method B (static) |
|-----------|-------------------|-------------------|
| Rolecard Source | DynamicRoleCardAssembler | Local file (`rolecard_latest.json`) |
| Relationships | family/friend/stranger | family/friend only |
| Sentiment Analysis | Yes | No (empty operation) |
| RAG Retrieval | Yes | Yes |
| Format | text | markdown (as text) |

---

## Task 1: Create RolecardStorage Utility

**Files:**
- Create: `server/src/utils/rolecardStorage.js`

**Context:** This utility manages method B rolecards stored in local file system (`server/storage/rolecards/{userId}/`). It provides methods to save, load, and list rolecard versions. File already exists from earlier work - verify and test.

**Step 1: Verify rolecardStorage.js exists and is correct**

Read: `server/src/utils/rolecardStorage.js`

Expected: File exists with RolecardStorage class containing methods:
- `saveRolecard(userId, systemPrompt, metadata)`
- `getLatestRolecard(userId)`
- `getRolecardByVersion(userId, version)`
- `listVersions(userId)`

**Step 2: Test loading example rolecard**

Run: `node -e "import RolecardStorage from './server/src/utils/rolecardStorage.js'; const rs = new RolecardStorage(); rs.getLatestRolecard('698abdf152e5e295fe72c0a0').then(r => console.log('Loaded:', r.version, 'Length:', r.systemPrompt.length))"`

Expected: `Loaded: 1 Length: 1918`

**Step 3: Verify rolecard file structure**

Read: `server/storage/rolecards/698abdf152e5e295fe72c0a0/rolecard_latest.json`

Expected: Valid JSON with fields:
```json
{
  "version": 1,
  "userId": "698abdf152e5e295fe72c0a0",
  "systemPrompt": "# LLM角色扮演卡...",
  "metadata": { ... }
}
```

**Step 4: Verify .gitignore excludes rolecards**

Run: `grep -q "server/storage/rolecards" .gitignore && echo "✅ rolecards ignored" || echo "❌ Add to .gitignore"`

Expected: `✅ rolecards ignored`

If not, add to `.gitignore`:
```
# Rolecard files (Method B)
server/storage/rolecards/
```

---

## Task 2: Update ChatSession Model

**Files:**
- Modify: `server/src/models/ChatSession.js`

**Context:** Add fields to track rolecard mode and static systemPrompt (method B only). The schema stores session metadata for both modes.

**Step 1: Add roleCardMode and systemPrompt fields**

Insert after line 39 (after `specificRelation: String`):

```javascript
// 角色卡模式：dynamic | static
roleCardMode: {
  type: String,
  enum: ['dynamic', 'static'],
  default: 'dynamic'
},

// 静态角色卡（仅static模式）
systemPrompt: String,
```

**Step 2: Update schema indexes (optional)**

Add composite index for roleCardMode queries (after line 99):

```javascript
chatSessionSchema.index({ targetUserId: 1, roleCardMode: 1, isActive: 1 });
```

**Step 3: Test model compilation**

Run: `cd server && node -e "import('./src/models/ChatSession.js').then(() => console.log('✅ Model compiled'))"`

Expected: `✅ Model compiled`

**Step 4: Commit**

```bash
git add server/src/models/ChatSession.js
git commit -m "feat: add roleCardMode and systemPrompt fields to ChatSession"
```

---

## Task 3: Update ConversationState Class

**Files:**
- Modify: `server/src/services/chat/state/ConversationState.js`

**Context:** Add fields to ConversationState to pass roleCardMode and systemPrompt through LangGraph nodes.

**Step 1: Add roleCardMode and systemPrompt to constructor**

Insert after line 31 (after `communicationStyle: ''`):

```javascript
this.systemPrompt = initialData.systemPrompt || '';
this.roleCardMode = initialData.roleCardMode || 'dynamic';
```

**Step 2: Update getState method**

Add new fields to state object (after line 52, add before `currentInput`):

```javascript
systemPrompt: this.systemPrompt,
roleCardMode: this.roleCardMode,
```

**Step 3: Test ConversationState instantiation**

Run: `node -e "import ConversationState from './server/src/services/chat/state/ConversationState.js'; const state = new ConversationState({ roleCardMode: 'static', systemPrompt: 'test' }); console.log('Created:', state.getState().roleCardMode)"`

Expected: `Created: static`

**Step 4: Commit**

```bash
git add server/src/services/chat/state/ConversationState.js
git commit -m "feat: add roleCardMode and systemPrompt to ConversationState"
```

---

## Task 4: Modify roleCardAssemble Node for Dual Mode

**Files:**
- Modify: `server/src/services/chat/nodes/roleCardAssemble.js`

**Context:** This node now checks `roleCardMode` to decide whether to use DynamicRoleCardAssembler (method A) or load from RolecardStorage (method B).

**Step 1: Add roleCardMode branch logic**

Replace entire node function (lines 17-46) with:

```javascript
export async function roleCardAssembleNode(state) {
  try {
    logger.info('[RoleCardAssemble] 组装角色卡');

    const { roleCardMode, userId, interlocutor, sessionId, systemPrompt: providedSystemPrompt } = state;

    if (roleCardMode === 'dynamic') {
      logger.info('[RoleCardAssemble] 方法A：使用DynamicRoleCardAssembler');
      
      const assembler = new DynamicRoleCardAssembler();
      const dynamicRoleCard = await assembler.assembleDynamicRoleCard({
        targetUserId: userId,
        interlocutorUserId: interlocutor.id,
        sessionId: sessionId,
        assistantId: interlocutor.specificId
      });

      state.roleCard = dynamicRoleCard.personaProfile;
      state.systemPrompt = dynamicRoleCard.systemPrompt;
      state.conversationGuidelines = dynamicRoleCard.conversationGuidelines;
      state.sentimentGuidelines = dynamicRoleCard.sentimentGuidelines;
      
      logger.info('[RoleCardAssemble] 动态角色卡组装完成');
    } else if (roleCardMode === 'static') {
      logger.info('[RoleCardAssemble] 方法B：使用静态systemPrompt');
      
      if (providedSystemPrompt) {
        state.systemPrompt = providedSystemPrompt;
        logger.info('[RoleCardAssemble] 使用已加载的systemPrompt');
      } else {
        logger.warn('[RoleCardAssemble] 未提供systemPrompt');
      }
    } else {
      throw new Error(`未知的roleCardMode: ${roleCardMode}`);
    }

    return state;
  } catch (error) {
    logger.error('[RoleCardAssemble] 处理失败:', error);
    state.addError(error);
    return state;
  }
}
```

**Step 2: Verify imports are correct**

Check that DynamicRoleCardAssembler is imported (line 9):

```javascript
import DynamicRoleCardAssembler from '../DynamicRoleCardAssembler.js';
```

**Step 3: Test node execution**

Run: `node -e "import('./server/src/services/chat/nodes/roleCardAssemble.js').then(async ({ roleCardAssembleNode }) => { const state = new (await import('./server/src/services/chat/state/ConversationState.js')).default({ roleCardMode: 'static', systemPrompt: 'test prompt' }); await roleCardAssembleNode(state); console.log('✅ Node executed:', state.systemPrompt.substring(0, 50)); })"`

Expected: `✅ Node executed: test prompt`

**Step 4: Commit**

```bash
git add server/src/services/chat/nodes/roleCardAssemble.js
git commit -m "feat: add dual mode support to roleCardAssemble node"
```

---

## Task 5: Modify sentimentAnalyzer Node for Dual Mode

**Files:**
- Modify: `server/src/services/chat/nodes/sentimentAnalyzer.js`

**Context:** Method B doesn't need sentiment analysis. This node becomes a no-op for static mode.

**Step 1: Add roleCardMode check**

Replace entire node function (lines 17-49) with:

```javascript
export async function sentimentAnalyzerNode(state) {
  try {
    const { roleCardMode } = state;

    if (roleCardMode === 'static') {
      logger.info('[SentimentAnalyzer] 方法B：跳过好感度分析');
      return state;
    }

    logger.info('[SentimentAnalyzer] 分析情感和好感度');

    const { userId, interlocutor, currentInput, messages } = state;
    const sentimentManager = new SentimentManager();

    const sentimentRecord = await sentimentManager.getStrangerSentiment(userId, interlocutor.id);

    const sentimentScore = await sentimentManager.analyzeSentiment(currentInput);

    await sentimentManager.updateSentiment(userId, interlocutor.id, {
      message: currentInput,
      conversationHistory: messages,
      sentiment: sentimentScore
    });

    state.interlocutor.sentimentScore = sentimentRecord.currentScore;
    state.metadata.sentimentAnalysis = {
      score: sentimentScore,
      currentSentiment: sentimentRecord.currentScore,
      analyzedAt: new Date()
    };

    logger.info(`[SentimentAnalyzer] 情感分析完成 - 情感分: ${sentimentScore}, 好感度: ${sentimentRecord.currentScore}`);

    return state;
  } catch (error) {
    logger.error('[SentimentAnalyzer] 处理失败:', error);
    state.addError(error);
    return state;
  }
}
```

**Step 2: Verify no-op behavior**

Run: `node -e "import('./server/src/services/chat/nodes/sentimentAnalyzer.js').then(async ({ sentimentAnalyzerNode }) => { const state = new (await import('./server/src/services/chat/state/ConversationState.js')).default({ roleCardMode: 'static' }); await sentimentAnalyzerNode(state); console.log('✅ No-op executed'); })"`

Expected: `✅ No-op executed`

**Step 3: Commit**

```bash
git add server/src/services/chat/nodes/sentimentAnalyzer.js
git commit -m "feat: add dual mode support to sentimentAnalyzer node"
```

---

## Task 6: Modify relationConfirm Node for Method B Validation

**Files:**
- Modify: `server/src/services/chat/nodes/relationConfirm.js`

**Context:** Method B requires existing AssistRelation (family/friend). If mode is static and no relation exists, throw error.

**Step 1: Add validation for method B**

Add validation after finding assistRelation (after line 53, before line 55):

```javascript
// 方法B验证：必须是family或friend
if (state.roleCardMode === 'static' && (!assistRelation || (relationType === 'stranger'))) {
  throw new Error('方法B模式仅支持协助者关系（family/friend），当前为陌生人或未建立协助关系');
}
```

**Step 2: Verify error handling**

Run: `node -e "import('./server/src/services/chat/nodes/relationConfirm.js').then(async ({ relationConfirmNode }) => { const state = new (await import('./server/src/services/chat/state/ConversationState.js')).default({ roleCardMode: 'static', userId: 'test', interlocutor: { id: 'test2' } }); await relationConfirmNode(state).catch(e => console.log('✅ Error thrown:', e.message)); })"`

Expected: `✅ Error thrown: 方法B模式仅支持协助者关系`

**Step 3: Commit**

```bash
git add server/src/services/chat/nodes/relationConfirm.js
git commit -m "feat: add method B validation to relationConfirm node"
```

---

## Task 7: Modify ChatGraphOrchestrator createSession Method

**Files:**
- Modify: `server/src/services/chat/ChatGraphOrchestrator.js`

**Context:** Update createSession to accept roleCardMode and systemPrompt, and load from file if needed for method B.

**Step 1: Import RolecardStorage**

Add import at top (after line 23):

```javascript
import RolecardStorage from '../../utils/rolecardStorage.js';
```

**Step 2: Update createSession parameters and validation**

Replace options destructuring (lines 52) with:

```javascript
const {
  targetUserId,
  interlocutorUserId,
  targetUniqueCode,
  roleCardMode = 'dynamic',
  systemPrompt: providedSystemPrompt
} = options;
```

**Step 3: Add validation for roleCardMode**

Add validation after options destructuring (after line 56):

```javascript
if (!['dynamic', 'static'].includes(roleCardMode)) {
  throw new Error('roleCardMode必须是dynamic或static');
}
```

**Step 4: Load systemPrompt for method B if not provided**

Add loading logic before creating ChatSession (after line 64, before `const session = new ChatSession`):

```javascript
let finalSystemPrompt = providedSystemPrompt;

if (roleCardMode === 'static' && !finalSystemPrompt) {
  const rolecardStorage = new RolecardStorage();
  const rolecard = await rolecardStorage.getLatestRolecard(targetUserId);

  if (!rolecard) {
    throw new Error(`方法B模式：未提供systemPrompt，且未找到该用户的角色卡文件 - User: ${targetUserId}`);
  }

  finalSystemPrompt = rolecard.systemPrompt;
  logger.info(`[ChatGraphOrchestrator] 从文件加载角色卡 - User: ${targetUserId}, Version: ${rolecard.version}`);
}
```

**Step 5: Update ChatSession creation**

Add roleCardMode and systemPrompt to session creation (after line 73, add in session object):

```javascript
relation: 'stranger',
roleCardMode,
systemPrompt: finalSystemPrompt,
sentimentScore: 50,
```

**Step 6: Update ConversationState creation**

Add roleCardMode and systemPrompt to state creation (after line 84, add in state object):

```javascript
messages: [],
roleCardMode,
systemPrompt: finalSystemPrompt,
metadata: { sessionId }
```

**Step 7: Update return object**

Add roleCardMode to response (after line 108, add to returned object):

```javascript
relation: {
  type: 'stranger',
  roleCardMode
}
```

**Step 8: Test createSession with method B**

Run: `node -e "import('./server/src/services/chat/ChatGraphOrchestrator.js').then(async ({ default: Orchestrator }) => { const orchestrator = new Orchestrator(); try { await orchestrator.createSession({ targetUserId: '698abdf152e5e295fe72c0a0', interlocutorUserId: '698abdf152e5e295fe72c0a0', targetUniqueCode: 'test', roleCardMode: 'static' }); } catch(e) { console.log('✅ Expected error:', e.message); } })"`

Expected: `✅ Expected error: 用户不存在`

**Step 9: Commit**

```bash
git add server/src/services/chat/ChatGraphOrchestrator.js
git commit -m "feat: add roleCardMode and systemPrompt support to createSession"
```

---

## Task 8: Modify ChatController createSessionByCode Method

**Files:**
- Modify: `server/src/controllers/ChatController.js`

**Context:** Update API endpoint to accept roleCardMode and systemPrompt parameters.

**Step 1: Add parameter extraction and validation**

After line 23 (after `const { targetUniqueCode } = req.body;`), add:

```javascript
const { roleCardMode = 'dynamic', systemPrompt } = req.body;

if (!['dynamic', 'static'].includes(roleCardMode)) {
  return res.status(400).json({
    success: false,
    error: 'roleCardMode必须是dynamic或static'
  });
}

if (roleCardMode === 'static' && !systemPrompt) {
  logger.info('[ChatController] 方法B模式未提供systemPrompt，将尝试从文件加载');
}
```

**Step 2: Pass parameters to orchestrator**

Update orchestrator.createSession call (line 48-52):

```javascript
const session = await orchestrator.createSession({
  targetUserId,
  interlocutorUserId,
  targetUniqueCode,
  roleCardMode,
  systemPrompt
});
```

**Step 3: Test API with curl**

Run: `curl -X POST http://localhost:3001/api/chat/sessions/by-code -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN" -d '{"targetUniqueCode":"test","roleCardMode":"static"}'`

Expected: `{ success: true, session: { ... } }` (with roleCardMode field)

**Step 4: Commit**

```bash
git add server/src/controllers/ChatController.js
git commit -m "feat: add roleCardMode and systemPrompt to createSessionByCode"
```

---

## Task 9: Integration Testing

**Files:**
- Test: Manual integration test

**Context:** Verify the complete flow works with both modes.

**Step 1: Test Method A (dynamic) flow**

```bash
# Create session with dynamic mode
curl -X POST http://localhost:3001/api/chat/sessions/by-code \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "targetUniqueCode": "YOUR_TARGET_CODE",
    "roleCardMode": "dynamic"
  }'

# Save sessionId from response

# Send message
curl -X POST http://localhost:3001/api/chat/sessions/{sessionId}/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "你好"}'

Expected: Successful response with assistant message
```

**Step 2: Test Method B (static) flow**

```bash
# Ensure rolecard file exists
ls server/storage/rolecards/698abdf152e5e295fe72c0a0/rolecard_latest.json

# Create session with static mode (systemPrompt will be loaded from file)
curl -X POST http://localhost:3001/api/chat/sessions/by-code \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "targetUniqueCode": "698abdf152e5e295fe72c0a0",
    "roleCardMode": "static"
  }'

# Save sessionId from response

# Send message
curl -X POST http://localhost:3001/api/chat/sessions/{sessionId}/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "你好，邓爷爷"}'

Expected: Successful response with character role response (邓仙圣 personality)
```

**Step 3: Test Method B validation (stranger without AssistRelation)**

```bash
# Create session with static mode for non-assistant user (should fail)
curl -X POST http://localhost:3001/api/chat/sessions/by-code \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "targetUniqueCode": "STRANGER_USER_CODE",
    "roleCardMode": "static"
  }'

Expected: { success: false, error: "方法B模式仅支持协助者关系" }
```

**Step 4: Verify database records**

Run: `docker exec afs-system-mongoserver-1 mongosh afs_db --eval "db.chatsessions.findOne({ roleCardMode: 'static' }, { roleCardMode: 1, systemPrompt: 1 })"`

Expected: Document with `roleCardMode: 'static'` and populated `systemPrompt` field

**Step 5: Verify logs**

Run: `docker-compose logs server | grep -E "(RoleCardAssemble|relationConfirm)"`

Expected: Logs showing correct mode execution
```
[RoleCardAssemble] 方法B：使用静态systemPrompt
[relationConfirm] 方法B验证通过
```

---

## Task 10: Documentation Updates

**Files:**
- Create: `docs/langgraph-dual-mode.md`

**Context:** Document the dual mode architecture, usage, and troubleshooting.

**Step 1: Create documentation file**

Write: `docs/langgraph-dual-mode.md`

```markdown
# LangGraph Dual Mode Support

## Overview

The LangGraph conversation system supports two rolecard generation methods:

### Method A (dynamic) - Production
- Uses DynamicRoleCardAssembler
- Generates rolecard per message
- Supports family/friend/stranger relationships
- Includes sentiment analysis

### Method B (static) - Demo
- Uses pre-generated systemPrompt from local files
- Loads from `server/storage/rolecards/{userId}/rolecard_latest.json`
- Only supports family/friend relationships
- No sentiment analysis (empty operation)

## Usage

### Creating Session

**Method A (dynamic):**
```bash
POST /api/chat/sessions/by-code
{
  "targetUniqueCode": "USER_CODE",
  "roleCardMode": "dynamic"
}
```

**Method B (static):**
```bash
POST /api/chat/sessions/by-code
{
  "targetUniqueCode": "USER_ID",
  "roleCardMode": "static",
  "systemPrompt": "OPTIONAL_PROMPT"  // If not provided, loads from file
}
```

## File Storage

### Rolecard File Structure

```
server/storage/rolecards/
├── {userId}/
│   ├── rolecard_v1.json
│   ├── rolecard_v2.json
│   └── rolecard_latest.json
```

### Rolecard Format

```json
{
  "version": 1,
  "userId": "6789abcd...",
  "generatedAt": "2026-02-10T16:48:54.000Z",
  "systemPrompt": "# Role Name\n\n## Background\n...",
  "metadata": {
    "source": "methodB",
    "generator": "rolecard-generator-b",
    "questionsAnswered": 200
  }
}
```

## Flow Comparison

| Node | Method A | Method B |
|------|----------|----------|
| input_processor | Same | Same |
| relation_confirm | Allows stranger | Requires family/friend |
| rolecard_assemble | DynamicRoleCardAssembler | Uses loaded systemPrompt |
| rag_retriever | family/friend only | family/friend only |
| sentiment_analyzer | Analyzes | Skips (no-op) |
| context_builder | Same | Same |
| response_generator | Same | Same |
| memory_updater | Same | Same |
| output_formatter | Same | Same |

## Troubleshooting

### Error: "未找到该用户的角色卡文件"
- Check if `server/storage/rolecards/{userId}/rolecard_latest.json` exists
- Verify file is valid JSON

### Error: "方法B模式仅支持协助者关系"
- Ensure AssistRelation exists between users
- Relation must be family or friend, not stranger

### No character personality in response
- Verify systemPrompt content in rolecard file
- Check logs for rolecard loading errors

## API Reference

### POST /api/chat/sessions/by-code

**Request Body:**
```json
{
  "targetUniqueCode": "string (required)",
  "roleCardMode": "dynamic|static (default: dynamic)",
  "systemPrompt": "string (optional, static mode only)"
}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "sessionId": "string",
    "targetUser": { ... },
    "interlocutorUser": { ... },
    "relation": {
      "type": "family|friend|stranger",
      "roleCardMode": "dynamic|static"
    }
  }
}
```
```

**Step 2: Commit**

```bash
git add docs/langgraph-dual-mode.md
git commit -m "docs: add LangGraph dual mode documentation"
```

---

## Task 11: Final Verification

**Files:**
- Verification across all components

**Context:** Ensure all changes work together correctly.

**Step 1: Run server tests**

Run: `cd server && npm test`

Expected: All tests pass

**Step 2: Check for TypeScript/ESLint errors**

Run: `cd server && npm run lint` (if available)

Expected: No linting errors

**Step 3: Verify docker compose rebuilds**

Run: `docker-compose up -d --build server`

Expected: Server starts successfully

**Step 4: Test full conversation flow**

1. Create session (method B)
2. Send 3 messages
3. Check responses match character personality
4. End session
5. Verify ChatSession record in MongoDB

Expected: Successful end-to-end flow

**Step 5: Create summary commit**

```bash
git commit --allow-empty -m "chore: complete LangGraph dual mode implementation"
```

---

## Summary

This implementation enables LangGraph to support both rolecard generation methods:

- **Method A (dynamic)**: Original implementation, fully functional
- **Method B (static)**: New demo mode, uses markdown rolecards from local files

### Key Changes
1. `ChatSession` model: Added `roleCardMode` and `systemPrompt` fields
2. `ConversationState`: Added state fields for mode and prompt
3. `roleCardAssemble` node: Dual mode logic
4. `sentimentAnalyzer` node: No-op for static mode
5. `relationConfirm` node: Validates AssistRelation for static mode
6. `ChatGraphOrchestrator`: Loads systemPrompt from file if needed
7. `ChatController`: Accepts new API parameters
8. `RolecardStorage`: Utility for file-based rolecard management

### Backward Compatibility
All changes are backward compatible. Method A (dynamic) continues to work exactly as before. Method B (static) is opt-in via `roleCardMode` parameter.

### Next Steps
After this implementation:
1. Build frontend chat interface
2. Create rolecard generator B tool
3. Test with real RAG data for user `698abdf152e5e295fe72c0a0`
