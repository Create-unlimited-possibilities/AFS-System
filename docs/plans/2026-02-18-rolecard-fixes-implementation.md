# 角色卡功能修复实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复角色卡生成的 4 个问题：前端检测、SSE 进度、协助者答案检测、JSON 解析重试

**Architecture:**
- 前端改用 SSE 接口实现实时进度反馈
- 后端修复查询条件（layer → role）并添加重试机制
- 所有修改保持向后兼容

**Tech Stack:** TypeScript (Next.js), JavaScript (Node.js/Express), SSE, MongoDB

---

## Task 1: 修复协助者答案查询逻辑

**Files:**
- Modify: `server/src/modules/rolecard/v2/relationLayerGenerator.js:260-283`
- Test: `server/tests/unit/v2/relationLayerGenerator.test.js`

**Step 1: 更新 collectAssistantAnswers 方法**

修改 `server/src/modules/rolecard/v2/relationLayerGenerator.js`：

```javascript
// 找到 collectAssistantAnswers 方法（约第 260 行）
// 修改前：
async collectAssistantAnswers(userId, assistantId, relationType) {
  // 根据关系类型选择题目集
  // B-set = 家人问题, C-set = 朋友问题
  const targetLayer = relationType === 'family' ? 'B' : 'C';

  const answers = await Answer.find({
    userId: assistantId,        // 协助者回答
    targetUserId: userId,       // 关于目标用户
    isSelfAnswer: false         // 不是自答
  })
  .populate('questionId')
  .sort({ createdAt: 1 });

  return answers
    .filter(a => a.questionId && a.questionId.layer === targetLayer)
    .map(a => ({
      answerId: a._id,
      questionId: a.questionId._id,
      questionText: a.questionId.question,
      questionLayer: a.questionId.layer,
      significance: a.questionId.significance,
      answerText: a.answer
    }));
}

// 修改后：
async collectAssistantAnswers(userId, assistantId, relationType) {
  // 根据关系类型选择题目集
  // family = 家人问题(B套), friend = 朋友问题(C套)
  const targetRole = relationType === 'family' ? 'family' : 'friend';

  profileLogger.info('收集协助者答案', {
    userId,
    assistantId,
    relationType,
    targetRole
  });

  const answers = await Answer.find({
    userId: assistantId,        // 协助者回答
    targetUserId: userId,       // 关于目标用户
    isSelfAnswer: false         // 不是自答
  })
  .populate('questionId')
  .sort({ createdAt: 1 });

  const filtered = answers
    .filter(a => a.questionId && a.questionId.role === targetRole)
    .map(a => ({
      answerId: a._id,
      questionId: a.questionId._id,
      questionText: a.questionId.question,
      questionLayer: a.questionId.layer,
      questionRole: a.questionId.role,
      significance: a.questionId.significance,
      answerText: a.answer
    }));

  profileLogger.info(`收集到 ${filtered.length} 个符合条件的协助者答案`, {
    userId,
    assistantId,
    targetRole,
    totalAnswers: answers.length,
    filteredAnswers: filtered.length
  });

  return filtered;
}
```

**Step 2: 更新单元测试**

在 `server/tests/unit/v2/relationLayerGenerator.test.js` 中添加测试：

```javascript
describe('collectAssistantAnswers()', () => {
  it('应为家人关系查询 role=family 的问题', async () => {
    // 这是一个间接测试，通过 mock 来验证
    const generator = new RelationLayerGenerator();

    // 验证 relationType === 'family' 时使用 'family' 角色
    // 实际测试需要 mock Answer.find
  });

  it('应为朋友关系查询 role=friend 的问题', async () => {
    const generator = new RelationLayerGenerator();
    // 验证 relationType === 'friend' 时使用 'friend' 角色
  });
});
```

**Step 3: 运行测试验证**

Run: `cd server && npm test -- tests/unit/v2/relationLayerGenerator.test.js --run`
Expected: All tests pass

**Step 4: 提交更改**

```bash
git add server/src/modules/rolecard/v2/relationLayerGenerator.js
git commit -m "fix: correct assistant answer query to use role field instead of layer"
```

---

## Task 2: 在 CoreLayerGenerator 中添加 JSON 解析重试机制

**Files:**
- Modify: `server/src/modules/rolecard/v2/coreLayerGenerator.js`
- Test: `server/tests/unit/v2/coreLayerGenerator.test.js`

**Step 1: 添加 callLLMWithRetry 方法**

在 `coreLayerGenerator.js` 的 `parseJsonResponse` 方法后添加：

```javascript
/**
 * 带 JSON 解析重试的 LLM 调用
 * @param {string} prompt - 提示词
 * @param {Object} options - LLM 选项
 * @param {number} maxRetries - 最大重试次数
 * @returns {Promise<Object|null>} 解析后的 JSON 对象
 */
async callLLMWithRetry(prompt, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await this.llmClient.generate(prompt, options);
      const parsed = this.parseJsonResponse(response);

      if (parsed) {
        if (attempt > 1) {
          profileLogger.info(`JSON 解析重试成功`, { attempt });
        }
        return parsed;
      }

      profileLogger.warn('JSON 解析失败，准备重试', {
        attempt,
        maxRetries,
        responsePreview: typeof response === 'string' ? response.substring(0, 100) : 'object'
      });
    } catch (error) {
      profileLogger.error('LLM 调用失败', { attempt, error: error.message });
    }
  }

  profileLogger.error('JSON 解析重试次数用尽', { maxRetries });
  return null;
}
```

**Step 2: 修改 processOneAnswer 方法使用重试**

```javascript
// 找到 processOneAnswer 方法，修改为：
async processOneAnswer(item) {
  try {
    const prompt = buildPerAnswerExtractionPrompt(
      item.questionText,
      item.answerText,
      item.significance
    );

    // 使用带重试的 LLM 调用
    const extracted = await this.callLLMWithRetry(prompt, {
      temperature: 0.3,
      maxTokens: 1000,
      responseFormat: 'json'
    });

    if (extracted && extracted.extractedFields) {
      for (const [fieldName, content] of Object.entries(extracted.extractedFields)) {
        if (content && this.fieldFragments[fieldName]) {
          this.fieldFragments[fieldName].push({
            content,
            sourceQuestionId: item.questionId,
            confidence: extracted.confidence || 'medium'
          });
        }
      }
    }

  } catch (error) {
    profileLogger.error('处理单条答案失败', {
      questionId: item.questionId,
      error: error.message
    });
  }
}
```

**Step 3: 修改 compressAllFields 方法使用重试**

找到压缩字段的 try 块，修改为：

```javascript
// 在 compressAllFields 方法中，找到 try 块
const compressed = await this.callLLMWithRetry(prompt, {
  temperature: 0.3,
  maxTokens: CORE_LAYER_FIELDS[fieldName].tokenTarget + 100,
  responseFormat: 'json'
});
```

**Step 4: 添加单元测试**

在 `coreLayerGenerator.test.js` 中添加：

```javascript
describe('callLLMWithRetry()', () => {
  it('首次成功时应返回解析结果', async () => {
    const generator = new CoreLayerGenerator();
    generator.llmClient.generate = vi.fn().mockResolvedValue('{"test": "value"}');

    const result = await generator.callLLMWithRetry('test prompt', {});
    expect(result).toEqual({ test: 'value' });
    expect(generator.llmClient.generate).toHaveBeenCalledTimes(1);
  });

  it('首次失败第二次成功时应重试', async () => {
    const generator = new CoreLayerGenerator();
    generator.llmClient.generate = vi.fn()
      .mockResolvedValueOnce('invalid json')
      .mockResolvedValueOnce('{"test": "value"}');

    const result = await generator.callLLMWithRetry('test prompt', {}, 3);
    expect(result).toEqual({ test: 'value' });
    expect(generator.llmClient.generate).toHaveBeenCalledTimes(2);
  });

  it('达到最大重试次数应返回 null', async () => {
    const generator = new CoreLayerGenerator();
    generator.llmClient.generate = vi.fn().mockResolvedValue('always invalid');

    const result = await generator.callLLMWithRetry('test prompt', {}, 3);
    expect(result).toBeNull();
    expect(generator.llmClient.generate).toHaveBeenCalledTimes(3);
  });
});
```

**Step 5: 运行测试验证**

Run: `cd server && npm test -- tests/unit/v2/coreLayerGenerator.test.js --run`
Expected: All tests pass

**Step 6: 提交更改**

```bash
git add server/src/modules/rolecard/v2/coreLayerGenerator.js server/tests/unit/v2/coreLayerGenerator.test.js
git commit -m "feat: add JSON parsing retry mechanism to CoreLayerGenerator"
```

---

## Task 3: 在 RelationLayerGenerator 中添加 JSON 解析重试机制

**Files:**
- Modify: `server/src/modules/rolecard/v2/relationLayerGenerator.js`
- Test: `server/tests/unit/v2/relationLayerGenerator.test.js`

**Step 1: 添加 callLLMWithRetry 方法**

在 `relationLayerGenerator.js` 的 `parseJsonResponse` 方法后添加（与 CoreLayerGenerator 相同的方法）：

```javascript
/**
 * 带 JSON 解析重试的 LLM 调用
 * @param {string} prompt - 提示词
 * @param {Object} options - LLM 选项
 * @param {number} maxRetries - 最大重试次数
 * @returns {Promise<Object|null>} 解析后的 JSON 对象
 */
async callLLMWithRetry(prompt, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await this.llmClient.generate(prompt, options);
      const parsed = this.parseJsonResponse(response);

      if (parsed) {
        if (attempt > 1) {
          profileLogger.info(`JSON 解析重试成功`, { attempt });
        }
        return parsed;
      }

      profileLogger.warn('JSON 解析失败，准备重试', {
        attempt,
        maxRetries,
        responsePreview: typeof response === 'string' ? response.substring(0, 100) : 'object'
      });
    } catch (error) {
      profileLogger.error('LLM 调用失败', { attempt, error: error.message });
    }
  }

  profileLogger.error('JSON 解析重试次数用尽', { maxRetries });
  return null;
}
```

**Step 2: 修改 processOneAnswer 方法使用重试**

找到 `processOneAnswer` 方法（约第 288 行），修改为：

```javascript
async processOneAnswer(item, relationType, assistantName, specificRelation) {
  try {
    const prompt = buildPerAnswerRelationExtractionPrompt(
      item.questionText,
      item.answerText,
      item.significance,
      relationType,
      specificRelation
    );

    // 使用带重试的 LLM 调用
    const extracted = await this.callLLMWithRetry(prompt, {
      temperature: 0.3,
      maxTokens: 1000,
      responseFormat: 'json'
    });

    if (extracted && extracted.extractedFields) {
      for (const [fieldName, content] of Object.entries(extracted.extractedFields)) {
        if (content && this.fieldFragments[fieldName]) {
          this.fieldFragments[fieldName].push({
            content,
            sourceQuestionId: item.questionId,
            confidence: extracted.confidence || 'medium'
          });
        }
      }
    }

  } catch (error) {
    profileLogger.error('处理单条答案失败', {
      questionId: item.questionId,
      error: error.message
    });
  }
}
```

**Step 3: 修改 compressAllFields 方法使用重试**

找到 `compressAllFields` 方法中的 try 块，修改 LLM 调用：

```javascript
const compressed = await this.callLLMWithRetry(prompt, {
  temperature: 0.3,
  maxTokens: tokenTarget + 100,
  responseFormat: 'json'
});
```

**Step 4: 修改 determineTrustLevel 方法使用重试**

```javascript
async determineTrustLevel(relationType, specificRelation, intimacyLevel, compressedFields) {
  try {
    const prompt = buildTrustLevelAnalysisPrompt(
      relationType,
      specificRelation,
      intimacyLevel,
      compressedFields
    );

    // 使用带重试的 LLM 调用
    const result = await this.callLLMWithRetry(prompt, {
      temperature: 0.2,
      maxTokens: 500,
      responseFormat: 'json'
    });

    if (result && result.trustLevel) {
      const validLevels = ['tier1_intimate', 'tier2_close', 'tier3_familiar', 'tier4_acquaintance'];
      if (validLevels.includes(result.trustLevel)) {
        profileLogger.info('LLM 信任等级分析结果', {
          trustLevel: result.trustLevel,
          confidence: result.confidence,
          reasoning: result.reasoning
        });
        return result.trustLevel;
      }
    }

    // 回退到规则判断
    return this.fallbackTrustLevel(intimacyLevel, relationType);

  } catch (error) {
    profileLogger.error('LLM 信任等级分析失败，使用回退逻辑', { error: error.message });
    return this.fallbackTrustLevel(intimacyLevel, relationType);
  }
}
```

**Step 5: 添加单元测试**

在 `relationLayerGenerator.test.js` 中添加：

```javascript
describe('callLLMWithRetry()', () => {
  beforeEach(() => {
    generator = new RelationLayerGenerator();
  });

  it('首次成功时应返回解析结果', async () => {
    generator.llmClient.generate = vi.fn().mockResolvedValue('{"test": "value"}');

    const result = await generator.callLLMWithRetry('test prompt', {});
    expect(result).toEqual({ test: 'value' });
    expect(generator.llmClient.generate).toHaveBeenCalledTimes(1);
  });

  it('达到最大重试次数应返回 null', async () => {
    generator.llmClient.generate = vi.fn().mockResolvedValue('always invalid');

    const result = await generator.callLLMWithRetry('test prompt', {}, 3);
    expect(result).toBeNull();
    expect(generator.llmClient.generate).toHaveBeenCalledTimes(3);
  });
});
```

**Step 6: 运行测试验证**

Run: `cd server && npm test -- tests/unit/v2/relationLayerGenerator.test.js --run`
Expected: All tests pass

**Step 7: 提交更改**

```bash
git add server/src/modules/rolecard/v2/relationLayerGenerator.js server/tests/unit/v2/relationLayerGenerator.test.js
git commit -m "feat: add JSON parsing retry mechanism to RelationLayerGenerator"
```

---

## Task 4: 前端改用 SSE 接口生成角色卡

**Files:**
- Modify: `web/app/rolecard/page.tsx`

**Step 1: 修改 handleGenerateRoleCard 方法**

找到 `handleGenerateRoleCard` 函数（约第 142 行），替换为：

```typescript
const handleGenerateRoleCard = async () => {
  if (!user?._id) return

  try {
    setGenerating(true)
    setRelationStats(undefined)
    setGenerateProgress({
      current: 0,
      total: 7,
      message: '开始生成角色卡...'
    })

    // 获取 token
    const token = localStorage.getItem('token')
    if (!token) {
      throw new Error('未登录')
    }

    // 使用 SSE 接口
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/rolecard/generate/stream`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      throw new Error('请求失败')
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let currentEventType = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmedLine = line.trim()

        if (trimmedLine.startsWith('event: ')) {
          currentEventType = trimmedLine.substring(7).trim()
        } else if (trimmedLine.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmedLine.substring(6).trim())

            if (currentEventType === 'progress') {
              // 更新进度
              setGenerateProgress({
                current: data.step || 0,
                total: data.total || 7,
                message: data.message || '处理中...'
              })
            } else if (currentEventType === 'done') {
              // 生成完成
              if (data.success && data.data?.roleCard) {
                setRoleCard(data.data.roleCard)
                if (data.data.relationStats) {
                  setRelationStats(data.data.relationStats)
                }
                setGenerateProgress({
                  current: 7,
                  total: 7,
                  message: '生成完成！'
                })

                setTimeout(() => {
                  setGenerateProgress(undefined)
                  fetchData() // 重新获取数据
                }, 2000)
              }
            } else if (currentEventType === 'error') {
              throw new Error(data.error || '生成失败')
            }
          } catch (parseError) {
            console.error('[RolecardPage] JSON 解析失败:', parseError)
          }

          currentEventType = ''
        }
      }
    }

  } catch (error) {
    console.error('生成角色卡失败:', error)
    const errorMessage = error instanceof Error ? error.message : '生成角色卡失败，请重试'
    alert(errorMessage)
    setGenerateProgress(undefined)
  } finally {
    setGenerating(false)
  }
}
```

**Step 2: 添加 useEffect 日志调试（可选，可稍后移除）**

在现有的 useEffect 后添加：

```typescript
useEffect(() => {
  console.log('[RolecardPage] roleCard 状态变化:', roleCard ? '已加载' : '未加载')
}, [roleCard])
```

**Step 3: 测试前端更改**

1. 打开浏览器访问 `http://localhost:3002/rolecard`
2. 确保已登录测试账户
3. 点击"生成角色卡"按钮
4. 验证进度实时显示（如"核心层提取中: 1/70"）
5. 验证生成完成后角色卡详情正确显示

**Step 4: 提交更改**

```bash
git add web/app/rolecard/page.tsx
git commit -m "feat: use SSE endpoint for rolecard generation with real-time progress"
```

---

## Task 5: 集成测试和验证

**Step 1: 重启 Docker 服务**

```bash
cd F:/FPY/AFS-System
docker compose up -d server web
```

**Step 2: 运行完整测试套件**

Run: `cd server && npm test -- tests/unit/v2/ --run`
Expected: All tests pass

**Step 3: 端到端测试**

使用测试账户 `dxs@gmail.com` / `123456`：

1. 登录系统
2. 进入角色卡页面
3. 点击"生成角色卡"
4. 验证进度显示正确
5. 验证生成完成后角色卡详情显示
6. 验证关系层生成成功（3 个协助者）

**Step 4: 检查日志**

```bash
docker logs afs-system-server-1 2>&1 | grep -E "collectAssistantAnswers|callLLMWithRetry|信任等级" | tail -30
```

**Step 5: 最终提交**

```bash
git add -A
git commit -m "fix: rolecard generation fixes - SSE progress, assistant query, JSON retry"
```

---

## 验收清单

- [ ] 前端能正确显示已生成的角色卡详情
- [ ] SSE 进度实时更新（显示如"处理答案 1/70"）
- [ ] 协助者答案能正确检测（不再显示"答案不足，跳过"）
- [ ] JSON 解析失败时自动重试（日志中可见重试记录）
- [ ] 所有单元测试通过
- [ ] 端到端测试通过
