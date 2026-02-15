---
sidebar_position: 2
---

# 角色卡系统 V2

## 概述

角色卡系统 V2 采用**分层架构**设计，基于 CPM（Communication Privacy Management）理论和自我呈现理论，将用户画像分为核心层和关系层，实现更精细的个性化对话体验。

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    V2 角色卡系统架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   A 套问答   │    │  B 套问答   │    │  C 套问答   │      │
│  │  (自我认知)  │    │ (家人视角)  │    │ (朋友视角)  │      │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                  │             │
│         ▼                  └────────┬─────────┘             │
│  ┌─────────────┐                    │                       │
│  │   核心层     │                    ▼                       │
│  │ CoreLayer   │           ┌─────────────┐                 │
│  │             │           │   关系层     │                 │
│  │ • 人格特质   │           │ RelationLayer│                │
│  │ • 沟通风格   │           │             │                 │
│  │ • 自我认知   │           │ • 对话准则   │                 │
│  │ • 价值观    │           │ • 印象管理   │                 │
│  └──────┬──────┘           │ • 信息披露   │                 │
│         │                  └──────┬──────┘                 │
│         │                         │                         │
│         └────────────┬────────────┘                         │
│                      ▼                                      │
│         ┌────────────────────────┐                         │
│         │      安全护栏           │                         │
│         │  SafetyGuardrails      │                         │
│         │                        │                         │
│         │ • 硬性规则 (群体隐私)    │                         │
│         │ • 软性规则 (信息披露)    │                         │
│         └───────────┬────────────┘                         │
│                     │                                       │
│                     ▼                                       │
│         ┌────────────────────────┐                         │
│         │      校准层             │                         │
│         │  CalibrationLayer      │                         │
│         │                        │                         │
│         │ • Token 阈值触发        │                         │
│         │ • 时间衰减触发          │                         │
│         │ • 漂移距离计算          │                         │
│         └───────────┬────────────┘                         │
│                     │                                       │
│                     ▼                                       │
│         ┌────────────────────────┐                         │
│         │    动态组装器           │                         │
│         │  DynamicAssembler      │                         │
│         │                        │                         │
│         │ • 特征→语言转换         │                         │
│         │ • 关系层按需加载        │                         │
│         │ • System Prompt 生成   │                         │
│         └────────────────────────┘                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. 核心层生成器 (CoreLayerGenerator)

从 A 套问答中提取用户的内在人格特质。

**文件位置**: `server/src/modules/rolecard/v2/coreLayerGenerator.js`

**提取维度**:

| 特质 | 说明 | 来源问题示例 |
|------|------|-------------|
| `boundaryThickness` | 边界意识厚度 | 分享隐私的舒适度 |
| `discretionLevel` | 守密程度 | 保守秘密的倾向 |
| `impulsiveSpeech` | 冲动言语倾向 | 说话前的思考程度 |
| `emotionalExpression` | 情绪表达方式 | 表达情感的方式 |
| `socialCautiousness` | 社交谨慎度 | 在新环境中的表现 |

**输出结构**:

```typescript
interface CoreLayer {
  personalityTraits: {
    boundaryThickness: 'thin' | 'medium' | 'thick';
    discretionLevel: 'low' | 'medium' | 'high';
    impulsiveSpeech: 'rare' | 'occasional' | 'frequent';
    emotionalExpression: 'reserved' | 'moderate' | 'expressive';
    socialCautiousness: 'low' | 'medium' | 'high';
  };
  communicationStyle: {
    tonePattern: string;
    preferredTopics: string[];
    avoidedTopics: string[];
  };
  selfPerception: {
    coreValues: string[];
    lifePriorities: string[];
    selfDescription: string;
  };
}
```

### 2. 关系层生成器 (RelationLayerGenerator)

从 B/C 套问答中提取用户在不同关系中的外在表现。

**文件位置**: `server/src/modules/rolecard/v2/relationLayerGenerator.js`

**生成逻辑**:

```
B 套问答 (家人视角) ──► 家人关系层
                         ├── 配偶关系层
                         ├── 子女关系层
                         └── 兄弟姐妹关系层

C 套问答 (朋友视角) ──► 朋友关系层
                         ├── 密友关系层
                         └── 普通朋友关系层
```

**输出结构**:

```typescript
interface RelationLayer {
  relationId: string;
  relationType: 'family' | 'friend';
  intimacyLevel: 'close' | 'moderate' | 'distant';
  conversationGuidance: {
    topicsToEmphasize: string[];
    topicsToAvoid: string[];
    communicationStyle: string;
  };
  perceivedByAssistant: {
    traits: string[];
    role: string;
    emotionalBond: string;
  };
  disclosureControl: {
    allowedTopics: string[];
    restrictedTopics: string[];
  };
  sharedMemories: string[];
}
```

### 3. 安全护栏 (SafetyGuardrails)

保护群体对话中的隐私边界。

**文件位置**: `server/src/modules/rolecard/v2/safetyGuardrails.js`

**规则类型**:

| 类型 | 说明 | 示例 |
|------|------|------|
| **硬性规则** | 绝对禁止违反 | 不透露特定人的私密信息 |
| **软性规则** | 需谨慎处理 | 讨论敏感话题时保持模糊 |

**信任等级映射**:

```javascript
const RELATION_TRUST_LEVELS = {
  spouse: 5,      // 配偶 - 最高信任
  child: 4,       // 子女
  sibling: 3,     // 兄弟姐妹
  closeFriend: 3, // 密友
  friend: 2,      // 朋友
  acquaintance: 1, // 熟人
  stranger: 0     // 陌生人 - 最低信任
};
```

### 4. 校准层 (CalibrationLayer)

检测角色卡漂移并触发重新校准。

**文件位置**: `server/src/modules/rolecard/v2/calibrationLayer.js`

**触发条件**:

| 条件 | 默认阈值 | 说明 |
|------|---------|------|
| Token 累积 | 100,000 tokens | 对话消耗达到阈值 |
| 时间衰减 | 30 天 | 距上次校准超过阈值 |
| 漂移距离 | 0.3 | 行为偏离度过大 |

**校准流程**:

```
对话进行中
    │
    ├── 累积 Token 计数
    ├── 检查时间间隔
    └── 计算漂移距离
            │
            ▼
    ┌───────────────┐
    │ 是否需要校准？ │
    └───────┬───────┘
            │
       ┌────┴────┐
       │         │
      是        否
       │         │
       ▼         │
  触发校准任务    │
       │         │
       └────┬────┘
            │
            ▼
      继续对话
```

### 5. 动态数据获取器 (DynamicDataFetcher)

在对话时获取最新的用户数据。

**文件位置**: `server/src/modules/rolecard/v2/dynamicDataFetcher.js`

**数据优先级**:

```
关系层数据 > 对话者角色卡 > 默认数据
```

### 6. Prompt 组装器 (PromptAssembler)

将特征转换为自然语言并组装 System Prompt。

**文件位置**: `server/src/modules/rolecard/v2/promptAssembler.js`

**特征→语言转换示例**:

```javascript
// 特征值
boundaryThickness: 'thick'

// 转换为自然语言
"在分享个人信息时比较谨慎，需要建立信任后才会逐渐开放"
```

**组装结构**:

```
System Prompt
├── 身份定位 (Identity)
│   └── 基于核心层的自我认知
├── 关系上下文 (Relation)
│   └── 当前对话者的关系层信息
├── 对话指引 (Guidance)
│   └── 话题偏好、风格建议
└── 安全边界 (Safety)
    └── 群体对话隐私保护规则
```

## API 端点

### 生成 V2 角色卡

```http
POST /api/rolecard/generate
Authorization: Bearer <token>
```

**响应**:

```json
{
  "success": true,
  "data": {
    "roleCard": {
      "version": "2.0.0",
      "userId": "user123",
      "coreLayer": { ... },
      "relationLayers": { ... },
      "safetyGuardrails": { ... },
      "calibration": { ... }
    },
    "relationStats": {
      "success": 3,
      "failed": 0,
      "failures": []
    }
  }
}
```

### 获取角色卡

```http
GET /api/rolecard
Authorization: Bearer <token>
```

**响应** (V2 优先，兼容 V1):

```json
{
  "success": true,
  "roleCard": { ... },
  "version": "2.0.0"
}
```

### 更新角色卡

```http
PUT /api/rolecard
Authorization: Bearer <token>
Content-Type: application/json

{
  "coreLayer": {
    "communicationStyle": {
      "tonePattern": "温和、耐心"
    }
  }
}
```

### 重新生成关系层

```http
POST /api/rolecard/assistant/:assistantId/regenerate
Authorization: Bearer <token>
```

### 构建向量索引 (SSE)

```http
POST /api/rolecard/vector-index/build
Authorization: Bearer <token>
```

**SSE 事件流**:

```
event: progress
data: {"stage": "loading", "progress": 10}

event: progress
data: {"stage": "embedding", "progress": 50}

event: done
data: {"success": true, "totalVectors": 150}
```

### 获取向量索引状态

```http
GET /api/rolecard/vector-index/status
Authorization: Bearer <token>
```

## 文件存储

V2 角色卡采用双重存储策略：

```
server/storage/userdata/
└── {userId}/
    ├── rolecard-v2.json       # V2 角色卡
    ├── rolecard.json          # V1 角色卡 (兼容)
    ├── profile.json           # 用户资料
    └── relation-layers/       # 关系层目录
        ├── relation-1.json
        └── relation-2.json
```

## 与 LangGraph 集成

角色卡组装节点在 LangGraph 对话流程中的位置：

```
用户输入 → inputProcessor → relationConfirm
                                    │
                    ┌───────────────┘
                    │
                    ▼
           ┌─────────────────┐
           │ roleCardAssemble│  ◄── V2 组装器
           └────────┬────────┘
                    │
                    ▼
           ┌─────────────────┐
           │  ragRetriever   │
           └────────┬────────┘
                    │
                    ▼
               后续节点...
```

**组装器调用**:

```javascript
// server/src/modules/chat/nodes/roleCardAssemble.js
const assembler = new RoleCardAssemblerV2();
const result = await assembler.assembleDynamicRoleCard({
  targetUserId: userId,
  interlocutorUserId: interlocutor.id,
  sessionId: sessionId,
  assistantId: assistantId
});

state.systemPrompt = result.systemPrompt;
state.dynamicData = result.dynamicData;
```

## 迁移指南

### 从 V1 迁移到 V2

1. **数据兼容**: V2 会自动兼容 V1 角色卡
2. **重新生成**: 调用 `/api/rolecard/generate` 生成 V2 角色卡
3. **存储位置**: V2 角色卡存储在 `rolecard-v2.json`

### V1 → V2 字段映射

| V1 字段 | V2 对应 |
|--------|--------|
| `personality` | `coreLayer.personalityTraits` |
| `background` | `coreLayer.selfPerception.coreValues` |
| `interests` | `coreLayer.communicationStyle.preferredTopics` |
| `communicationStyle` | `coreLayer.communicationStyle.tonePattern` |
| `values` | `coreLayer.selfPerception.coreValues` |
| `emotionalNeeds` | `coreLayer.selfPerception.lifePriorities` |

## 配置选项

### 默认校准配置

```javascript
const DEFAULT_CALIBRATION_CONFIG = {
  tokenThreshold: 100000,     // Token 累积阈值
  timeThresholdDays: 30,      // 时间衰减阈值（天）
  driftThreshold: 0.3,        // 漂移距离阈值
  decayFactor: 0.95           // 指数衰减因子
};
```

### 默认安全规则

```javascript
const DEFAULT_GUARDRAIL_RULES = {
  hard: [
    {
      id: 'no_private_disclosure',
      description: '不透露特定人的私密信息',
      pattern: ['秘密', '隐私', '不能说']
    }
  ],
  soft: [
    {
      id: 'sensitive_topics',
      description: '敏感话题保持模糊',
      pattern: ['钱', '遗产', '家庭矛盾']
    }
  ]
};
```

## 理论基础

### CPM 理论 (Communication Privacy Management)

CPM 理论认为人们通过管理隐私边界来控制个人信息的流动：

- **边界厚度**: 决定信息流动的难易程度
- **边界所有权**: 决定谁可以共享信息
- **边界联动**: 不同关系中的边界协调

### 自我呈现理论 (Self-Presentation)

自我呈现理论解释人们如何在不同社交情境中展示不同的自我：

- **前台行为**: 在特定观众面前的表现
- **印象管理**: 控制他人对自己的印象
- **角色切换**: 根据关系类型调整行为

## 文件结构

```
server/src/modules/rolecard/
├── config.js                    # 配置文件
├── controller.js                # V2 控制器
├── route.js                     # 路由定义
└── v2/
    ├── index.js                 # 模块导出
    ├── coreLayerGenerator.js    # 核心层生成器
    ├── relationLayerGenerator.js # 关系层生成器
    ├── safetyGuardrails.js      # 安全护栏
    ├── calibrationLayer.js      # 校准层
    ├── dynamicDataFetcher.js    # 动态数据获取器
    ├── promptAssembler.js       # Prompt 组装器
    └── prompts/
        ├── coreExtraction.js    # 核心层提取 Prompt
        └── relationExtraction.js # 关系层提取 Prompt
```

## 更新日志

### v2.0.1 (2026-02-16)

#### 安全护栏增强

`SafetyGuardrailsManager` 新增群组信任等级过滤功能：

**新增方法**:

| 方法 | 说明 |
|------|------|
| `calculateGroupTrustLevels(participants)` | 计算群组中所有参与者的信任等级 |
| `getLowestTrustLevel(trustLevels)` | 获取群组中的最低信任等级 |
| `shouldApplyRule(ruleTrustLevels, lowestGroupTier)` | 判断规则是否应该在当前群组中应用 |

**行为变化**:

| 群组组成 | 之前 | 之后 |
|---------|------|------|
| 配偶 + 子女 | 应用所有硬性规则 | 不限制 tier1 专属话题 |
| 配偶 + 朋友 | 应用所有硬性规则 | 限制 tier1 专属话题 |
| 家人 + 陌生人 | 应用所有硬性规则 | 严格限制所有敏感话题 |

**安全规则动态过滤逻辑**:

```javascript
// 当群组中有低信任等级成员时，高信任等级专属话题需要被限制
// 例如：夫妻私密话题（tier1）在朋友（tier3）在场时会被限制
```

#### 校准层增强

`CalibrationLayerManager.traitsToVector()` 现在支持空值处理：

```javascript
// 修复前：traits 为 null 时会崩溃
// 修复后：自动使用默认值
traitsToVector(null)  // 返回 { boundaryThickness: 0.5, ... }
```

#### 1 对 1 对话说明

安全护栏**仅用于群组对话**（参与者 > 1 人）。

| 场景 | 安全规则 | 行为依据 |
|------|---------|---------|
| 仅与家人对话 | ❌ 不应用 | 关系层决定话题范围 |
| 仅与朋友对话 | ❌ 不应用 | 关系层决定话题范围 |
| 仅与陌生人对话 | ❌ 不应用 | 核心层的边界意识控制 |
| 混合群组对话 | ✅ 应用 | 最低共同信任等级原则 |

### v2.0.0 (2026-02-15)

- V2 角色卡系统重构完成
- 分层架构：核心层 + 关系层 + 安全护栏 + 校准层 + 动态组装器
- 基于 CPM 理论和自我呈现理论

