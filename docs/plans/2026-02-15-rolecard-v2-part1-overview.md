# 角色卡系统 V2 重构 - 第1部分：项目概述

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构角色卡系统，删除旧的 A/B 生成方法，建立新的分层角色卡架构

**Architecture:** 分层设计 - 核心层(内我) + 关系层(外我) + 安全护栏 + 校准层 + 动态组装器

**Tech Stack:** Node.js, MongoDB, LangGraph, MultiLLMClient

---

## 重构范围

### 删除文件
- `server/src/modules/rolecard/generators/generatorA.js` - 旧的A方法生成器
- `server/src/modules/rolecard/generators/generatorB.js` - 旧的B方法生成器
- `server/src/modules/rolecard/preprocessor.js` - 旧的协助者准则预处理器

### 修改文件
- `server/src/modules/rolecard/controller.js` - 更新生成逻辑
- `server/src/modules/rolecard/config.js` - 更新配置
- `server/src/modules/chat/assembler.js` - 替换为新的动态组装器
- `server/src/modules/chat/nodes/roleCardAssemble.js` - 更新节点逻辑
- `server/src/core/storage/dual.js` - 扩展存储方法

### 新建文件
- `server/src/modules/rolecard/v2/coreLayerGenerator.js` - 核心层生成器
- `server/src/modules/rolecard/v2/relationLayerGenerator.js` - 关系层生成器
- `server/src/modules/rolecard/v2/safetyGuardrails.js` - 安全护栏配置
- `server/src/modules/rolecard/v2/calibrationLayer.js` - 校准层
- `server/src/modules/rolecard/v2/promptAssembler.js` - 动态Prompt组装器
- `server/src/modules/rolecard/v2/dynamicDataFetcher.js` - 动态数据获取
- `server/src/modules/rolecard/v2/prompts/coreExtraction.js` - 核心层提取Prompt
- `server/src/modules/rolecard/v2/prompts/relationExtraction.js` - 关系层提取Prompt

---

## 数据结构定义

### 新的角色卡结构 (RoleCardV2)

```javascript
{
  version: '2.0.0',
  userId: String,

  // 核心层 - 来自A套题
  coreLayer: {
    personalityTraits: {
      boundaryThickness: 'thick' | 'medium' | 'thin',
      discretionLevel: 'excellent' | 'good' | 'moderate' | 'poor',
      impulsiveSpeech: 'rare' | 'occasional' | 'often' | 'frequent',
      emotionalExpression: 'reserved' | 'moderate' | 'expressive',
      socialCautiousness: 'high' | 'moderate' | 'low'
    },
    behavioralIndicators: [{
      trigger: String,
      response: String,
      confidence: 'high' | 'medium' | 'low',
      sourceQuestionIds: [String]
    }],
    communicationStyle: {
      tonePattern: String,
      preferredTopics: [String],
      avoidedTopics: [String],
      humorStyle: 'none' | 'light' | 'moderate' | 'heavy',
      verbosity: 'concise' | 'moderate' | 'elaborate'
    },
    selfPerception: {
      selfDescriptionKeywords: [String],
      coreValues: [String],
      lifePriorities: [String]
    }
  },

  // 关系层集合 - 来自B/C套题
  relationLayers: {
    [relationId]: {
      assistant: { id, name, uniqueCode },
      relation: { type, specific, intimacyLevel, duration },
      conversationGuidance: {
        assistantPersonality: String,
        suggestedAttitude: String,
        suggestedTone: String,
        personalityToDisplay: String,
        topicTendencies: { preferred: [], avoid: [] },
        communicationNotes: [String]
      },
      perceivedByAssistant: {
        personalityDescription: String,
        strengths: [String],
        weaknesses: [String],
        communicationPatterns: [String],
        sharedSecrets: [String]
      },
      disclosureControl: {
        permission: 'full' | 'trusted' | 'selective' | 'guarded' | 'minimal',
        allowedTopics: [String],
        forbiddenTopics: [String],
        customRules: [{ rule, reason }]
      },
      sharedMemories: [{
        id, content, type, sentiment, timeReference, importance
      }]
    }
  },

  // 安全护栏
  safetyGuardrails: {
    rules: [{
      id, type: 'hard' | 'soft',
      topic: { category, keywords, description },
      allowedAudience: { trustLevels, specificRelations, excludeRelations },
      action: { type, redirectHint, vagueTemplate },
      priority: Number, enabled: Boolean
    }],
    defaultRuleSet: 'strict' | 'balanced' | 'open',
    groupSettings: { autoStrictMode, defaultDisclosureLevel, conflictResolution }
  },

  // 校准层
  calibration: {
    baseline: { traitVector, behavioralIndicators, generatedAt },
    currentState: { traitVector, lastUpdatedAt, totalConversations, totalTokens },
    calibrationConfig: {
      tokenCountThreshold: 10000,
      maxCalibrationIntervalDays: 14,
      sampleDecayHalfLife: 7,
      learningWeight: 0.1
    }
  },

  generatedAt: Date,
  updatedAt: Date
}
```

---

## 实施计划分部

| 部分 | 文件 | 内容 |
|------|------|------|
| Part 1 | rolecard-v2-part1-overview.md | 项目概述和架构（本文档）|
| Part 2 | rolecard-v2-part2-core-layer.md | 核心层生成器实现 |
| Part 3 | rolecard-v2-part3-relation-layer.md | 关系层生成器实现 |
| Part 4 | rolecard-v2-part4-safety-calibration.md | 安全护栏和校准层实现 |
| Part 5 | rolecard-v2-part5-assembler.md | 动态组装器和LangGraph集成 |

---

## 执行顺序

1. **先阅读 Part 2** - 创建核心层生成器和提取Prompt
2. **再阅读 Part 3** - 创建关系层生成器
3. **然后 Part 4** - 实现安全护栏和校准层
4. **最后 Part 5** - 实现动态组装器，替换现有代码
5. **删除旧文件** - 清理 generatorA.js, generatorB.js, preprocessor.js

---

## 参考资源

- [Big Five人格提取研究](https://arxiv.org/html/2512.17639v2)
- [LLM人格建模调查](https://aclanthology.org/2025.findings-emnlp.506.pdf)
- [Profile-LLM动态优化](https://arxiv.org/html/2511.19852v1)
