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
