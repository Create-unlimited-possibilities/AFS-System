# 角色卡系统 V2 重构 - 第2部分：核心层生成器

> **前置条件:** 完成第1部分的阅读

---

## Task 2.1: 创建核心层提取 Prompt 模板

**Files:**
- Create: `server/src/modules/rolecard/v2/prompts/coreExtraction.js`

**Step 1: 创建 Prompt 文件**

```javascript
// server/src/modules/rolecard/v2/prompts/coreExtraction.js

/**
 * 核心层人格特征提取 Prompt 模板
 * 基于 CPM (Communication Privacy Management) 理论设计
 */

export const CORE_LAYER_EXTRACTION_PROMPT = `你是一个专业的人格特征分析专家。请根据用户的自我描述问卷答案，提取其人格边界特征。

## 理论基础
基于 Communication Privacy Management (CPM) 理论，分析用户的信息披露行为和隐私边界管理方式。

## 分析框架

### 1. 人格边界特征 (personalityTraits)

**boundaryThickness (边界厚度)**
- thick: 对私人信息非常谨慎，很少主动透露，被问到时会回避
- medium: 有一定保护意识，会根据对象和情境决定是否透露
- thin: 比较开放，乐于分享，对大多数话题不避讳

**discretionLevel (守密能力)**
- excellent: 口风很紧，从不会泄露秘密
- good: 大部分时候能守住秘密
- moderate: 有时会不小心说漏嘴
- poor: 经常无意中泄露信息

**impulsiveSpeech (冲动说话)**
- rare: 三思而后言，几乎不会冲动
- occasional: 偶尔会说漏嘴
- often: 经常想到什么说什么
- frequent: 口无遮拦，容易得罪人

**emotionalExpression (情感表达)**
- reserved: 情感内敛，不轻易表露
- moderate: 适度表达，能根据场合控制
- expressive: 情感外露，容易被看穿

**socialCautiousness (社交谨慎度)**
- high: 非常注意言辞，考虑后果
- moderate: 有一定分寸
- low: 比较随意，不太考虑后果

### 2. 行为指示器 (behavioralIndicators)
提取具体的行为模式：trigger (触发条件) + response (典型反应)

### 3. 沟通风格 (communicationStyle)
- tonePattern: 说话语气描述
- preferredTopics: 喜欢聊的话题
- avoidedTopics: 回避的话题
- humorStyle: 幽默程度
- verbosity: 说话详细程度

### 4. 自我认知 (selfPerception)
- selfDescriptionKeywords: 自我评价关键词
- coreValues: 核心价值观
- lifePriorities: 人生优先级

## 用户的问卷答案
{answers}

## 提取要求
1. 所有判断必须有问卷答案作为依据
2. 如果某项特征无法确定，confidence 设为 "low"
3. 保持客观，不要添加评价性语言
4. 每个行为指示器都要注明来源问题ID

## 输出格式 (严格JSON)
{outputSchema}`;

/**
 * 输出 Schema
 */
export const CORE_LAYER_OUTPUT_SCHEMA = {
  personalityTraits: {
    boundaryThickness: "string",
    discretionLevel: "string",
    impulsiveSpeech: "string",
    emotionalExpression: "string",
    socialCautiousness: "string"
  },
  behavioralIndicators: [{
    trigger: "string",
    response: "string",
    confidence: "string",
    sourceQuestionIds: ["string"]
  }],
  communicationStyle: {
    tonePattern: "string",
    preferredTopics: ["string"],
    avoidedTopics: ["string"],
    humorStyle: "string",
    verbosity: "string"
  },
  selfPerception: {
    selfDescriptionKeywords: ["string"],
    coreValues: ["string"],
    lifePriorities: ["string"]
  }
};

/**
 * 构建完整的提取 Prompt
 */
export function buildCoreExtractionPrompt(answers) {
  const answersText = answers.map((a, i) => {
    return `Q${i + 1}. ${a.questionText}\nA${i + 1}. ${a.answerText}`;
  }).join('\n\n');

  const schemaText = JSON.stringify(CORE_LAYER_OUTPUT_SCHEMA, null, 2);

  return CORE_LAYER_EXTRACTION_PROMPT
    .replace('{answers}', answersText)
    .replace('{outputSchema}', schemaText);
}

export default {
  CORE_LAYER_EXTRACTION_PROMPT,
  CORE_LAYER_OUTPUT_SCHEMA,
  buildCoreExtractionPrompt
};
```

**Step 2: 创建目录结构**

```bash
mkdir -p server/src/modules/rolecard/v2/prompts
```

**Step 3: 验证文件创建**

```bash
ls -la server/src/modules/rolecard/v2/prompts/
```
Expected: coreExtraction.js 文件存在

---

## Task 2.2: 创建核心层生成器

**Files:**
- Create: `server/src/modules/rolecard/v2/coreLayerGenerator.js`

**Step 1: 创建生成器文件**

```javascript
// server/src/modules/rolecard/v2/coreLayerGenerator.js

import { buildCoreExtractionPrompt, CORE_LAYER_OUTPUT_SCHEMA } from './prompts/coreExtraction.js';
import Answer from '../../answer/model.js';
import MultiLLMClient from '../../../core/llm/multi.js';
import DualStorage from '../../../core/storage/dual.js';
import User from '../../user/model.js';
import logger from '../../../core/utils/logger.js';

/**
 * 核心层生成器
 * 从A套题答案中提取人格边界特征
 */
class CoreLayerGenerator {
  constructor() {
    this.llmClient = new MultiLLMClient();
    this.dualStorage = new DualStorage();
  }

  /**
   * 生成核心层
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 核心层数据
   */
  async generate(userId) {
    logger.info(`[CoreLayerGenerator] 开始生成核心层 - User: ${userId}`);

    try {
      // 1. 收集A套题答案
      const answers = await this.collectASetAnswers(userId);

      if (answers.length < 10) {
        throw new Error(`A套题答案不足 (需要至少10个，当前${answers.length}个)`);
      }

      logger.info(`[CoreLayerGenerator] 收集到 ${answers.length} 个A套题答案`);

      // 2. 构建 Prompt 并调用 LLM
      const prompt = buildCoreExtractionPrompt(answers);
      const llmResponse = await this.llmClient.generate(prompt, {
        temperature: 0.3,  // 较低温度保证一致性
        maxTokens: 2000,
        responseFormat: 'json'
      });

      // 3. 解析 LLM 响应
      const coreLayer = this.parseLLMResponse(llmResponse);

      // 4. 添加元数据
      coreLayer.version = '2.0.0';
      coreLayer.generatedAt = new Date().toISOString();
      coreLayer.sourceQuestionCount = answers.length;
      coreLayer.sourceQuestionIds = answers.map(a => a._id.toString());

      logger.info(`[CoreLayerGenerator] 核心层生成完成`);

      return coreLayer;

    } catch (error) {
      logger.error(`[CoreLayerGenerator] 生成失败:`, error);
      throw error;
    }
  }

  /**
   * 收集A套题答案
   */
  async collectASetAnswers(userId) {
    const answers = await Answer.find({
      userId,
      questionRole: 'A',  // A套题
      isSelfAnswer: true  // 自我回答
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
   * 解析 LLM 响应
   */
  parseLLMResponse(response) {
    try {
      // 尝试直接解析 JSON
      let parsed;

      if (typeof response === 'string') {
        // 提取 JSON 块
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('无法从响应中提取 JSON');
        }
      } else {
        parsed = response;
      }

      // 验证必要字段
      this.validateCoreLayer(parsed);

      return parsed;

    } catch (error) {
      logger.error(`[CoreLayerGenerator] 解析LLM响应失败:`, error);
      throw new Error(`核心层解析失败: ${error.message}`);
    }
  }

  /**
   * 验证核心层结构
   */
  validateCoreLayer(coreLayer) {
    const requiredPaths = [
      'personalityTraits.boundaryThickness',
      'personalityTraits.discretionLevel',
      'personalityTraits.impulsiveSpeech',
      'personalityTraits.emotionalExpression',
      'personalityTraits.socialCautiousness',
      'communicationStyle.tonePattern',
      'selfPerception.selfDescriptionKeywords'
    ];

    for (const path of requiredPaths) {
      const parts = path.split('.');
      let obj = coreLayer;

      for (const part of parts) {
        if (!obj || !obj[part]) {
          throw new Error(`缺少必要字段: ${path}`);
        }
        obj = obj[part];
      }
    }

    // 验证枚举值
    const validValues = {
      boundaryThickness: ['thick', 'medium', 'thin'],
      discretionLevel: ['excellent', 'good', 'moderate', 'poor'],
      impulsiveSpeech: ['rare', 'occasional', 'often', 'frequent'],
      emotionalExpression: ['reserved', 'moderate', 'expressive'],
      socialCautiousness: ['high', 'moderate', 'low'],
      humorStyle: ['none', 'light', 'moderate', 'heavy'],
      verbosity: ['concise', 'moderate', 'elaborate']
    };

    for (const [key, valid] of Object.entries(validValues)) {
      const value = coreLayer.personalityTraits[key] || coreLayer.communicationStyle?.[key];
      if (value && !valid.includes(value)) {
        logger.warn(`[CoreLayerGenerator] 无效的枚举值 ${key}=${value}，将使用默认值`);
      }
    }
  }
}

export default CoreLayerGenerator;
```

**Step 2: 验证文件**

```bash
ls -la server/src/modules/rolecard/v2/
```
Expected: coreLayerGenerator.js 和 prompts/ 目录存在

---

## Task 2.3: 更新 DualStorage 支持新的角色卡格式

**Files:**
- Modify: `server/src/core/storage/dual.js`

**Step 1: 添加新的保存/加载方法**

在 DualStorage 类中添加以下方法：

```javascript
// 在 dual.js 末尾 export 之前添加

/**
 * 保存 V2 角色卡
 */
async saveRoleCardV2(userId, roleCardV2) {
  await this.initialize();

  const userPath = path.join(this.basePath, String(userId));
  await fsPromises.mkdir(userPath, { recursive: true });

  const filePath = path.join(userPath, 'rolecard-v2.json');

  try {
    await fsPromises.writeFile(filePath, JSON.stringify(roleCardV2, null, 2), 'utf-8');
    console.log(`[DualStorage] V2角色卡已保存: ${filePath}`);
    return { success: true, filePath };
  } catch (error) {
    console.error(`[DualStorage] V2角色卡保存失败:`, error);
    throw error;
  }
}

/**
 * 加载 V2 角色卡
 */
async loadRoleCardV2(userId) {
  const filePath = path.join(this.basePath, String(userId), 'rolecard-v2.json');

  try {
    const data = await fsPromises.readFile(filePath, 'utf-8');
    const roleCard = JSON.parse(data);
    console.log(`[DualStorage] V2角色卡已加载: ${filePath}`);
    return roleCard;
  } catch (error) {
    console.warn(`[DualStorage] V2角色卡加载失败 ${userId}:`, error.message);
    return null;
  }
}

/**
 * 保存关系层
 */
async saveRelationLayer(userId, relationId, relationLayer) {
  await this.initialize();

  const userPath = path.join(this.basePath, String(userId), 'relation-layers');
  await fsPromises.mkdir(userPath, { recursive: true });

  const filePath = path.join(userPath, `${relationId}.json`);

  try {
    await fsPromises.writeFile(filePath, JSON.stringify(relationLayer, null, 2), 'utf-8');
    console.log(`[DualStorage] 关系层已保存: ${filePath}`);
    return { success: true, filePath };
  } catch (error) {
    console.error(`[DualStorage] 关系层保存失败:`, error);
    throw error;
  }
}

/**
 * 加载所有关系层
 */
async loadAllRelationLayers(userId) {
  const dirPath = path.join(this.basePath, String(userId), 'relation-layers');

  try {
    const files = await fsPromises.readdir(dirPath);
    const layers = {};

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(dirPath, file);
        const data = await fsPromises.readFile(filePath, 'utf-8');
        const layer = JSON.parse(data);
        layers[layer.relationId || file.replace('.json', '')] = layer;
      }
    }

    console.log(`[DualStorage] 已加载 ${Object.keys(layers).length} 个关系层`);
    return layers;
  } catch (error) {
    console.warn(`[DualStorage] 关系层加载失败 ${userId}:`, error.message);
    return {};
  }
}
```

---

## 检查点

完成 Task 2.1-2.3 后，你应该有：

```
server/src/modules/rolecard/v2/
├── coreLayerGenerator.js     ✅
└── prompts/
    └── coreExtraction.js     ✅

server/src/core/storage/
└── dual.js (已更新)           ✅
```

**下一步:** 继续阅读 Part 3 - 关系层生成器实现
