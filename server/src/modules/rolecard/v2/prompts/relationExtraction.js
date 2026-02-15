// server/src/modules/rolecard/v2/prompts/relationExtraction.js

/**
 * 关系层特征提取 Prompt 模板
 * 基于 Self-Presentation Theory（自我呈现理论）
 */

export const RELATION_LAYER_EXTRACTION_PROMPT = `你是一个人际关系分析专家。请根据问卷答案，分析目标用户在特定关系中的表现。

## 理论基础
基于 Self-Presentation Theory（自我呈现理论），分析用户在不同关系面前展示的不同人格侧面。

## 关系信息
- 关系类型: {relationType}
- 具体关系: {specificRelation}
- 协助者（回答问卷者）: {assistantName}
- 目标用户（被描述者）: {targetUserName}

## 问卷答案
{answers}

## 分析框架

### 1. 对话指导 (conversationGuidance)

**assistantPersonality**: 协助者的性格特点描述
- 用于让模型理解"正在和谁对话"

**suggestedAttitude**: 建议的态度
- 例如: "慈父般关怀"、"朋友般平等"、"长辈般尊重"

**suggestedTone**: 建议的语气
- 例如: "温和耐心"、"轻松幽默"、"正式尊重"

**personalityToDisplay**: 应该展现的性格侧面
- 例如: "展现作为父亲的权威和关爱"

**topicTendencies**:
- preferred: 倾向聊的话题
- avoid: 应该避免的话题

**communicationNotes**: 沟通注意事项列表

### 2. 协助者眼中的目标用户 (perceivedByAssistant)

**personalityDescription**: 整体性格描述（2-3句话）

**strengths**: 认为的优点（3-5个）

**weaknesses**: 认为的缺点/弱点（2-3个，诚实描述）

**communicationPatterns**: 沟通特点（3-5个）

**sharedSecrets**: 只有该协助者知道的事
- ⚠️ 非常重要：用于群组对话的隐私过滤

### 3. 披露控制 (disclosureControl)

**permission**: 披露权限级别
- full: 完全开放
- trusted: 信任级别
- selective: 选择性分享
- guarded: 有戒心
- minimal: 最小披露

**allowedTopics**: 允许讨论的话题

**forbiddenTopics**: 禁止讨论的话题

**customRules**: 特殊规则 [{ rule, reason }]

### 4. 共享记忆 (sharedMemories)

提取该关系中特有的共同记忆片段：
- content: 记忆内容
- type: shared_experience | conversation | observation | story
- sentiment: positive | neutral | negative | mixed
- timeReference: 时间参照
- importance: 0-1

## 输出要求
1. 所有判断必须有问卷答案作为依据
2. sharedSecrets 必须仔细提取，这对隐私控制至关重要
3. 保持客观，基于协助者的视角描述

## 输出格式 (严格JSON)
{outputSchema}`;

export const RELATION_LAYER_OUTPUT_SCHEMA = {
  conversationGuidance: {
    assistantPersonality: "string",
    suggestedAttitude: "string",
    suggestedTone: "string",
    personalityToDisplay: "string",
    topicTendencies: {
      preferred: ["string"],
      avoid: ["string"]
    },
    communicationNotes: ["string"]
  },
  perceivedByAssistant: {
    personalityDescription: "string",
    strengths: ["string"],
    weaknesses: ["string"],
    communicationPatterns: ["string"],
    sharedSecrets: ["string"]
  },
  disclosureControl: {
    permission: "string",
    allowedTopics: ["string"],
    forbiddenTopics: ["string"],
    customRules: [{ rule: "string", reason: "string" }]
  },
  sharedMemories: [{
    content: "string",
    type: "string",
    sentiment: "string",
    timeReference: "string",
    importance: "number"
  }]
};

/**
 * 构建关系层提取 Prompt
 */
export function buildRelationExtractionPrompt(params) {
  const {
    relationType,
    specificRelation,
    assistantName,
    targetUserName,
    answers
  } = params;

  const answersText = answers.map((a, i) => {
    return `Q${i + 1}. ${a.questionText}\n(问题意义: ${a.significance || '了解对方'})\nA${i + 1}. ${a.answerText}`;
  }).join('\n\n');

  const schemaText = JSON.stringify(RELATION_LAYER_OUTPUT_SCHEMA, null, 2);

  return RELATION_LAYER_EXTRACTION_PROMPT
    .replace('{relationType}', relationType)
    .replace('{specificRelation}', specificRelation)
    .replace('{assistantName}', assistantName)
    .replace('{targetUserName}', targetUserName)
    .replace('{answers}', answersText)
    .replace('{outputSchema}', schemaText);
}

export default {
  RELATION_LAYER_EXTRACTION_PROMPT,
  RELATION_LAYER_OUTPUT_SCHEMA,
  buildRelationExtractionPrompt
};
