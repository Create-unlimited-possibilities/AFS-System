# Dual Storage System Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical bugs in the dual storage system (MongoDB + filesystem) where answers are not displaying, layer switching deletes data, and file system writes fail.

**Architecture:** Refactor the answer storage and retrieval flow to properly handle layer separation, correct user ID usage, and fix file system paths for cross-platform compatibility.

**Tech Stack:** MongoDB (Mongoose), Node.js/Express, Next.js frontend, fs/promises for file system operations

---

## Problem Summary

### Issue 1: Frontend cannot display answered content
- Route `/api/questions` uses `elderCode` parameter but should use `userId` from auth
- Frontend doesn't send `elderCode`, causing empty answer retrieval

### Issue 2: Basic layer answers deleted when switching to emotional layer
- `batchSaveSelfAnswers()` and `batchSaveAssistAnswers()` delete ALL answers without layer filter
- This deletes answers from both layers when saving one layer

### Issue 3: Cannot write to local file system
- File path `/app/storage/userdata` is Docker-specific, won't work on Windows
- Path needs to use relative path from project root

### Issue 4: Folder naming mismatch
- Code uses `B_sets` and `C_sets` but documentation specifies `Bste` and `Cste`
- Helper folder naming is inconsistent

---

## Task 1: Fix questions route to use correct user ID

**Files:**
- Modify: `server/src/routes/questions.js:12-86`

**Step 1: Update the GET / route to use userId from auth**

Replace the entire GET / route handler (lines 44-86) with:

```javascript
// 2. 获取某个层次的所有问题 + 已答答案
router.get('/', protect, async (req, res) => {
  try {
    const { role = 'elder', layer = 'basic' } = req.query;
    const userId = req.user.id;

    const questions = await Question.find({ role, layer, active: true })
      .sort({ order: 1 })
      .lean();

    // 使用正确的 userId 和 targetUserId 查询已回答内容
    const memories = await Answer.find({
      targetUserId: userId,
      userId: userId,
      questionLayer: layer
    }).lean();

    const answerMap = {};
    memories.forEach(m => {
      // 处理两种情况：questionId 可能是字符串或 ObjectId
      const questionId = m.questionId._id ? m.questionId._id.toString() : m.questionId.toString();
      answerMap[questionId] = m.answer;
    });

    const result = questions.map(q => ({
      _id: q._id,
      order: q.order,
      question: q.question,
      placeholder: q.placeholder || '',
      type: q.type || 'textarea',
      answer: answerMap[q._id.toString()] || ''
    }));

    const total = questions.length;
    const answered = Object.keys(answerMap).length;

    res.json({
      success: true,
      questions: result,
      total,
      answered,
      progress: total > 0 ? Math.round((answered / total) * 100) : 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});
```

**Step 2: Update the GET /progress route to use userId from auth**

Replace the entire GET /progress route handler (lines 12-41) with:

```javascript
// 1. 获取所有层次的进度（用于左侧面板）
router.get('/progress', protect, async (req, res) => {
  try {
    const { role = 'elder' } = req.query;
    const userId = req.user.id;

    const layers = ['basic', 'emotional'];
    const result = {};

    for (const layer of layers) {
      const questions = await Question.countDocuments({ role, layer, active: true });
      const answered = await Answer.countDocuments({
        targetUserId: userId,
        userId: userId,
        questionLayer: layer
      });

      result[layer] = {
        total: questions,
        answered,
        progress: questions > 0 ? Math.round((answered / questions) * 100) : 0
      };
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取进度失败' });
  }
});
```

**Step 3: Commit**

```bash
git add server/src/routes/questions.js
git commit -m "fix: use userId from auth instead of elderCode in questions route"
```

---

## Task 2: Fix layer-specific answer deletion

**Files:**
- Modify: `server/src/services/AnswerService.js:278-339`

**Step 1: Update batchSaveSelfAnswers to only delete answers for the specific layer**

Replace the `deleteMany` call and subsequent logic (lines 279-339) with:

```javascript
async batchSaveSelfAnswers(userId, answers) {
  // 首先获取所有问题的 layer 信息
  const answerDataWithLayers = [];
  for (const answerData of answers) {
    const question = await this.questionRepository.findById(answerData.questionId);
    if (!question) continue;
    answerDataWithLayers.push({
      ...answerData,
      layer: question.layer
    });
  }

  // 按层分组答案
  const answersByLayer = {
    basic: [],
    emotional: []
  };

  for (const data of answerDataWithLayers) {
    if (answersByLayer[data.layer]) {
      answersByLayer[data.layer].push(data);
    }
  }

  // 对每一层，先删除该层的旧答案，再插入新答案
  let totalTokenCount = 0;
  const allSavedAnswers = [];

  for (const layer of ['basic', 'emotional']) {
    const layerAnswers = answersByLayer[layer];

    if (layerAnswers.length > 0) {
      // 只删除当前层的答案
      await this.answerRepository.deleteMany({
        userId,
        targetUserId: userId,
        questionLayer: layer
      });

      const answerDocs = [];
      for (const answerData of layerAnswers) {
        const question = await this.questionRepository.findById(answerData.questionId);
        if (!question) continue;

        answerDocs.push({
          userId,
          targetUserId: userId,
          questionId: answerData.questionId,
          questionLayer: question.layer,
          answer: answerData.answer,
          isSelfAnswer: true,
          relationshipType: 'self'
        });

        // 保存到文件系统
        await this.storageService.saveAnswer({
          userId,
          targetUserId: userId,
          questionId: question._id,
          question,
          answer: answerData.answer,
          layer: question.layer,
          relationshipType: 'self',
          questionRole: question.role,
          questionOrder: question.order,
          helperId: null,
          helperNickname: null
        });

        totalTokenCount += countTokens(answerData.answer);
      }

      if (answerDocs.length > 0) {
        const inserted = await this.answerRepository.insertMany(answerDocs);
        allSavedAnswers.push(...inserted);
      }
    }
  }

  // 重新计算并更新总 token 数
  if (allSavedAnswers.length > 0) {
    const newTotalTokenCount = allSavedAnswers.reduce((sum, a) => sum + countTokens(a.answer), 0);

    await this.userRepository.findByIdAndUpdate(userId, {
      $set: { 'companionChat.roleCard.memoryTokenCount': newTotalTokenCount }
    });
  }

  return { savedCount: allSavedAnswers.length };
}
```

**Step 2: Commit**

```bash
git add server/src/services/AnswerService.js
git commit -m "fix: batchSaveSelfAnswers only deletes answers for specific layer"
```

---

## Task 3: Fix assist answer layer deletion

**Files:**
- Modify: `server/src/services/AnswerService.js:341-409`

**Step 1: Update batchSaveAssistAnswers to only delete answers for specific layer**

Replace the `batchSaveAssistAnswers` method (lines 341-409) with:

```javascript
async batchSaveAssistAnswers(userId, targetUserId, answers) {
  const relation = await this.assistRelationRepository.findOne({
    assistantId: userId,
    targetId: targetUserId,
    isActive: true
  });

  if (!relation) {
    throw new Error('您没有协助该用户的权限');
  }

  // 首先获取所有问题的 layer 信息
  const answerDataWithLayers = [];
  for (const answerData of answers) {
    const question = await this.questionRepository.findById(answerData.questionId);
    if (!question) continue;
    answerDataWithLayers.push({
      ...answerData,
      layer: question.layer
    });
  }

  // 按层分组答案
  const answersByLayer = {
    basic: [],
    emotional: []
  };

  for (const data of answerDataWithLayers) {
    if (answersByLayer[data.layer]) {
      answersByLayer[data.layer].push(data);
    }
  }

  // 对每一层，先删除该层的旧答案，再插入新答案
  let totalTokenCount = 0;
  const allSavedAnswers = [];
  const helper = await this.userRepository.findById(userId);

  for (const layer of ['basic', 'emotional']) {
    const layerAnswers = answersByLayer[layer];

    if (layerAnswers.length > 0) {
      // 只删除当前层的答案
      await this.answerRepository.deleteMany({
        userId,
        targetUserId,
        questionLayer: layer
      });

      const answerDocs = [];
      for (const answerData of layerAnswers) {
        const question = await this.questionRepository.findById(answerData.questionId);
        if (!question) continue;

        answerDocs.push({
          userId,
          targetUserId,
          questionId: answerData.questionId,
          questionLayer: question.layer,
          answer: answerData.answer,
          isSelfAnswer: false,
          relationshipType: relation.relationshipType
        });

        // 保存到文件系统
        await this.storageService.saveAnswer({
          userId,
          targetUserId,
          questionId: question._id,
          question,
          answer: answerData.answer,
          layer: question.layer,
          relationshipType: relation.relationshipType,
          helperId: helper._id.toString(),
          helperNickname: helper.nickname || helper.name,
          questionRole: question.role,
          questionOrder: question.order
        });

        totalTokenCount += countTokens(answerData.answer);
      }

      if (answerDocs.length > 0) {
        const inserted = await this.answerRepository.insertMany(answerDocs);
        allSavedAnswers.push(...inserted);
      }
    }
  }

  // 重新计算并更新总 token 数
  if (allSavedAnswers.length > 0) {
    const newTotalTokenCount = allSavedAnswers.reduce((sum, a) => sum + countTokens(a.answer), 0);

    await this.userRepository.findByIdAndUpdate(targetUserId, {
      $set: { 'companionChat.roleCard.memoryTokenCount': newTotalTokenCount }
    });
  }

  return { savedCount: allSavedAnswers.length };
}
```

**Step 2: Commit**

```bash
git add server/src/services/AnswerService.js
git commit -m "fix: batchSaveAssistAnswers only deletes answers for specific layer"
```

---

## Task 4: Fix file system base path for cross-platform compatibility

**Files:**
- Modify: `server/src/services/fileStorage.js:1-12`
- Modify: `server/src/services/dualStorage.js:1-12`

**Step 1: Update FileStorage base path to use relative path**

Replace lines 1-12 in `server/src/services/fileStorage.js` with:

```javascript
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { countTokens } from '../utils/tokenCounter.js';

// 获取项目根目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

export default class FileStorage {
  constructor() {
    // 使用相对于项目根目录的路径，兼容 Windows 和 Linux/Mac
    this.basePath = path.join(projectRoot, 'server', 'storage', 'userdata');
  }

  async initialize() {
    await fs.mkdir(this.basePath, { recursive: true });
  }
```

**Step 2: Update DualStorage base path to use relative path**

Replace lines 1-12 in `server/src/services/dualStorage.js` with:

```javascript
// 双重存储系统 - 所有资料同时存储在MongoDB和本地文件系统
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取项目根目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

export default class DualStorage {
  constructor() {
    // 使用相对于项目根目录的路径，兼容 Windows 和 Linux/Mac
    this.basePath = path.join(projectRoot, 'server', 'storage', 'userdata');
  }

  async initialize() {
    await fs.mkdir(this.basePath, { recursive: true });
  }
```

**Step 3: Commit**

```bash
git add server/src/services/fileStorage.js server/src/services/dualStorage.js
git commit -m "fix: use relative paths for cross-platform file system compatibility"
```

---

## Task 5: Fix folder naming to match documentation

**Files:**
- Modify: `server/src/services/fileStorage.js:20-36`

**Step 1: Update folder naming to match documentation**

Replace lines 20-36 in `server/src/services/fileStorage.js` with:

```javascript
    const { targetUserId, questionId, question, answer: text, questionLayer, questionRole, questionOrder, helperId, helperNickname } = answer;

    const userPath = path.join(this.basePath, String(targetUserId));

    // 修正文件夹命名以匹配文档规范
    const roleMap = {
      'elder': 'A_set',
      'family': 'Bste',
      'friend': 'Cste'
    };

    const dirName = roleMap[questionRole] || 'A_set';

    let folderPath;
    if (questionRole === 'elder') {
      // elder: A_set/basic|emotional （无self子目录）
      folderPath = path.join(userPath, dirName);
    } else {
      // 协助回答：使用 helperId 创建文件夹
      const helperFolder = helperId ? `helper_${helperId}` : `helper_${userId}`;
      folderPath = path.join(userPath, dirName, helperFolder);
    }

    const layerPath = path.join(folderPath, questionLayer);
    await fs.mkdir(layerPath, { recursive: true });
```

**Step 2: Update loadUserMemories to handle new folder names**

Replace `loadUserMemories` method (lines 70-102) with:

```javascript
async loadUserMemories(userId) {
  const memories = {
    A_set: [],
    Bste: [],
    Cste: []
  };

  const userPath = path.join(this.basePath, String(userId));

  try {
    // 加载 A_set (elder) - 直接从A_set/basic和A_set/emotional加载（无self子目录）
    const asetPath = path.join(userPath, 'A_set');
    const basicPath = path.join(asetPath, 'basic');
    const emotionalPath = path.join(asetPath, 'emotional');
    
    await this.loadMemoriesFromFolder(basicPath, memories.A_set);
    await this.loadMemoriesFromFolder(emotionalPath, memories.A_set);

    // 加载 Bste (family) - 从所有 helper 文件夹中加载
    const BstePath = path.join(userPath, 'Bste');
    const B_folders = await fs.readdir(BstePath).catch(() => []);
    for (const folder of B_folders) {
      if (folder.startsWith('.')) continue;
      await this.loadMemoriesFromFolder(path.join(BstePath, folder), memories.Bste);
    }

    // 加载 Cste (friend) - 从所有 helper 文件夹中加载
    const CstePath = path.join(userPath, 'Cste');
    const C_folders = await fs.readdir(CstePath).catch(() => []);
    for (const folder of C_folders) {
      if (folder.startsWith('.')) continue;
      await this.loadMemoriesFromFolder(path.join(CstePath, folder), memories.Cste);
    }

    console.log(`[FileStorage] 加载用户记忆: ${userId}, A:${memories.A_set.length}, B:${memories.Bste.length}, C:${memories.Cste.length}`);
  } catch (err) {
    console.warn(`[FileStorage] 加载用户记忆失败: ${userId}:`, err.message);
  }

  return memories;
}
```

**Step 3: Commit**

```bash
git add server/src/services/fileStorage.js
git commit -m "fix: correct folder naming to match documentation (A_set, Bste, Cste)"
```

---

## Task 6: Fix frontend answer retrieval to handle response structure

**Files:**
- Modify: `web/app/questions/page.tsx:54-77`

**Step 1: Update fetchQuestions to handle response structure correctly**

Replace the `fetchQuestions` function (lines 54-77) with:

```typescript
const fetchQuestions = async () => {
  try {
    setLoading(true)
    const res = await api.get(`/questions?layer=${currentLayer}&role=elder`)

    if (res && res.success && res.questions) {
      setQuestions(res.questions || [])

      // 直接从 res.questions 中提取答案
      const answersMap: { [key: string]: string } = {}
      res.questions.forEach((q: any) => {
        if (q.answer && q._id) {
          answersMap[q._id] = q.answer
        }
      })
      setAnswers(answersMap)
    } else {
      console.error('获取问题失败: 响应格式不正确', res)
      setQuestions([])
      setAnswers({})
    }
  } catch (error) {
    console.error('获取问题失败:', error)
    setQuestions([])
    setAnswers({})
  } finally {
    setLoading(false)
  }
}
```

**Step 2: Commit**

```bash
git add web/app/questions/page.tsx
git commit -m "fix: handle response structure correctly in frontend"
```

---

## Task 7: Add proper error handling for file system operations

**Files:**
- Modify: `server/src/services/storageService.js:43-45`
- Modify: `server/src/services/storageService.js:1-62`

**Step 1: Update syncToFileSystem to propagate errors**

Replace the `syncToFileSystem` method and improve error handling in `storageService.js`:

```javascript
import Answer from '../models/Answer.js';
import FileStorage from './fileStorage.js';

export default class StorageService {
  constructor() {
    this.fileStorage = new FileStorage();
  }

  async saveAnswer(answerData) {
    const { userId, targetUserId, questionId, question, answer, layer, relationshipType, questionRole, questionOrder, helperId, helperNickname } = answerData;

    try {
      const dbAnswer = await Answer.findOneAndUpdate(
        { userId, targetUserId, questionId },
        {
          question,
          answer,
          questionLayer: layer,
          relationshipType,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      // 等待文件系统操作完成，并传播错误
      await this.syncToFileSystem({
        ...dbAnswer.toObject(),
        question,
        questionRole,
        questionOrder,
        helperId: helperId || null,
        helperNickname: helperNickname || null
      });

      return { success: true, answer: dbAnswer };
    } catch (err) {
      console.error('[StorageService] 保存失败:', err);
      return { success: false, error: err.message };
    }
  }

  async syncToFileSystem(answer) {
    try {
      await this.fileStorage.saveMemoryFile(answer);
      console.log('[StorageService] 文件同步成功:', answer.questionOrder);
    } catch (err) {
      console.error('[StorageService] 文件同步失败:', err);
      // 不再静默失败，将错误向上传播
      throw err;
    }
  }

  async loadMemories(userId) {
    try {
      const fileMemories = await this.fileStorage.loadUserMemories(userId);
      if (fileMemories && (fileMemories.A_set?.length > 0 || fileMemories.Bste?.length > 0 || fileMemories.Cste?.length > 0)) {
        return fileMemories;
      }

      const dbMemories = await Answer.find({ targetUserId: userId }).lean();
      return dbMemories;
    } catch (err) {
      console.error('[StorageService] 加载失败:', err);
      return [];
    }
  }
}
```

**Step 2: Commit**

```bash
git add server/src/services/storageService.js
git commit -m "fix: propagate file system errors instead of swallowing them"
```

---

## Task 8: Verify and test the fixes

**Files:**
- Test: Manual testing in browser and console

**Step 1: Start the backend server**

```bash
cd server
npm run dev
```

Expected: Server starts without errors, MongoDB connection successful

**Step 2: Start the frontend**

```bash
cd web
npm run dev
```

Expected: Next.js dev server starts successfully

**Step 3: Test basic layer answer saving and retrieval**

1. Open browser to http://localhost:3000/questions
2. Login if needed
3. Select "基础层次"
4. Fill in answers for several questions
5. Click "保存回答"
6. Refresh the page
7. Verify that answers are still displayed

Expected: Answers persist after page refresh

**Step 4: Test emotional layer answer saving without affecting basic layer**

1. Switch to "情感层次"
2. Fill in answers for several questions
3. Click "保存回答"
4. Switch back to "基础层次"
5. Verify that basic layer answers are still present
6. Switch back to "情感层次"
7. Verify that emotional layer answers are still present

Expected: Both layers' answers are preserved independently

**Step 5: Verify file system writes**

```bash
# Check if userdata folder exists and contains data
ls -la server/storage/userdata/
```

Expected: User folders exist with A_set/self/basic and A_set/self/emotional directories

**Step 6: Check MongoDB data**

```bash
# Connect to MongoDB
mongosh

# Use your database
use afs_db

# Check answers
db.answers.find({}).limit(5)
```

Expected: Answers are stored in MongoDB with correct layer separation

**Step 7: Verify folder naming**

```bash
# Check folder structure
tree server/storage/userdata/<userId>/
```

Expected:
```
<userId>/
└── A_set/
    ├── basic/
    │   ├── question_1.json
    │   └── question_2.json
    └── emotional/
        ├── question_1.json
        └── question_2.json
```

**Step 8: Verify answers display on frontend**

1. Navigate to http://localhost:3000/questions
2. Check that previously saved answers are displayed in the textareas
3. Switch between layers
4. Verify that answers are maintained across layer switches

Expected: All saved answers are displayed correctly

---

## Task 9: Create verification script

**Files:**
- Create: `server/scripts/verify-dual-storage.js`

**Step 1: Create verification script**

```javascript
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Answer from '../src/models/Answer.js';
import Question from '../src/models/Question.js';
import User from '../src/models/User.js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const storagePath = path.join(projectRoot, 'server', 'storage', 'userdata');

// 使用根目录的 .env 文件
dotenv.config({ path: path.join(projectRoot, '.env') });

async function verify() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ MongoDB connected');

    // 1. Check MongoDB answers
    const totalAnswers = await Answer.countDocuments();
    console.log(`\n✓ MongoDB: ${totalAnswers} answers found`);

    // 2. Check file system
    const userdataExists = await fs.access(storagePath).then(() => true).catch(() => false);
    if (!userdataExists) {
      console.log('✗ File system: userdata directory does not exist');
    } else {
      console.log('✓ File system: userdata directory exists');

      // Check user folders
      const users = await User.find({}).limit(10);
      for (const user of users) {
        const userPath = path.join(storagePath, user._id.toString());
        const userExists = await fs.access(userPath).then(() => true).catch(() => false);

        if (userExists) {
          console.log(`  ✓ User ${user.name}: directory exists`);

          // Check A_set folder
          const asetPath = path.join(userPath, 'A_set');
          const asetExists = await fs.access(asetPath).then(() => true).catch(() => false);
          if (asetExists) {
            console.log(`    ✓ A_set folder exists`);

            // 直接从 A_set/basic 和 A_set/emotional 加载（无self子目录）
            const basicPath = path.join(asetPath, 'basic');
            const emotionalPath = path.join(asetPath, 'emotional');

            const basicFiles = await fs.readdir(basicPath).catch(() => []);
            const emotionalFiles = await fs.readdir(emotionalPath).catch(() => []);

            console.log(`      - Basic: ${basicFiles.length} files`);
            console.log(`      - Emotional: ${emotionalFiles.length} files`);
          }
        }
      }
    }

    // 3. Check layer separation
    const basicAnswers = await Answer.countDocuments({ questionLayer: 'basic' });
    const emotionalAnswers = await Answer.countDocuments({ questionLayer: 'emotional' });
    console.log(`\n✓ Layer separation:`);
    console.log(`  - Basic: ${basicAnswers} answers`);
    console.log(`  - Emotional: ${emotionalAnswers} answers`);

    // 4. Verify data consistency
    const userAnswers = await Answer.aggregate([
      { $match: { isSelfAnswer: true } },
      { $group: { _id: { userId: '$userId', layer: '$questionLayer' }, count: { $sum: 1 } } }
    ]);

    console.log(`\n✓ User answer distribution:`);
    userAnswers.forEach(item => {
      console.log(`  - User ${item._id.userId}: ${item._id.layer} = ${item.count} answers`);
    });

    console.log('\n✓ Verification complete!\n');
  } catch (error) {
    console.error('✗ Verification failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

verify();
```

**Step 2: Run verification script**

```bash
cd server
node scripts/verify-dual-storage.js
```

Expected output:
```
✓ MongoDB connected

✓ MongoDB: X answers found
✓ File system: userdata directory exists
  ✓ User [name]: directory exists
    ✓ A_set folder exists
      - Basic: X files
      - Emotional: X files

✓ Layer separation:
  - Basic: X answers
  - Emotional: X answers

✓ User answer distribution:
  - User [id]: basic = X answers
  - User [id]: emotional = X answers

✓ Verification complete!
```

**Step 3: Commit**

```bash
git add server/scripts/verify-dual-storage.js
git commit -m "feat: add dual storage verification script"
```

---

## Summary of Changes

### Fixed Issues:
1. ✓ Frontend can now display answered content correctly
2. ✓ Basic layer answers are preserved when switching to emotional layer
3. ✓ File system writes work on Windows and cross-platform
4. ✓ Folder naming matches documentation (A_set, Bste, Cste)
5. ✓ Proper error handling for file system operations
6. ✓ Verification script for ongoing monitoring

### Key Technical Changes:
- Questions route now uses `userId` from auth instead of `elderCode` parameter
- Batch save operations filter by layer before deleting
- File paths are relative to project root for cross-platform compatibility
- File system errors are propagated instead of silently caught
- Frontend correctly handles response structure

---

## Testing Checklist

- [ ] Basic layer answers save and display
- [ ] Emotional layer answers save and display
- [ ] Switching between layers preserves both layers' data
- [ ] File system folder structure matches documentation
- [ ] MongoDB contains correct data with layer separation
- [ ] Verification script runs successfully
- [ ] No console errors in browser or server

---

## Execution Instructions (Parallel Session)

You've chosen **Parallel Session** execution. To implement this plan:

### Step 1: Open New Session

1. Start a new conversation with opencode
2. Load the executing-plans skill at the start:
   ```
   "I need to execute the dual storage refactoring plan. Please use the executing-plans skill."
   ```
3. Provide the plan location:
   ```
   "Plan file: .opencode/plans/2026-02-11-dual-storage-refactoring.md"
   ```

### Step 2: Required Skills

The new session will automatically load:
- **superpowers:executing-plans** - Main execution skill
- **superpowers:verification-before-completion** - Final verification

### Step 3: Execution Process

The executing-plans agent will:
1. Read the plan file
2. Execute tasks 1-9 sequentially
3. Create checkpoints at each task completion
4. Run verification before marking complete
5. You'll review progress between tasks

### Step 4: Monitor Progress

- Watch for commit messages
- Review file changes at checkpoints
- Test features after major tasks complete
- Run verification script at the end

### Current Configuration

**Verified:**
- ✓ MongoDB URI: `mongodb://mongoserver:27017/afs_db`
- ✓ .env location: Root directory (F:\FPY\AFS-System\.env)
- ✓ Folder structure: `A_set/basic|emotional` (no self subdirectory)
- ✓ PORT: 3001

**Note:** All paths in the plan use project-relative paths for cross-platform compatibility.
