# AFS System 未来开发路线图

> ⚠️ **注意**: 此文档仅限本地可见，不推送到 GitHub

## 短期计划 (v2.1)

### 1. 陌生人关系演化机制

**背景**: 目前陌生人与角色卡对话时，关系始终停留在 tier4_acquaintance，缺乏关系发展机制。

**目标**: 实现"陌生人→朋友→密友"的关系演化路径。

**实现方案**:

```
对话进行中
    │
    ├── 累积 Token 计数
    ├── 追踪情感倾向 (sentiment 分析)
    ├── 记录共同话题频率
    └── 检测关系升级信号
            │
            ▼
    ┌─────────────────┐
    │ 是否满足升级条件？ │
    └────────┬────────┘
             │
        ┌────┴────┐
        │         │
       是        否
        │         │
        ▼         │
  触发关系升级     │
  - 重新生成关系层  │
  - 更新信任等级    │
  - 通知用户       │
        │         │
        └────┬────┘
             │
             ▼
       继续对话
```

**升级条件**:
| 条件 | 阈值 | 说明 |
|------|------|------|
| Token 累积 | 5000+ | 足够的互动量 |
| 正面情感比例 | > 70% | 对话氛围良好 |
| 话题深度 | 中等+ | 超过寒暄层面 |
| 时间跨度 | > 7 天 | 非短期接触 |

**数据结构**:
```javascript
// 动态关系演化追踪
{
  relationshipEvolution: {
    strangerId: 'xxx',
    currentTier: 'tier4_acquaintance',
    evolutionProgress: {
      tokensAccumulated: 3500,
      positiveSentimentRatio: 0.75,
      topicsDiscussed: ['健康', '天气', '生活'],
      firstContactAt: '2026-02-01',
      lastContactAt: '2026-02-16'
    },
    upgradeThreshold: {
      nextTier: 'tier3_familiar',
      tokensNeeded: 5000,
      readyToUpgrade: false
    }
  }
}
```

**API 端点**:
- `GET /api/relationship/evolution/:strangerId` - 获取关系演化进度
- `POST /api/relationship/evolution/:strangerId/upgrade` - 手动触发升级
- `GET /api/relationship/evolution/status` - 获取所有陌生人关系状态

**优先级**: 🔴 高

---

### 2. `generateGroupSafetyPrompt` 参与者信任等级过滤

**状态**: ✅ 已完成 (2026-02-16)

**修复内容**:
- 新增 `calculateGroupTrustLevels()` 方法
- 新增 `getLowestTrustLevel()` 方法
- 新增 `shouldApplyRule()` 方法
- 群组对话现在根据参与者信任等级动态过滤安全规则

---

### 3. `traitsToVector` 空值处理

**状态**: ✅ 已完成 (2026-02-16)

**修复内容**:
- 添加 `null`/`undefined` 防御性处理
- 确保缺少 `personalityTraits` 时不会崩溃

---

## 中期计划 (v2.2)

### 1. 关系层动态更新

**目标**: 允许用户手动更新关系层，或基于新对话自动微调。

**功能**:
- 手动编辑关系层内容
- 基于对话反馈自动微调
- 关系层版本控制

### 2. 校准层完整实现

**目标**: 实现校准层的完整逻辑。

**功能**:
- 学习样本收集与加权
- 漂移检测与自动校准
- 校准历史可视化

### 3. 多语言角色卡

**目标**: 支持生成多语言版本的角色卡。

**功能**:
- 自动翻译角色卡内容
- 语言偏好设置
- 跨语言对话适配

---

## 长期计划 (v3.0)

### 1. 多角色卡系统

**目标**: 支持一个用户拥有多个"人格面具"。

**功能**:
- 工作人格 / 家庭人格 / 社交人格
- 按场景自动切换
- 人格之间的一致性管理

### 2. 家族图谱

**目标**: 可视化家庭关系网络。

**功能**:
- 关系图谱可视化
- 家族历史记录
- 代际传承模拟

### 3. AI 主动记忆强化

**目标**: AI 主动发起记忆巩固对话。

**功能**:
- 主动询问重要事件细节
- 记忆模糊时请求确认
- 记忆重要性自动评估

---

## 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|---------|
| 2026-02-16 | v2.0.1 | 修复 safetyGuardrails 和 calibrationLayer 的 bug |
| 2026-02-15 | v2.0.0 | V2 角色卡系统重构完成 |
