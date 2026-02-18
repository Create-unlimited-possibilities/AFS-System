# 角色卡功能修复设计方案

## 概述

修复角色卡生成相关的 4 个问题：
1. 前端无法检测已生成的角色卡
2. SSE 进度无法正确显示
3. 协助者答案检测逻辑错误
4. JSON 解析失败无重试机制

## 问题分析

### 问题 1 & 2：前端检测和进度展示

**现状**：前端使用普通 API `/rolecard/generate`，无实时进度反馈

**根因**：SSE 接口 `/rolecard/generate/stream` 已实现但前端未使用

**解决方案**：前端改用 SSE 接口，实时接收进度并更新 UI

### 问题 3：协助者答案检测逻辑

**现状**：代码使用 `questionId.layer === 'B'` 或 `'C'` 过滤

**根因**：数据库结构不匹配
- 代码期望 `layer` 值为 `B`/`C`
- 实际 `layer` 值为 `basic`/`emotional`
- B/C 套题实际通过 `role` 字段区分：`family`/`friend`

**解决方案**：修改查询条件使用 `questionId.role` 字段

### 问题 4：JSON 解析重试

**现状**：LLM 生成 JSON 时有 ~10% 概率格式错误，解析失败直接跳过

**解决方案**：在解析失败时重试 LLM 调用（最多 3 次）

## 设计方案

### 1. 前端 SSE 集成

**文件**: `web/app/rolecard/page.tsx`

**修改内容**:
- 将 `handleGenerateRoleCard` 改为使用 SSE 接口
- 使用 `fetch` + `ReadableStream` 接收进度事件
- 实时更新进度状态
- 生成完成后自动刷新数据

**SSE 事件格式**:
```
event: progress
data: { step, total, stage, message, percentage, detail? }

event: done
data: { success, data: { roleCard, relationStats } }

event: error
data: { success: false, error, stage }
```

### 2. 协助者答案查询修复

**文件**: `server/src/modules/rolecard/v2/relationLayerGenerator.js`

**修改内容**:
```javascript
// collectAssistantAnswers 方法

// 修改前
const targetLayer = relationType === 'family' ? 'B' : 'C';
.filter(a => a.questionId && a.questionId.layer === targetLayer)

// 修改后
const targetRole = relationType === 'family' ? 'family' : 'friend';
.filter(a => a.questionId && a.questionId.role === targetRole)
```

### 3. JSON 解析重试机制

**文件**:
- `server/src/modules/rolecard/v2/coreLayerGenerator.js`
- `server/src/modules/rolecard/v2/relationLayerGenerator.js`

**新增方法**:
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
        return parsed;
      }

      profileLogger.warn('JSON 解析失败，准备重试', {
        attempt,
        maxRetries,
        responsePreview: response?.substring(0, 100)
      });
    } catch (error) {
      profileLogger.error('LLM 调用失败', { attempt, error: error.message });
    }
  }

  profileLogger.error('JSON 解析重试次数用尽', { maxRetries });
  return null;
}
```

**修改位置**:
- `processOneAnswer` - 答案提取
- `compressAllFields` - 字段压缩
- `determineTrustLevel` - 信任等级分析

## 实施计划

### 阶段 1：后端修复
1. 修复 `relationLayerGenerator.js` 中的协助者答案查询
2. 在 `coreLayerGenerator.js` 中添加重试机制
3. 在 `relationLayerGenerator.js` 中添加重试机制

### 阶段 2：前端修复
1. 修改 `rolecard/page.tsx` 使用 SSE 接口
2. 实现进度事件解析和状态更新
3. 处理完成和错误事件

### 阶段 3：测试验证
1. 单元测试更新
2. 端到端测试
3. 回归测试

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| SSE 连接中断 | 用户看不到进度 | 添加超时和重连机制 |
| 重试增加 LLM 调用 | 成本增加 | 限制最大重试次数为 3 |
| 数据库结构变化 | 查询失败 | 添加日志和错误处理 |

## 验收标准

- [ ] 前端能正确显示角色卡详情
- [ ] SSE 进度实时更新（如"处理答案 1/70"）
- [ ] 协助者答案能正确检测并生成关系层
- [ ] JSON 解析失败时自动重试（最多 3 次）
