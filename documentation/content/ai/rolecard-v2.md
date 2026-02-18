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

### 1. 核心层生成器 (CoreLayerGenerator) V2

从 A 套问答（自我认知）中提取用户的内在人格特质，采用**逐条提取 + 逐字段压缩**的架构。

**文件位置**: `server/src/modules/rolecard/v2/coreLayerGenerator.js`

#### 处理流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    核心层生成流程                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐                                                │
│  │  用户个人档案 │ ──► basicIdentity (基础身份)                   │
│  └─────────────┘                                                │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ A套答案 #1  │    │ A套答案 #2  │    │ A套答案 #N  │          │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              LLM 逐条提取 (串行处理)                   │       │
│  │  每个答案 → 提取到多个字段 → 收集为片段                 │       │
│  └─────────────────────────────────────────────────────┘       │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              字段片段收集                             │       │
│  │  personality: [片段1, 片段2, ...]                     │       │
│  │  values: [片段1, 片段2, ...]                         │       │
│  │  memories: [片段1, 片段2, ...]                       │       │
│  │  ...                                                │       │
│  └─────────────────────────────────────────────────────┘       │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              LLM 逐字段压缩 (串行处理)                 │       │
│  │  每个字段 → 压缩为连贯描述 + 提取要点                  │       │
│  └─────────────────────────────────────────────────────┘       │
│                              │                                  │
│                              ▼                                  │
│                   最终核心层 JSON                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 字段定义

| 字段名 | 描述 | 目标 Token | 数据来源 |
|--------|------|-----------|----------|
| `basicIdentity` | 基础身份信息（姓名、年龄、性别、职业等） | 150 | 用户个人档案 |
| `personality` | 性格特质描述 | 400 | LLM 提取 |
| `communicationStyle` | 沟通风格（语气、语速、习惯用语） | 200 | LLM 提取 |
| `backgroundStory` | 背景故事/人生经历 | 500 | LLM 提取 |
| `lifeMilestones` | 人生里程碑/重要事件 | 300 | LLM 提取 |
| `interests` | 兴趣爱好 | 200 | LLM 提取 |
| `preferences` | 偏好（喜欢/讨厌的事物） | 200 | LLM 提取 |
| `values` | 价值观 | 250 | LLM 提取 |
| `emotionalNeeds` | 情感需求 | 250 | LLM 提取 |
| `memories` | 重要回忆 | 300 | LLM 提取 |
| `selfPerception` | 自我认知/自我描述 | 250 | LLM 提取 |

**总 Token 预算**: 约 3000 tokens

#### 输出结构

```typescript
interface CoreLayerV2 {
  version: string;           // "2.1.0"
  generatedAt: string;       // ISO 时间戳
  userId: string;

  // 基础身份（来自个人档案）
  basicIdentity: {
    raw: {
      name: string;
      gender: string;
      age: number | null;
      birthPlace: object;
      residence: object;
      occupation: string;
      education: string;
      maritalStatus: string;
      children: object;
    };
    summary: string;         // 自然语言摘要
  };

  // LLM 提取的字段（每个字段结构相同）
  personality: {
    keyPoints: string[];     // 要点数组
    summary: string;         // 压缩后的自然语言描述
    sourceCount: number;     // 来源片段数量
    sourceQuestionIds: string[];
  };
  communicationStyle: { /* 同上 */ };
  backgroundStory: { /* 同上 */ };
  lifeMilestones: { /* 同上 */ };
  interests: { /* 同上 */ };
  preferences: { /* 同上 */ };
  values: { /* 同上 */ };
  emotionalNeeds: { /* 同上 */ };
  memories: { /* 同上 */ };
  selfPerception: { /* 同上 */ };

  metadata: {
    sourceAnswerCount: number;
    sourceQuestionIds: string[];
    extractionModel: string;
    compressionModel: string;
  };
}
```

#### 存储位置

- **MongoDB**: 通过 RoleCardV2 模型存储
- **文件系统**: `server/storage/userdata/{userId}/core-layer.json`

#### 生成流程详解

##### 步骤 1：获取用户个人档案

从用户资料中提取基础身份信息，生成自然语言摘要。

**输入**：用户个人档案（profile）
**输出**：`basicIdentity` 字段

```javascript
// 输入示例
{
  name: "张明",
  gender: "男",
  birthDate: "1985-03-15",
  residence: { cityName: "北京" },
  occupation: "软件工程师",
  maritalStatus: "已婚",
  children: { sons: 1, daughters: 0 }
}

// 输出示例
{
  raw: { /* 原始数据 */ },
  summary: "张明，男，40岁，软件工程师，现居北京，已婚，育有1子。"
}
```

##### 步骤 2：收集 A 套答案

获取用户回答自己的问题（`isSelfAnswer: true`），每个答案包含：
- 问题文本
- 问题设计意义（significance）
- 用户回答

```javascript
// 答案结构
{
  answerId: "answer_001",
  questionId: "q_001",
  questionText: "描述一个让你感到自豪的时刻",
  significance: "探索自我价值感和成就感来源",
  answerText: "去年我独立完成了一个重要项目..."
}
```

##### 步骤 3：逐条提取（串行处理）

对每个答案调用 LLM，提取到多个字段。

**LLM Prompt 结构**：

```
你是一个专业的人格分析专家。请分析用户的回答，提取相关信息填入对应字段。

## 问题信息
**问题**: {question}
**设计意义**: {significance}

## 用户回答
{answer}

## 可填写的字段
- personality: 性格特质描述
- communicationStyle: 沟通风格（语气、语速、习惯用语等）
- backgroundStory: 背景故事/人生经历
...

## 任务
1. 理解问题的设计意义
2. 分析用户回答的内容
3. 将提取的信息填入最合适的字段（可填多个字段）

## 输出格式（严格JSON）
{
  "extractedFields": {
    "personality": "提取的内容或 null",
    ...
  },
  "confidence": "high|medium|low"
}
```

**提取示例**：

```
输入问题: "描述一个让你感到自豪的时刻"
输入答案: "去年我独立完成了一个重要项目，虽然过程很艰难，但最终得到了领导的认可。"

LLM 输出:
{
  "extractedFields": {
    "personality": "有毅力，能够独立承担挑战性任务",
    "lifeMilestones": "去年独立完成重要项目并获认可",
    "selfPerception": "通过努力获得认可是重要的成就来源"
  },
  "confidence": "high"
}
```

##### 步骤 4：收集字段片段

所有答案处理完毕后，每个字段收集到多个片段：

```javascript
fieldFragments = {
  personality: [
    { content: "有毅力，能够独立承担挑战性任务", sourceQuestionId: "q_001" },
    { content: "做事认真负责，追求完美", sourceQuestionId: "q_003" },
    { content: "性格内向但乐于助人", sourceQuestionId: "q_007" }
  ],
  values: [
    { content: "重视家庭和谐", sourceQuestionId: "q_002" },
    { content: "认为诚信是做人的根本", sourceQuestionId: "q_005" }
  ],
  // ... 其他字段
}
```

##### 步骤 5：逐字段压缩（串行处理）

对每个字段的所有片段进行压缩，生成连贯描述 + 提取要点。

**压缩 Prompt 结构**：

```
你是一个文本压缩专家。请将以下多个片段压缩为一个连贯的描述。

## 字段类型
personality: 性格特质描述

## 目标长度
约 400 个中文字符

## 待压缩的片段
片段1: 有毅力，能够独立承担挑战性任务
片段2: 做事认真负责，追求完美
片段3: 性格内向但乐于助人

## 压缩要求
1. 保留所有重要信息，去除重复内容
2. 合并相似的观点和描述
3. 保持描述的连贯性和自然性

## 输出格式（严格JSON）
{
  "compressed": "压缩后的完整描述",
  "keyPoints": ["要点1", "要点2", "要点3"]
}
```

**压缩结果示例**：

```javascript
{
  keyPoints: [
    "做事有毅力，能独立承担挑战",
    "认真负责，追求完美",
    "性格内向但乐于助人"
  ],
  summary: "张明是一个有毅力的人，能够独立承担挑战性任务。做事认真负责，追求完美。虽然性格内向，但乐于帮助他人。",
  sourceCount: 3,
  sourceQuestionIds: ["q_001", "q_003", "q_007"]
}
```

##### 步骤 6：组装最终核心层

将所有字段组合成完整的核心层 JSON，并进行双重存储。

### 2. 关系层生成器 (RelationLayerGenerator) V2

从 B 套（家人视角）和 C 套（朋友视角）问答中提取关系信息，为每个协助者生成独立的关系层文件。

**文件位置**: `server/src/modules/rolecard/v2/relationLayerGenerator.js`

#### 处理流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    关系层生成流程                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────┐        │
│  │           获取所有协助关系                          │        │
│  │   根据 specificRelation 自动分类为家人/朋友         │        │
│  └────────────────────────────────────────────────────┘        │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐            │
│         ▼                    ▼                    ▼            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │ 协助者 #1   │    │ 协助者 #2   │    │ 协助者 #N   │         │
│  │ (父亲-B套)  │    │ (朋友-C套)  │    │ (配偶-B套)  │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘        │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │         LLM 逐条提取 (串行处理，每个协助者独立)       │       │
│  └─────────────────────────────────────────────────────┘       │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │         LLM 逐字段压缩 (根据关系类型选择字段集)        │       │
│  │   • 家人关系 → 共同字段(9) + 家人专属字段(5)          │       │
│  │   • 朋友关系 → 共同字段(9) + 朋友专属字段(5)          │       │
│  └─────────────────────────────────────────────────────┘       │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │relation-1.json│   │relation-2.json│   │relation-N.json│     │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 关系类型自动分类

系统根据 `specificRelation` 字段自动判断关系类型：

**家人关键词**：父亲、母亲、爸爸、妈妈、儿子、女儿、兄弟、姐妹、哥哥、弟弟、姐姐、妹妹、爷爷、奶奶、外公、外婆、叔叔、阿姨、舅舅、舅妈、丈夫、妻子、老公、老婆、亲人、家人、长辈、晚辈、亲戚

**朋友关键词**：其他关系默认为朋友类型

#### 字段定义

##### 共同字段（家人 + 朋友通用，共 9 个）

| 字段名 | 描述 | 目标 Token |
|--------|------|-----------|
| `relationshipBasis` | 关系基础（如何认识、关系演变过程、相识背景） | 200 |
| `sharedMemories` | 共同回忆/经历（一起经历过的重要事件、难忘时刻） | 300 |
| `interactionPatterns` | 互动模式（相处方式、见面频率、交流习惯） | 200 |
| `communicationStyle` | 沟通风格（与该协助者特有的沟通方式、语言习惯） | 200 |
| `emotionalBond` | 情感纽带（情感连接深度、亲密度、情感表达方式） | 200 |
| `mutualInfluence` | 相互影响（对彼此的影响、改变、启发） | 200 |
| `supportDynamics` | 支持动态（如何互相支持、帮助方式、依赖程度） | 200 |
| `perceivedTraits` | 协助者眼中的目标用户特质（性格、优点、特点） | 250 |
| `topicsAndInterests` | 话题与兴趣（常聊的话题、共同兴趣、讨论内容） | 200 |

##### 家人专属字段（仅家人关系，共 5 个）

| 字段名 | 描述 | 目标 Token |
|--------|------|-----------|
| `familyRole` | 家庭角色（在家庭中的角色定位、职责、地位） | 150 |
| `intergenerationalImpact` | 代际影响（对成长的影响、价值观传承、人生指导） | 250 |
| `familyTraditions` | 家庭传统（习俗、仪式、节日活动、特别习惯） | 200 |
| `careAndGuidance` | 关怀与指导（给予的建议、照顾方式、教导内容） | 200 |
| `familyValues` | 家庭价值观（共同看重的价值、信念、原则） | 200 |

##### 朋友专属字段（仅朋友关系，共 5 个）

| 字段名 | 描述 | 目标 Token |
|--------|------|-----------|
| `socialRole` | 社交角色（在朋友圈中的角色、定位、影响力） | 150 |
| `friendshipHistory` | 友谊历史（相识过程、友谊发展阶段、重要节点） | 200 |
| `socialActivities` | 社交活动（共同参与的活动、聚会方式、娱乐形式） | 200 |
| `groupDynamics` | 群体动态（在群体中的互动方式、冲突处理、合作模式） | 200 |
| `trustAndLoyalty` | 信任与忠诚（可靠程度、承诺履行、信任基础） | 150 |

**家人关系总 Token**: 约 2900 tokens (9×200 + 5×200 平均)
**朋友关系总 Token**: 约 2900 tokens

#### 输出结构

```typescript
interface RelationLayerV2 {
  version: string;           // "2.1.0"
  generatedAt: string;
  userId: string;            // 目标用户ID
  relationId: string;        // 协助关系ID
  assistantId: string;       // 协助者ID
  assistantName: string;

  // 关系元信息
  relationMeta: {
    specificRelation: string;  // 具体关系（如：父亲、朋友）
    relationType: 'family' | 'friend';
    isFamily: boolean;
    isFriend: boolean;
    intimacyLevel: 'intimate' | 'close' | 'moderate' | 'distant';
  };

  // 共同字段（每个字段结构相同）
  relationshipBasis: {
    keyPoints: string[];
    summary: string;
    sourceCount: number;
    sourceQuestionIds: string[];
  };
  sharedMemories: { /* 同上 */ };
  interactionPatterns: { /* 同上 */ };
  communicationStyle: { /* 同上 */ };
  emotionalBond: { /* 同上 */ };
  mutualInfluence: { /* 同上 */ };
  supportDynamics: { /* 同上 */ };
  perceivedTraits: { /* 同上 */ };
  topicsAndInterests: { /* 同上 */ };

  // 家人专属字段（仅家人关系）
  familyRole?: { /* 同上 */ };
  intergenerationalImpact?: { /* 同上 */ };
  familyTraditions?: { /* 同上 */ };
  careAndGuidance?: { /* 同上 */ };
  familyValues?: { /* 同上 */ };

  // 朋友专属字段（仅朋友关系）
  socialRole?: { /* 同上 */ };
  friendshipHistory?: { /* 同上 */ };
  socialActivities?: { /* 同上 */ };
  groupDynamics?: { /* 同上 */ };
  trustAndLoyalty?: { /* 同上 */ };

  metadata: {
    sourceAnswerCount: number;
    sourceQuestionIds: string[];
    extractionModel: string;
    compressionModel: string;
  };
}
```

#### 亲密度评估

系统根据以下字段的来源片段数量自动评估亲密度：

| 亲密度 | 条件 | 说明 |
|--------|------|------|
| `intimate` | sharedMemories + emotionalBond + supportDynamics ≥ 6 | 非常亲密，无话不谈 |
| `close` | 同上 ≥ 4 | 关系亲近 |
| `moderate` | 同上 ≥ 2 | 关系一般 |
| `distant` | 同上 < 2 | 关系较疏远 |

#### 存储位置

每个协助者生成独立的 JSON 文件：

```
server/storage/userdata/{userId}/relation-layers/
├── {relationId-1}.json    # 协助者1的关系层
├── {relationId-2}.json    # 协助者2的关系层
└── {relationId-N}.json    # 协助者N的关系层
```

#### 生成流程详解

##### 步骤 1：获取所有协助关系

从 `AssistRelation` 集合获取目标用户的所有协助者，并自动分类关系类型。

```javascript
// 输入：userId
// 查询：AssistRelation.find({ targetId: userId })

// 结果示例
relations = [
  { _id: "rel_001", assistantId: "user_002", specificRelation: "父亲", relationshipType: "family" },
  { _id: "rel_002", assistantId: "user_003", specificRelation: "大学同学", relationshipType: "friend" }
]
```

**关系类型自动判断**：
- 检测到家人关键词（父亲、母亲等）→ `family`
- 其他关系 → `friend`

##### 步骤 2：为每个协助者收集答案

根据关系类型选择对应的题目集：

| 关系类型 | 题目集 | 说明 |
|---------|-------|------|
| 家人 | B 套 | 关于家庭关系、成长经历的问题 |
| 朋友 | C 套 | 关于友谊、社交互动的问题 |

```javascript
// 查询条件
{
  userId: assistantId,      // 协助者回答
  targetUserId: userId,     // 关于目标用户
  isSelfAnswer: false,      // 不是自答
  questionLayer: 'B' 或 'C' // 根据关系类型
}
```

##### 步骤 3：逐条提取（串行处理）

对每个答案调用 LLM，根据关系类型使用不同的字段集。

**家人关系的 LLM Prompt**：

```
你是一个专业的关系分析专家。请分析协助者对目标用户的回答...

## 关系类型
家人

## 协助者信息
- 姓名: {assistantName}
- 关系: {specificRelation}

## 问题信息
**问题**: {question}
**设计意义**: {significance}

## 协助者回答
{answer}

## 可填写的字段
// 共同字段
- relationshipBasis: 关系基础（如何认识、关系演变过程）
- sharedMemories: 共同回忆/经历
- interactionPatterns: 互动模式
- communicationStyle: 沟通风格
- emotionalBond: 情感纽带
- mutualInfluence: 相互影响
- supportDynamics: 支持动态
- perceivedTraits: 协助者眼中的目标用户特质
- topicsAndInterests: 话题与兴趣

// 家人专属字段
- familyRole: 家庭角色
- intergenerationalImpact: 代际影响
- familyTraditions: 家庭传统
- careAndGuidance: 关怀与指导
- familyValues: 家庭价值观

## 任务
1. 理解问题的设计意义
2. 分析协助者回答中透露的目标用户信息
3. 将提取的信息填入最合适的字段
4. 注意：这是协助者视角下对目标用户的看法和描述

## 输出格式（严格JSON）
{
  "extractedFields": {
    "perceivedTraits": "提取的内容或 null",
    "sharedMemories": "提取的内容或 null",
    ...
  },
  "confidence": "high|medium|low"
}
```

**提取示例**：

```
输入问题: "你觉得他/她小时候是个什么样的孩子？"
输入答案: "他小时候就很懂事，学习从来不让我们操心，还很照顾弟弟妹妹。"
协助者: 父亲

LLM 输出:
{
  "extractedFields": {
    "perceivedTraits": "从小懂事、自律、有责任心，善于照顾家人",
    "familyRole": "家中长子，承担照顾弟妹的责任",
    "intergenerationalImpact": "从小养成的自律习惯影响了他的性格发展"
  },
  "confidence": "high"
}
```

##### 步骤 4：收集字段片段

所有答案处理完毕后，每个字段收集到多个片段（与核心层相同机制）。

##### 步骤 5：逐字段压缩（串行处理）

根据关系类型选择对应的字段集进行压缩：

- **家人关系**：压缩 14 个字段（9 共同 + 5 家人专属）
- **朋友关系**：压缩 14 个字段（9 共同 + 5 朋友专属）

##### 步骤 6：评估亲密度

根据关键字段的来源片段数量自动评估：

```javascript
// 计算方式
totalDepth = sharedMemories.sourceCount +
             emotionalBond.sourceCount +
             supportDynamics.sourceCount

// 评估结果
if (totalDepth >= 6) return 'intimate'
if (totalDepth >= 4) return 'close'
if (totalDepth >= 2) return 'moderate'
return 'distant'
```

##### 步骤 7：LLM 分析信任等级

根据复杂关系层的完整数据，由 LLM 智能判断信任等级。

**信任等级定义**：

| 等级 | 名称 | 说明 | 典型关系 |
|-----|------|------|---------|
| `tier1_intimate` | 最亲密 | 可分享所有私密信息 | 配偶、父母子女、多年挚友 |
| `tier2_close` | 亲近 | 可分享大部分个人事务 | 兄弟姐妹、好朋友 |
| `tier3_familiar` | 一般熟悉 | 有限度的信息分享 | 普通朋友、同事、邻居 |
| `tier4_acquaintance` | 疏远/陌生人 | 仅分享基本公共信息 | 点头之交、陌生人 |

**LLM Prompt 结构**：

```
你是一个关系分析专家。请根据以下关系层数据，判断这个关系的信任等级。

## 关系基本信息
- 关系类型: 家人
- 具体关系: 父亲
- 亲密度评估: 亲密

## 关系层数据摘要
【共同回忆】
小时候他总是照顾弟弟妹妹，学习从不让我们操心...

【情感纽带】
父子感情很深，他会主动和我分享心事...

【支持动态】
遇到困难会互相帮助，他会征求我的意见...

## 分析要点
1. 重点关注：sharedMemories、emotionalBond、supportDynamics
2. 考虑关系的深度和广度
3. 不要仅根据关系称谓判断，要根据实际互动内容

## 输出格式（严格JSON）
{
  "trustLevel": "tier1_intimate",
  "confidence": "high",
  "reasoning": "父子关系，有深度情感连接和长期信任历史"
}
```

**分析示例**：

```
输入：
- specificRelation: "父亲"
- emotionalBond.summary: "父子感情很深，他会主动和我分享心事"
- supportDynamics.summary: "遇到困难会互相帮助"

LLM 输出:
{
  "trustLevel": "tier1_intimate",
  "confidence": "high",
  "reasoning": "父子关系，有深度情感连接和相互依赖"
}
```

##### 步骤 8：组装并存储

为每个协助者生成独立的 JSON 文件：

```javascript
// 最终输出示例
{
  version: "2.1.0",
  generatedAt: "2026-02-17T10:30:00Z",
  userId: "target_user_001",
  relationId: "rel_001",
  assistantId: "user_002",
  assistantName: "张父",

  // 关系元信息（简单关系层，始终加载）
  relationMeta: {
    specificRelation: "父亲",
    relationType: "family",
    isFamily: true,
    isFriend: false,
    intimacyLevel: "intimate",
    trustLevel: "tier1_intimate"  // LLM 分析的信任等级
  },

  // 复杂关系层字段（可选加载）
  relationshipBasis: {
    keyPoints: ["父子关系", "从小一起生活"],
    summary: "张父是目标用户的父亲，两人从小一起生活...",
    sourceCount: 3,
    sourceQuestionIds: ["q_b01", "q_b05", "q_b12"]
  },
  // ... 其他字段
}
```

### 3. 安全护栏 (SafetyGuardrails) V2

保护群体对话中的隐私边界，采用**信任等级智能判断**机制。

**文件位置**: `server/src/modules/rolecard/v2/safetyGuardrails.js`

**配置文件**: `server/storage/safety-rules.json`

#### 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    安全护栏 V2 架构                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │           全局安全规则配置文件                        │       │
│  │   server/storage/safety-rules.json                  │       │
│  │   - 信任等级定义                                     │       │
│  │   - 话题限制规则                                     │       │
│  │   - 群组设置                                         │       │
│  └─────────────────────────────────────────────────────┘       │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │           关系层中的 trustLevel                       │       │
│  │   由 LLM 根据复杂关系层数据智能分析                   │       │
│  │   存储 relationMeta.trustLevel                       │       │
│  └─────────────────────────────────────────────────────┘       │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │           安全护栏管理器                              │       │
│  │   - 读取全局规则配置                                  │       │
│  │   - 获取群组最低信任等级                              │       │
│  │   - 生成安全提示词                                    │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 信任等级定义

| 等级 | 名称 | 描述 | 特征 |
|-----|------|------|------|
| `tier1_intimate` | 最亲密 | 可分享所有私密信息 | 深度情感连接、长期信任历史、相互依赖 |
| `tier2_close` | 亲近 | 可分享大部分个人事务 | 较强的情感连接、经常交流、相互支持 |
| `tier3_familiar` | 一般熟悉 | 有限度的信息分享 | 有互动但不深入、了解表面信息 |
| `tier4_acquaintance` | 疏远/陌生人 | 仅分享基本公共信息 | 互动很少或不了解、没有深入交流 |

#### 规则类型

| 类型 | 说明 | 处理方式 |
|------|------|---------|
| **硬性规则** | 绝对禁止违反 | `block`（完全禁止）、`redirect`（转移话题）、`vague_response`（模糊回应） |
| **软性规则** | 需谨慎处理 | `vague_response`（模糊回应） |

#### 默认规则

| ID | 类型 | 话题 | 允许等级 | 处理方式 |
|---|------|-----|---------|---------|
| hard_001 | 硬性 | 夫妻私密关系 | tier1 | 完全禁止 |
| hard_002 | 硬性 | 财务数字 | tier1 | 模糊回应："关于钱的事，家里有安排的" |
| hard_003 | 硬性 | 家庭矛盾 | tier1, tier2 | 转移话题 |
| soft_001 | 软性 | 健康问题 | tier1, tier2, tier3 | 模糊回应："年纪大了，小毛病是难免的" |
| soft_002 | 软性 | 失败经历 | tier1, tier2 | 模糊回应 |

#### 工作流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    安全护栏工作流程                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  步骤 1：获取群组参与者的 trustLevel                              │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  从 relationMeta.trustLevel 直接读取                  │       │
│  │  父亲 → tier1_intimate                                │       │
│  │  朋友 → tier3_familiar                                │       │
│  └─────────────────────────────────────────────────────┘       │
│                              │                                  │
│                              ▼                                  │
│  步骤 2：计算群组最低信任等级                                     │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  [tier1, tier3] → 最低是 tier3_familiar              │       │
│  └─────────────────────────────────────────────────────┘       │
│                              │                                  │
│                              ▼                                  │
│  步骤 3：过滤需要应用的规则                                       │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  规则要求 tier1，但群组最低是 tier3                   │       │
│  │  → 规则要求 > 群组最低 → 应用该规则                   │       │
│  └─────────────────────────────────────────────────────┘       │
│                              │                                  │
│                              ▼                                  │
│  步骤 4：生成安全提示词                                          │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  生成 Markdown 格式的安全约束说明                     │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 配置文件结构

```javascript
// server/storage/safety-rules.json
{
  "version": "1.0.0",
  "trustLevelDefinitions": {
    "tier1_intimate": {
      "name": "最亲密",
      "description": "可以分享所有私密信息",
      "characteristics": ["深度情感连接", "长期信任历史"]
    },
    // ... 其他等级
  },
  "rules": [
    {
      "id": "rule_hard_001",
      "type": "hard",
      "topic": {
        "category": "intimate_relations",
        "keywords": ["性生活", "夫妻亲密"],
        "description": "夫妻/伴侣间的私密关系细节"
      },
      "allowedAudience": { "trustLevels": ["tier1_intimate"] },
      "action": { "type": "block", "redirectHint": "转移到家庭日常话题" },
      "priority": 100,
      "enabled": true
    },
    // ... 其他规则
  ],
  "groupSettings": {
    "autoStrictMode": true,
    "defaultDisclosureLevel": "lowest_common",
    "conflictResolution": "block_content"
  }
}
```

#### 输出示例

当群组包含 [父亲(tier1), 朋友(tier3)] 时：

```markdown
## 🔒 安全约束（群组模式激活）

### 当前群组信任等级
最低信任等级：**一般熟悉**

### 话题限制
以下话题在当前群组中受到限制，请严格遵守：

**夫妻/伴侣间的私密关系细节**
- 敏感关键词：性生活、夫妻亲密、床第、性关系
- 处理方式：完全不可讨论
- 转移方向：转移到家庭日常话题

**具体的财务数字和财产细节**
- 敏感关键词：存款数额、具体收入、债务金额
- 处理方式：如被问及，请模糊回应
- 模糊回应模板："关于钱的事，家里有安排的"

### 群组隐私原则
1. 假设群组中的任何信息都可能被传播
2. 不要分享任何只对其中部分人透露过的私密信息
3. 如果不确定某话题是否适合，宁可不提
4. 遇到敏感话题时，自然地转移到安全话题
```

### 4. 校准层 (CalibrationLayer) V2

检测角色卡属性随时间/经历的变化，提醒用户更新校准。

**文件位置**: `server/src/modules/rolecard/v2/calibrationLayer.js`

**核心作用**：

随着记忆和对话的积累，分析角色卡属性是否有实质性改变：
- 性格变化
- 价值观变化
- 沟通方式变化
- 生活状态变化

若有变化，提醒用户对角色卡进行更新校准。

#### 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    校准层 V2 架构                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              记忆系统（依赖模块）                      │       │
│  │   • 对话记录                                         │       │
│  │   • 记忆压缩摘要                                     │       │
│  │   • 关键事件提取                                     │       │
│  └─────────────────────────────────────────────────────┘       │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              漂移分析器                               │       │
│  │   • 收集近期记忆摘要                                  │       │
│  │   • 与角色卡各字段对比                                │       │
│  │   • LLM 智能判断变化程度                              │       │
│  └─────────────────────────────────────────────────────┘       │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              校准决策                                 │       │
│  │   • 无显著变化 → 继续监测                             │       │
│  │   • 有显著变化 → 触发用户提醒                         │       │
│  └─────────────────────────────────────────────────────┘       │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              用户提醒                                 │       │
│  │   • 通知：角色卡需要更新                              │       │
│  │   • 入口：一键重新生成角色卡                          │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 检测维度

| 维度 | 角色卡字段 | 检测内容 |
|-----|----------|---------|
| 性格 | `personality` | 性格特质是否发生变化 |
| 价值观 | `values` | 价值观念是否有调整 |
| 沟通风格 | `communicationStyle` | 交流方式是否改变 |
| 生活状态 | `basicIdentity` | 职业、居住地等是否变化 |
| 情感需求 | `emotionalNeeds` | 情感关注点是否转移 |

#### 触发条件

| 条件 | 说明 |
|------|------|
| 对话数量累积 | 累计对话达到一定数量后触发分析 |
| 时间间隔 | 距上次校准超过一定时间 |
| 关键事件 | 检测到重大生活事件（如职业变动） |
| 用户主动 | 用户主动请求校准检查 |

#### 校准流程

```
记忆系统积累
      │
      ▼
  定期/触发分析
      │
      ├── 收集近期记忆摘要
      ├── 提取关键变化点
      └── 与角色卡各字段对比
      │
      ▼
┌───────────────┐
│ 是否有显著变化？│
└───────┬───────┘
        │
   ┌────┴────┐
   │         │
  是        否
   │         │
   ▼         │
生成变化报告  │
   │         │
   ▼         │
提醒用户     │
   │         │
   ▼         │
用户确认更新  │
   │         │
   └────┬────┘
        │
        ▼
   继续监测
```

#### 变化检测示例

**LLM 分析 Prompt 结构**：

```
你是一个角色分析专家。请分析以下记忆内容，判断用户是否有显著变化。

## 角色卡当前描述
【性格】{personality.summary}
【价值观】{values.summary}
【沟通风格】{communicationStyle.summary}

## 近期记忆摘要（过去30天）
{recentMemorySummary}

## 分析任务
1. 对比记忆内容与角色卡描述
2. 判断是否有显著变化（非临时性波动）
3. 变化是否值得更新角色卡

## 输出格式（JSON）
{
  "hasSignificantChange": true/false,
  "changeAreas": ["personality", "values", ...],
  "changeDetails": [
    {
      "field": "personality",
      "originalSummary": "...",
      "observedChange": "...",
      "significance": "high/medium/low"
    }
  ],
  "recommendation": "建议用户更新角色卡的原因"
}
```

#### 输出示例

当检测到显著变化时，生成的变化报告：

```json
{
  "hasSignificantChange": true,
  "changeAreas": ["values", "emotionalNeeds"],
  "changeDetails": [
    {
      "field": "values",
      "originalSummary": "重视家庭和谐，认为诚信是做人的根本",
      "observedChange": "近期对话中更多谈及事业发展，对工作成就的重视度明显提升",
      "significance": "medium"
    },
    {
      "field": "emotionalNeeds",
      "originalSummary": "需要家人的理解和支持",
      "observedChange": "表达出更多对个人空间和自我实现的渴望",
      "significance": "high"
    }
  ],
  "recommendation": "用户的价值观和情感需求有明显变化，建议更新角色卡以更准确反映当前状态"
}
```

#### 与其他模块的关系

| 模块 | 关系 |
|-----|------|
| 记忆系统 | 依赖 - 提供记忆数据用于分析 |
| Token 限制管理 | 独立 - 防止单次对话AI漂移 |
| 核心层/关系层生成器 | 调用 - 重新生成角色卡时使用 |

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

### 获取各层生成状态

```http
GET /api/rolecard/layers/status
Authorization: Bearer <token>
```

**响应**:

```json
{
  "success": true,
  "data": {
    "hasCoreLayer": true,
    "coreGeneratedAt": "2026-02-19T10:30:00Z",
    "relations": [
      {
        "relationId": "rel_001",
        "assistantName": "父亲",
        "hasLayer": true,
        "generatedAt": "2026-02-19T10:35:00Z"
      },
      {
        "relationId": "rel_002",
        "assistantName": "大学同学",
        "hasLayer": false,
        "generatedAt": null
      }
    ]
  }
}
```

### 核心层单独生成 (SSE)

```http
POST /api/rolecard/core/stream
Authorization: Bearer <token>
```

**SSE 事件流**:

```
event: progress
data: {"step": 1, "total": 3, "message": "正在提取核心层特征..."}

event: progress
data: {"step": 2, "total": 3, "message": "正在压缩字段..."}

event: done
data: {"success": true, "data": {"coreLayer": {...}}}
```

### 关系层单独生成 (SSE)

```http
POST /api/rolecard/relation/:relationId/stream
Authorization: Bearer <token>
```

**SSE 事件流**:

```
event: progress
data: {"step": 1, "total": 5, "message": "正在分析关系..."}

event: done
data: {"success": true, "data": {"relationLayer": {...}}}
```

### 批量生成关系层 (SSE)

```http
POST /api/rolecard/batch/stream
Authorization: Bearer <token>
```

**SSE 事件流**:

```
event: progress
data: {"step": 1, "total": 3, "message": "正在生成 父亲 的关系层..."}

event: progress
data: {"step": 2, "total": 3, "message": "正在生成 母亲 的关系层..."}

event: done
data: {"success": true, "data": {"stats": {"success": 2, "failed": 0}}}
```

### 获取向量索引状态

```http
GET /api/rolecard/vector-index/status
Authorization: Bearer <token>
```

## 文件存储

V2 角色卡采用**分层独立存储**策略，每个层独立存储为 JSON 文件：

```
server/storage/
├── safety-rules.json           # 全局安全规则配置
└── userdata/
    └── {userId}/
        ├── core-layer.json         # 核心层
        ├── profile.json            # 用户资料
        └── relation-layers/        # 关系层目录
            ├── {relationId-1}.json # 协助者1的关系层
            ├── {relationId-2}.json # 协助者2的关系层
            └── {relationId-N}.json # 协助者N的关系层
```

### 各层职责

| 文件 | 职责 | 加载时机 |
|-----|------|---------|
| `core-layer.json` | 用户的内在特质、自我认知 | 始终加载 |
| `relation-layers/*.json` | 每个协助者的关系信息 | 根据对话参与者按需加载 |
| `safety-rules.json` | 全局安全护栏规则 | 群组对话时加载 |

### LangGraph 组装策略

```
┌─────────────────────────────────────────────────────────────────┐
│                    LangGraph 组装流程                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 加载核心层                                                  │
│     └── core-layer.json → 身份定位、性格特质                     │
│                                                                 │
│  2. 加载关系层（简单部分）                                       │
│     └── relationMeta → trustLevel、intimacyLevel                 │
│     └── 用于安全护栏判断                                         │
│                                                                 │
│  3. 判断是否群组对话                                            │
│     ├── 是 → 加载安全规则 → 生成安全提示词                       │
│     └── 否 → 跳过安全护栏                                       │
│                                                                 │
│  4. 加载关系层（复杂部分，可选）                                 │
│     └── sharedMemories、emotionalBond 等                         │
│     └── 用于丰富对话内容                                         │
│                                                                 │
│  5. 组装 System Prompt                                         │
│     └── 身份 + 关系 + 指引 + 安全                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
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
3. **存储位置**: V2 采用分层存储（`core-layer.json` + `relation-layers/*.json`）

### V1 → V2 字段映射

| V1 字段 | V2 对应 | 说明 |
|--------|--------|------|
| `personality` | `coreLayer.personality.summary` | 枚举值改为自然语言描述 |
| `background` | `coreLayer.backgroundStory.summary` | 背景故事独立字段 |
| `interests` | `coreLayer.interests.keyPoints` | 兴趣爱好独立字段 |
| `communicationStyle` | `coreLayer.communicationStyle.summary` | 沟通风格独立字段 |
| `values` | `coreLayer.values.summary` | 价值观独立字段 |
| `emotionalNeeds` | `coreLayer.emotionalNeeds.summary` | 情感需求独立字段 |
| `lifeMilestones` | `coreLayer.lifeMilestones.keyPoints` | 人生里程碑独立字段 |
| `preferences` | `coreLayer.preferences.keyPoints` | 个人偏好独立字段 |

### 已移除的 V1 组件

| 组件 | 说明 |
|-----|------|
| `personalityTraits` 枚举 | 改为自然语言的 `personality` 字段 |
| `behavioralIndicators` | 整合到各字段的 `keyPoints` |
| `prompts/coreExtraction.js` | 已删除，使用 V2 版本 |
| `prompts/relationExtraction.js` | 已删除，使用 V2 版本 |

## 配置选项

### 默认校准配置 V2

```javascript
const DEFAULT_CALIBRATION_CONFIG = {
  // 触发条件
  minConversationCount: 20,      // 最少对话数量触发分析
  analysisIntervalDays: 14,      // 分析间隔（天）

  // 变化判定阈值
  significanceThreshold: 'medium', // 变化显著程度阈值
  minConsistencyCount: 3,          // 连续出现才认定为变化

  // 提醒设置
  reminderCooldownDays: 7,         // 提醒冷却期（天）

  // 分析维度
  analysisFields: [
    'personality',
    'values',
    'communicationStyle',
    'emotionalNeeds'
  ]
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
    ├── coreLayerGenerator.js    # 核心层生成器 V2
    ├── relationLayerGenerator.js # 关系层生成器 V2
    ├── safetyGuardrails.js      # 安全护栏 V2
    ├── calibrationLayer.js      # 校准层 V2
    ├── dynamicDataFetcher.js    # 动态数据获取器 V2
    ├── promptAssembler.js       # Prompt 组装器 V2
    └── prompts/
        ├── coreExtractionV2.js  # 核心层提取 Prompt V2
        └── relationExtractionV2.js # 关系层提取 Prompt V2
```

## 更新日志

### v2.3.0 (2026-02-19) 🎉 里程碑版本

**角色卡生成功能完善 - 重大里程碑**

本版本标志着角色卡 V2 系统的核心功能已完全实现，用户可以完整地生成、管理和更新角色卡。

#### 新增功能

**1. 管理角色卡弹窗 (RegenerateModal)**
- 可视化管理界面，支持单独重新生成各层
- SSE 实时进度显示
- 一键生成全部未生成的关系层
- 状态指示：已生成/未生成/生成中

**2. SSE 流式生成 API**
- `POST /api/rolecard/generate/stream` - 完整生成（SSE）
- `POST /api/rolecard/core/stream` - 核心层单独生成（SSE）
- `POST /api/rolecard/relation/:relationId/stream` - 关系层单独生成（SSE）
- `POST /api/rolecard/batch/stream` - 批量生成未生成关系层（SSE）
- `GET /api/rolecard/layers/status` - 获取各层生成状态

**3. 关系层详情弹窗**
- 查看每个关系的完整详情
- 展示所有字段：共同回忆、情感纽带、互动模式等
- 亲密程度中文翻译（疏远/一般/亲近/亲密）

**4. 帮助提示系统**
- 关系层分类说明（帮助图标 + 弹窗）
- 安全护栏功能说明（帮助图标 + 弹窗）
- 信任等级定义说明

**5. 生成按钮优化**
- 已有角色卡时禁用"生成角色卡"按钮
- Tooltip 提示引导用户使用"管理角色卡"功能
- 防止重复生成

#### 修复问题

- 修复 specificRelation 默认值问题（家人关系错误显示"朋友"）
- 修复关系层只显示一个的 bug（合并独立关系层文件）
- 修复 memoryTokenCount 显示为 0 的问题（从 User 模型合并数据）
- 修复 CORS 预检请求问题
- 修复浏览器缓存导致数据不刷新（添加 Cache-Control 头）
- 修复亲密程度显示英文问题（添加中文翻译）

#### 用户体验优化

- 移除敏感数据的 console.log 输出
- 增加 44px 最小触摸区域（帮助图标）
- 导航守卫防止未保存数据丢失
- SSE 进度实时反馈

#### 新增文件

```
web/app/rolecard/components/
├── RegenerateModal.tsx           # 管理角色卡弹窗
├── RelationLayerDetailModal.tsx  # 关系层详情弹窗
├── RelationHelpPopover.tsx       # 关系层帮助提示
└── SafetyGuardrailsHelpPopover.tsx # 安全护栏帮助提示

web/components/
├── NavigationGuardContext.tsx    # 导航守卫

server/src/modules/rolecard/v2/prompts/
├── coreExtractionV2.js           # 核心层 V2 Prompt
└── relationExtractionV2.js       # 关系层 V2 Prompt
```

### v2.2.1 (2026-02-17)

#### 代码清理与修复

**删除的文件**：
- `v2/prompts/coreExtraction.js` - 旧版 V1 Prompt（已废弃）
- `v2/prompts/relationExtraction.js` - 旧版 V1 Prompt（已废弃）

**修复的问题**：
- Controller 异步调用缺失 `await`（安全护栏获取）
- Controller V1/V2 字段映射错误（MongoDB 兼容层）
- PromptAssembler 清理不再使用的 V1 TraitLanguageConverter

**存储策略更新**：
- 改为分层独立存储（`core-layer.json` + `relation-layers/*.json`）
- 保留完整角色卡作为备份

### v2.2.0 (2026-02-17)

#### 校准层 V2 重构

校准层完全重构，适配 V2 数据结构，实现基于记忆分析的角色卡漂移检测。

**核心变更**：
- 移除 V1 字段依赖（`personalityTraits`、`behavioralIndicators`）
- 改用 LLM 智能分析近期记忆与角色卡的对比
- 检测维度：性格、价值观、沟通风格、情感需求、生活状态
- 新增用户提醒机制

**配置变更**：

| 旧配置 | 新配置 | 说明 |
|-------|-------|------|
| `tokenThreshold: 100000` | `minConversationCount: 20` | 改用对话数量触发 |
| `timeThresholdDays: 30` | `analysisIntervalDays: 14` | 分析间隔 |
| `driftThreshold: 0.3` | `significanceThreshold: 'medium'` | 改用语义分析 |
| `decayFactor: 0.95` | 移除 | 不再使用数值衰减 |

**依赖模块**：
- 记忆系统（待实现）：提供记忆数据用于分析

### v2.1.0 (2026-02-17)

#### 架构重构：逐条提取 + 逐字段压缩

核心层和关系层生成器采用全新的处理架构，解决旧架构 token 溢出问题。

**旧架构问题**：
- 一次性将所有答案传入 LLM，容易超出 token 限制
- 输出质量不稳定，难以控制每个字段的长度

**新架构优势**：
- **逐条提取**：每个答案单独处理，提取到多个字段
- **逐字段压缩**：收集所有片段后，按字段独立压缩
- **Token 可控**：每个字段有独立的目标 token 数
- **质量稳定**：分步处理，每步专注单一任务

#### 核心层 V2 变更

**新增字段**：
| 字段 | 描述 | 目标 Token |
|------|------|-----------|
| `basicIdentity` | 基础身份（来自个人档案） | 150 |
| `personality` | 性格特质 | 400 |
| `backgroundStory` | 背景故事 | 500 |
| `lifeMilestones` | 人生里程碑 | 300 |
| `interests` | 兴趣爱好 | 200 |
| `preferences` | 偏好 | 200 |
| `values` | 价值观 | 250 |
| `emotionalNeeds` | 情感需求 | 250 |
| `memories` | 重要回忆 | 300 |
| `selfPerception` | 自我认知 | 250 |

**移除字段**：
- `personalityTraits` (枚举值) → 改为自然语言的 `personality`
- `behavioralIndicators` → 整合到各字段

**存储变更**：
- 新增独立文件：`core-layer.json`

#### 关系层 V2 变更

**新增共同字段（9个）**：
- `relationshipBasis`、`sharedMemories`、`interactionPatterns`
- `communicationStyle`、`emotionalBond`、`mutualInfluence`
- `supportDynamics`、`perceivedTraits`、`topicsAndInterests`

**新增家人专属字段（5个）**：
- `familyRole`、`intergenerationalImpact`、`familyTraditions`
- `careAndGuidance`、`familyValues`

**新增朋友专属字段（5个）**：
- `socialRole`、`friendshipHistory`、`socialActivities`
- `groupDynamics`、`trustAndLoyalty`

**移除字段**：
- `conversationGuidance` → 拆分为多个字段
- `perceivedByAssistant` → 改为 `perceivedTraits`
- `disclosureControl` → 整合到各字段

**存储变更**：
- 每个协助者独立文件：`relation-layers/{relationId}.json`

#### 新增 Prompt 文件

```
server/src/modules/rolecard/v2/prompts/
├── coreExtractionV2.js     # 核心层 V2 Prompt
└── relationExtractionV2.js # 关系层 V2 Prompt
```

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

