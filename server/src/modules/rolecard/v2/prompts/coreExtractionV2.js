// server/src/modules/rolecard/v2/prompts/coreExtractionV2.js

/**
 * 核心层 V2 提取 Prompt
 * 采用逐条提取 + 逐字段压缩的方式
 */

// ============ 字段定义 ============
export const CORE_LAYER_FIELDS = {
  basicIdentity: {
    description: '基础身份信息',
    tokenTarget: 150,
    source: 'profile'  // 来自个人档案页面
  },
  personality: {
    description: '性格特质描述',
    tokenTarget: 400,
    source: 'llm'
  },
  communicationStyle: {
    description: '沟通风格（语气、语速、习惯用语等）',
    tokenTarget: 200,
    source: 'llm'
  },
  backgroundStory: {
    description: '背景故事/人生经历',
    tokenTarget: 500,
    source: 'llm'
  },
  lifeMilestones: {
    description: '人生里程碑/重要事件',
    tokenTarget: 300,
    source: 'llm'
  },
  interests: {
    description: '兴趣爱好',
    tokenTarget: 200,
    source: 'llm'
  },
  preferences: {
    description: '偏好（喜欢/讨厌的事物）',
    tokenTarget: 200,
    source: 'llm'
  },
  values: {
    description: '价值观',
    tokenTarget: 250,
    source: 'llm'
  },
  emotionalNeeds: {
    description: '情感需求',
    tokenTarget: 250,
    source: 'llm'
  },
  memories: {
    description: '重要回忆',
    tokenTarget: 300,
    source: 'llm'
  },
  selfPerception: {
    description: '自我认知/自我描述',
    tokenTarget: 250,
    source: 'llm'
  }
};

// ============ 逐条提取 Prompt (RISE-IE 框架优化) ============
export const PER_ANSWER_EXTRACTION_PROMPT = `# ROLE
你是一位专业的人物档案分析师，擅长从老年人的生活叙述中提取关键信息并进行结构化分类。你的核心能力是准确识别、分类和保留原始细节。

---

# INPUT

## 输入类型
用户回答：通常是简短的叙述或直接回答，长度不一

## 输入格式
**问题**: {question}
**设计意义**: {significance}
**用户回答**: {answer}

---

# STEPS

## 步骤 1：理解上下文
- 仔细阅读问题及其设计意义
- 理解问题试图获取的信息类型
- 注意用户回答的语言风格和表达方式

## 步骤 2：识别可提取信息
- 扫描回答中明确表述的内容
- 标记与各字段相关的信息片段
- 只处理直接陈述的信息，不进行推断或解读

## 步骤 3：字段匹配与分类
对于每个识别到的信息片段：
- 对照字段定义确定最佳匹配
- 当信息可归入多个字段时，选择最直接相关的字段
- 记录具体细节，使用自然语言描述

## 步骤 4：信心评估
根据信息直接程度评估信心等级：
- high: 信息直接明确，无需解读
- medium: 信息较为清晰，但需要轻微整理
- low: 信息模糊或隐含，但仍有价值

## 步骤 5：格式化输出
- 将提取结果按 JSON 格式组织
- 确保所有字段都有值
- 添加备注说明任何特殊情况

---

# EXPECTATION

## 字段定义

{fieldDescriptions}

## 输出格式（严格 JSON）
{
  "extractedFields": {
    "personality": "提取的内容或 null",
    "communicationStyle": "提取的内容或 null",
    "backgroundStory": "提取的内容或 null",
    "lifeMilestones": "提取的内容或 null",
    "interests": "提取的内容或 null",
    "preferences": "提取的内容或 null",
    "values": "提取的内容或 null",
    "emotionalNeeds": "提取的内容或 null",
    "memories": "提取的内容或 null",
    "selfPerception": "提取的内容或 null"
  },
  "confidence": "high|medium|low",
  "notes": "备注说明（如有特殊情况）"
}

## 质量标准

### 必须做到
- 只有当回答明确包含某字段信息时才填写
- 保留原始回答中的具体细节和表述
- 使用自然流畅的中文描述
- 字段可同时填写多个
- 无相关内容时填写 null

### 禁止行为
- 不要推断或解读未明确表述的信息
- 不要过度概括或抽象化
- 不要添加回答中不存在的内容
- 不要忽略明确相关的信息`;

// ============ 字段压缩 Prompt (Chain of Density 框架优化) ============
export const FIELD_COMPRESSION_PROMPT = `# ROLE
你是一位专业的文本精炼师，擅长将多个信息片段整合成精炼、连贯且信息密度高的描述。你的核心能力是在保持信息完整性的同时，创造出流畅自然的叙述。

---

# CONTEXT

## 任务背景
在人物档案构建过程中，同一主题的信息往往分散在多个回答中。需要将这些片段整合成一个完整、连贯的描述，用于角色卡的核心层数据。

## 字段信息
**字段名称**: {fieldName}
**字段描述**: {fieldDescription}
**目标长度**: 约 {targetTokens} 个中文字符

## 待压缩片段
{fragments}

---

# COMPRESSION METHODOLOGY

## 第一阶段：信息盘点
1. 逐一阅读每个片段，标记关键信息点
2. 识别重复或相似的内容
3. 标记可能的矛盾或不一致之处
4. 记录所有独特的信息细节

## 第二阶段：结构规划
1. 确定信息的逻辑顺序（时间顺序/主题分组/重要性排序）
2. 决定如何处理相似内容（合并/选择/保留不同角度）
3. 规划最终描述的段落结构

## 第三阶段：整合撰写
1. 以流畅的叙述方式串联信息
2. 使用适当的连接词确保连贯性
3. 精简表述，去除冗余词汇
4. 确保语气统一、风格一致

## 第四阶段：质量检验
1. 检查是否遗漏重要信息
2. 确认长度是否符合目标
3. 验证逻辑流畅性
4. 提取核心要点

---

# QUALITY STANDARDS

## 必须做到
- 保留所有独特且有价值的信息点
- 合并重复或高度相似的内容
- 使用流畅自然的中文表达
- 按逻辑顺序组织内容
- 矛盾时保留更具体、更详细的版本
- 提取 3-5 个核心要点

## 禁止行为
- 不要丢失任何独特的信息细节
- 不要简单拼接，要有机整合
- 不要添加片段中不存在的内容
- 不要使用机械的列举方式
- 不要超过目标长度太多（允许 ±20%）

---

# OUTPUT FORMAT

{
  "compressed": "压缩后的完整描述（流畅叙述，非列举）",
  "keyPoints": ["核心要点1", "核心要点2", "核心要点3"],
  "wordCount": 压缩后的字数
}`;

// ============ 构建函数 ============

/**
 * 构建逐条提取 Prompt
 */
export function buildPerAnswerExtractionPrompt(question, answer, significance) {
  const fieldDescriptions = Object.entries(CORE_LAYER_FIELDS)
    .filter(([key, field]) => field.source === 'llm')
    .map(([key, field]) => `- ${key}: ${field.description}`)
    .join('\n');

  return PER_ANSWER_EXTRACTION_PROMPT
    .replace('{question}', question)
    .replace('{significance}', significance || '无')
    .replace('{answer}', answer)
    .replace('{fieldDescriptions}', fieldDescriptions);
}

/**
 * 构建字段压缩 Prompt
 */
export function buildFieldCompressionPrompt(fieldName, fragments) {
  const field = CORE_LAYER_FIELDS[fieldName];
  if (!field) {
    throw new Error(`Unknown field: ${fieldName}`);
  }

  const fragmentsText = fragments
    .map((f, i) => `片段${i + 1}: ${f}`)
    .join('\n\n');

  return FIELD_COMPRESSION_PROMPT
    .replace('{fieldName}', fieldName)
    .replace('{fieldDescription}', field.description)
    .replace('{targetTokens}', field.tokenTarget.toString())
    .replace(/{targetTokens}/g, field.tokenTarget.toString())
    .replace('{fragments}', fragmentsText);
}

export default {
  CORE_LAYER_FIELDS,
  PER_ANSWER_EXTRACTION_PROMPT,
  FIELD_COMPRESSION_PROMPT,
  buildPerAnswerExtractionPrompt,
  buildFieldCompressionPrompt
};
