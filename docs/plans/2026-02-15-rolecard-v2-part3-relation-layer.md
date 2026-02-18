# 角色卡系统 V2 重构 - 第3部分：关系层生成器

> **前置条件:** 完成第2部分

---

## Task 3.1: 创建关系层提取 Prompt 模板

**Files:**
- Create: `server/src/modules/rolecard/v2/prompts/relationExtraction.js`

**Step 1: 创建 Prompt 文件**

```javascript
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
```

---

## Task 3.2: 创建关系层生成器

**Files:**
- Create: `server/src/modules/rolecard/v2/relationLayerGenerator.js`

```javascript
// server/src/modules/rolecard/v2/relationLayerGenerator.js

import { buildRelationExtractionPrompt } from './prompts/relationExtraction.js';
import Answer from '../../answer/model.js';
import AssistRelation from '../../assist-relation/model.js';
import User from '../../user/model.js';
import MultiLLMClient from '../../../core/llm/multi.js';
import DualStorage from '../../../core/storage/dual.js';
import logger from '../../../core/utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 关系层生成器
 * 从B/C套题答案中提取关系特征
 */
class RelationLayerGenerator {
  constructor() {
    this.llmClient = new MultiLLMClient();
    this.dualStorage = new DualStorage();
  }

  /**
   * 为单个协助者生成关系层
   * @param {Object} params
   * @param {string} params.targetUserId - 目标用户ID（被描述者）
   * @param {string} params.assistantId - 协助者ID（回答问卷者）
   * @param {string} params.relationId - 关系ID
   */
  async generateOne({ targetUserId, assistantId, relationId }) {
    logger.info(`[RelationLayerGenerator] 生成关系层 - Target: ${targetUserId}, Assistant: ${assistantId}`);

    try {
      // 1. 获取关系信息
      const relation = await AssistRelation.findById(relationId);
      if (!relation) {
        throw new Error(`关系不存在: ${relationId}`);
      }

      // 2. 获取用户信息
      const targetUser = await User.findById(targetUserId);
      const assistantUser = await User.findById(assistantId);

      if (!targetUser || !assistantUser) {
        throw new Error('用户不存在');
      }

      // 3. 确定问卷类型 (B套或C套)
      const questionRole = relation.relationshipType === 'family' ? 'B' : 'C';

      // 4. 收集答案
      const answers = await this.collectAnswers({
        assistantId,
        targetId: targetUserId,
        questionRole
      });

      if (answers.length < 5) {
        throw new Error(`答案不足 (需要至少5个，当前${answers.length}个)`);
      }

      logger.info(`[RelationLayerGenerator] 收集到 ${answers.length} 个答案`);

      // 5. 构建 Prompt 并调用 LLM
      const prompt = buildRelationExtractionPrompt({
        relationType: relation.relationshipType,
        specificRelation: relation.specificRelation,
        assistantName: assistantUser.name,
        targetUserName: targetUser.name,
        answers
      });

      const llmResponse = await this.llmClient.generate(prompt, {
        temperature: 0.3,
        maxTokens: 2500,
        responseFormat: 'json'
      });

      // 6. 解析响应
      const extractedData = this.parseLLMResponse(llmResponse);

      // 7. 构建完整的关系层
      const relationLayer = {
        relationId: `rel_${uuidv4().slice(0, 8)}`,
        assistant: {
          id: assistantId,
          name: assistantUser.name,
          uniqueCode: assistantUser.uniqueCode
        },
        target: {
          id: targetUserId,
          name: targetUser.name
        },
        relation: {
          type: relation.relationshipType,
          specific: relation.specificRelation,
          intimacyLevel: this.determineIntimacyLevel(answers, extractedData),
          duration: relation.relationshipDuration
        },
        questionnaireSource: {
          type: questionRole,
          answerCount: answers.length,
          completedAt: new Date().toISOString()
        },

        // 从 LLM 提取的数据
        ...extractedData,

        // 元数据
        generatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      logger.info(`[RelationLayerGenerator] 关系层生成完成 - ${relation.specificRelation}`);

      return relationLayer;

    } catch (error) {
      logger.error(`[RelationLayerGenerator] 生成失败:`, error);
      throw error;
    }
  }

  /**
   * 为目标用户生成所有关系层
   */
  async generateAll(targetUserId) {
    logger.info(`[RelationLayerGenerator] 生成所有关系层 - Target: ${targetUserId}`);

    const relations = await AssistRelation.find({
      targetId: targetUserId,
      isActive: true
    });

    const results = {
      success: [],
      failed: []
    };

    for (const relation of relations) {
      try {
        const layer = await this.generateOne({
          targetUserId,
          assistantId: relation.assistantId,
          relationId: relation._id
        });
        results.success.push(layer);
      } catch (error) {
        results.failed.push({
          assistantId: relation.assistantId,
          error: error.message
        });
      }
    }

    logger.info(`[RelationLayerGenerator] 完成 - 成功: ${results.success.length}, 失败: ${results.failed.length}`);

    return results;
  }

  /**
   * 收集B/C套题答案
   */
  async collectAnswers({ assistantId, targetId, questionRole }) {
    const answers = await Answer.find({
      userId: assistantId,
      targetUserId: targetId,
      questionRole: questionRole
    })
    .populate('questionId')
    .sort({ createdAt: 1 });

    return answers.map(a => ({
      _id: a._id,
      questionId: a.questionId._id,
      questionText: a.questionId.text,
      questionLayer: a.questionId.layer,
      answerText: a.answerText,
      significance: a.questionId.significance
    }));
  }

  /**
   * 判断亲密程度
   */
  determineIntimacyLevel(answers, extractedData) {
    // 基于共享秘密数量和答案深度判断
    const secretsCount = extractedData.perceivedByAssistant?.sharedSecrets?.length || 0;
    const memoriesCount = extractedData.sharedMemories?.length || 0;

    if (secretsCount >= 3 || memoriesCount >= 5) return 'intimate';
    if (secretsCount >= 1 || memoriesCount >= 3) return 'close';
    if (memoriesCount >= 1) return 'moderate';
    return 'distant';
  }

  /**
   * 解析 LLM 响应
   */
  parseLLMResponse(response) {
    try {
      let parsed;

      if (typeof response === 'string') {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('无法提取 JSON');
        }
      } else {
        parsed = response;
      }

      // 验证必要字段
      if (!parsed.conversationGuidance || !parsed.perceivedByAssistant) {
        throw new Error('缺少必要字段');
      }

      return parsed;

    } catch (error) {
      logger.error(`[RelationLayerGenerator] 解析失败:`, error);
      throw new Error(`关系层解析失败: ${error.message}`);
    }
  }
}

export default RelationLayerGenerator;
```

---

## Task 3.3: 创建 v2/index.js 导出文件

**Files:**
- Create: `server/src/modules/rolecard/v2/index.js`

```javascript
// server/src/modules/rolecard/v2/index.js

export { default as CoreLayerGenerator } from './coreLayerGenerator.js';
export { default as RelationLayerGenerator } from './relationLayerGenerator.js';

export { buildCoreExtractionPrompt } from './prompts/coreExtraction.js';
export { buildRelationExtractionPrompt } from './prompts/relationExtraction.js';
```

---

## 检查点

完成 Task 3.1-3.3 后，你应该有：

```
server/src/modules/rolecard/v2/
├── index.js                   ✅
├── coreLayerGenerator.js      ✅
├── relationLayerGenerator.js  ✅
└── prompts/
    ├── coreExtraction.js      ✅
    └── relationExtraction.js  ✅
```

**下一步:** 继续阅读 Part 4 - 安全护栏和校准层
