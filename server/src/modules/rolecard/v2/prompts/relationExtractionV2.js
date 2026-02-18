// server/src/modules/rolecard/v2/prompts/relationExtractionV2.js

/**
 * 关系层 V2 提取 Prompt
 * 用于处理 B-set（家人）和 C-set（朋友）问题
 */

// ============ 字段定义 ============

// 共同字段（家人 + 朋友）
export const COMMON_RELATION_FIELDS = {
  relationshipBasis: {
    description: '关系基础（如何认识、关系演变过程、相识背景）',
    tokenTarget: 200
  },
  sharedMemories: {
    description: '共同回忆/经历（一起经历过的重要事件、难忘时刻）',
    tokenTarget: 300
  },
  interactionPatterns: {
    description: '互动模式（相处方式、见面频率、交流习惯）',
    tokenTarget: 200
  },
  communicationStyle: {
    description: '沟通风格（与该协助者特有的沟通方式、语言习惯）',
    tokenTarget: 200
  },
  emotionalBond: {
    description: '情感纽带（情感连接深度、亲密度、情感表达方式）',
    tokenTarget: 200
  },
  mutualInfluence: {
    description: '相互影响（对彼此的影响、改变、启发）',
    tokenTarget: 200
  },
  supportDynamics: {
    description: '支持动态（如何互相支持、帮助方式、依赖程度）',
    tokenTarget: 200
  },
  perceivedTraits: {
    description: '协助者眼中的目标用户特质（性格、优点、特点）',
    tokenTarget: 250
  },
  topicsAndInterests: {
    description: '话题与兴趣（常聊的话题、共同兴趣、讨论内容）',
    tokenTarget: 200
  }
};

// 家人专属字段（B-set）
export const FAMILY_SPECIFIC_FIELDS = {
  familyRole: {
    description: '家庭角色（在家庭中的角色定位、职责、地位）',
    tokenTarget: 150
  },
  intergenerationalImpact: {
    description: '代际影响（对成长的影响、价值观传承、人生指导）',
    tokenTarget: 250
  },
  familyTraditions: {
    description: '家庭传统（习俗、仪式、节日活动、特别习惯）',
    tokenTarget: 200
  },
  careAndGuidance: {
    description: '关怀与指导（给予的建议、照顾方式、教导内容）',
    tokenTarget: 200
  },
  familyValues: {
    description: '家庭价值观（共同看重的价值、信念、原则）',
    tokenTarget: 200
  }
};

// 朋友专属字段（C-set）
export const FRIEND_SPECIFIC_FIELDS = {
  socialRole: {
    description: '社交角色（在朋友圈中的角色、定位、影响力）',
    tokenTarget: 150
  },
  friendshipHistory: {
    description: '友谊历史（相识过程、友谊发展阶段、重要节点）',
    tokenTarget: 200
  },
  socialActivities: {
    description: '社交活动（共同参与的活动、聚会方式、娱乐形式）',
    tokenTarget: 200
  },
  groupDynamics: {
    description: '群体动态（在群体中的互动方式、冲突处理、合作模式）',
    tokenTarget: 200
  },
  trustAndLoyalty: {
    description: '信任与忠诚（可靠程度、承诺履行、信任基础）',
    tokenTarget: 150
  }
};

// 合并后的完整字段集
export const FAMILY_RELATION_FIELDS = {
  ...COMMON_RELATION_FIELDS,
  ...FAMILY_SPECIFIC_FIELDS
};

export const FRIEND_RELATION_FIELDS = {
  ...COMMON_RELATION_FIELDS,
  ...FRIEND_SPECIFIC_FIELDS
};

// ============ 逐条提取 Prompt (RISE-IE 框架优化) ============
export const PER_ANSWER_RELATION_EXTRACTION_PROMPT = `# ROLE
你是一位专业的关系分析专家，擅长从第三人称视角的描述中提取人际关系信息。你的核心能力是识别协助者对目标用户的看法和描述，并将其结构化分类。

---

# INPUT

## 输入类型
- 关系类型: {relationType}（家人/朋友）
- 协助者信息: {assistantName}（{specificRelation}）
- 问题及设计意义: 提供回答的上下文
- 协助者回答: 通常是简短的叙述或直接回答

## 输入格式
**关系类型**: {relationType}
**协助者**: {assistantName}（{specificRelation}）
**问题**: {question}
**设计意义**: {significance}
**回答**: {answer}

---

# STEPS

## 步骤 1：理解关系背景
- 确认关系类型（家人/朋友）及具体关系
- 理解协助者与目标用户的关系定位
- 注意回答中的视角和立场

## 步骤 2：识别可提取信息
- 扫描回答中关于目标用户的描述
- 标记与各字段相关的信息片段
- 区分事实描述和主观看法

## 步骤 3：字段匹配与分类
对于每个识别到的信息片段：
- 对照字段定义确定最佳匹配
- 当信息可归入多个字段时，选择最直接相关的字段
- 以第三人称角度记录（描述目标用户）

## 步骤 4：信心评估
根据信息直接程度评估信心等级：
- high: 信息直接明确，协助者清晰陈述
- medium: 信息需要轻微整理归纳
- low: 信息模糊或需要推测

## 步骤 5：格式化输出
- 将提取结果按 JSON 格式组织
- 不相关的字段填写 null
- 添加备注说明特殊情况

---

# EXPECTATION

## 字段定义

{fieldDescriptions}

## 输出格式（严格 JSON）
{
  "extractedFields": {
    "relationshipBasis": "提取内容或 null",
    "sharedMemories": "提取内容或 null",
    "interactionPatterns": "提取内容或 null",
    "communicationStyle": "提取内容或 null",
    "emotionalBond": "提取内容或 null",
    "mutualInfluence": "提取内容或 null",
    "supportDynamics": "提取内容或 null",
    "perceivedTraits": "提取内容或 null",
    "topicsAndInterests": "提取内容或 null",
    "familyRole": "（仅家人）提取内容或 null",
    "intergenerationalImpact": "（仅家人）提取内容或 null",
    "familyTraditions": "（仅家人）提取内容或 null",
    "careAndGuidance": "（仅家人）提取内容或 null",
    "familyValues": "（仅家人）提取内容或 null",
    "socialRole": "（仅朋友）提取内容或 null",
    "friendshipHistory": "（仅朋友）提取内容或 null",
    "socialActivities": "（仅朋友）提取内容或 null",
    "groupDynamics": "（仅朋友）提取内容或 null",
    "trustAndLoyalty": "（仅朋友）提取内容或 null"
  },
  "confidence": "high|medium|low",
  "notes": "备注说明"
}

## 质量标准

### 必须做到
- 只有当回答明确包含某字段信息时才填写
- 保留原始回答中的具体细节
- 使用第三人称描述目标用户
- 字段可同时填写多个
- 无相关内容时填写 null

### 禁止行为
- 不要推断或解读未明确表述的信息
- 不要添加回答中不存在的内容
- 不要忽略明确相关的信息`;

// ============ 字段压缩 Prompt (Chain of Density 框架优化) ============
export const RELATION_FIELD_COMPRESSION_PROMPT = `# ROLE
你是一位专业的文本精炼师，专注于人际关系描述的整合与优化。你的核心能力是将多个视角的信息片段整合成连贯、自然的第三人称描述。

---

# CONTEXT

## 任务背景
在关系层构建过程中，协助者对目标用户的描述分散在多个回答中。需要将这些片段整合成一个完整、连贯的描述，用于角色卡的关系层数据。

## 关系信息
**关系类型**: {relationType}（{specificRelation}）
**字段名称**: {fieldName}
**字段描述**: {fieldDescription}
**目标长度**: 约 {targetTokens} 个中文字符

## 待压缩片段
{fragments}

---

# COMPRESSION METHODOLOGY

## 第一阶段：信息盘点
1. 逐一阅读每个片段，标记关于目标用户的信息点
2. 识别重复或相似的描述
3. 注意协助者的主观视角和表达方式
4. 记录所有独特的信息细节

## 第二阶段：视角统一
1. 确保所有内容以第三人称描述目标用户
2. 转换第一人称表述为第三人称（如"我觉得他..."→"他..."）
3. 保持协助者观察者的视角

## 第三阶段：整合撰写
1. 以流畅的叙述方式串联信息
2. 使用适当的连接词确保连贯性
3. 精简表述，去除冗余词汇
4. 保持客观中立的描述语调

## 第四阶段：质量检验
1. 检查是否遗漏重要信息
2. 确认长度是否符合目标
3. 验证全篇使用第三人称
4. 提取核心要点

---

# QUALITY STANDARDS

## 必须做到
- 保留所有独特且有价值的信息点
- 全程使用第三人称（他/她）描述目标用户
- 保持协助者观察者的视角
- 按逻辑顺序组织内容
- 保留具体的例子和细节
- 提取 3-5 个核心要点

## 禁止行为
- 不要使用第一人称（我/我们）
- 不要丢失任何独特的信息细节
- 不要添加片段中不存在的内容
- 不要超过目标长度太多（允许 ±20%）

---

# OUTPUT FORMAT

{
  "compressed": "压缩后的完整描述（第三人称叙述）",
  "keyPoints": ["核心要点1", "核心要点2", "核心要点3"],
  "wordCount": 压缩后的字数
}`;

// ============ 构建函数 ============

/**
 * 获取关系类型对应的字段集
 */
export function getFieldsForRelationType(relationType) {
  if (relationType === 'family') {
    return FAMILY_RELATION_FIELDS;
  } else if (relationType === 'friend') {
    return FRIEND_RELATION_FIELDS;
  }
  return COMMON_RELATION_FIELDS;
}

/**
 * 构建逐条提取 Prompt
 */
export function buildPerAnswerRelationExtractionPrompt(
  question,
  answer,
  significance,
  relationType,
  assistantName,
  specificRelation
) {
  const fields = getFieldsForRelationType(relationType);
  const fieldDescriptions = Object.entries(fields)
    .map(([key, field]) => `- ${key}: ${field.description}`)
    .join('\n');

  return PER_ANSWER_RELATION_EXTRACTION_PROMPT
    .replace('{relationType}', relationType === 'family' ? '家人' : '朋友')
    .replace('{assistantName}', assistantName)
    .replace('{specificRelation}', specificRelation)
    .replace('{question}', question)
    .replace('{significance}', significance || '无')
    .replace('{answer}', answer)
    .replace('{fieldDescriptions}', fieldDescriptions);
}

/**
 * 构建字段压缩 Prompt
 */
export function buildRelationFieldCompressionPrompt(
  fieldName,
  fragments,
  relationType,
  specificRelation
) {
  const fields = getFieldsForRelationType(relationType);
  const field = fields[fieldName];

  if (!field) {
    throw new Error(`Unknown field: ${fieldName}`);
  }

  const fragmentsText = fragments
    .map((f, i) => `片段${i + 1}: ${f}`)
    .join('\n\n');

  return RELATION_FIELD_COMPRESSION_PROMPT
    .replace('{relationType}', relationType === 'family' ? '家人关系' : '朋友关系')
    .replace('{specificRelation}', specificRelation)
    .replace('{fieldName}', fieldName)
    .replace('{fieldDescription}', field.description)
    .replace('{targetTokens}', field.tokenTarget.toString())
    .replace(/{targetTokens}/g, field.tokenTarget.toString())
    .replace('{fragments}', fragmentsText);
}

// ============ 信任等级分析 Prompt (Chain of Thought 框架优化) ============
export const TRUST_LEVEL_ANALYSIS_PROMPT = `# ROLE
你是一位专业的关系评估专家，擅长根据关系数据判断人际信任等级。你的核心能力是综合多维度信息，做出准确且有依据的信任等级判断。

---

# CONTEXT

## 任务背景
在角色卡系统中，协助者的信任等级决定了他们可以访问的角色卡信息层级。需要根据关系层数据，客观评估这个关系的信任等级。

## 关系基本信息
- 关系类型: {relationType}（{relationTypeDesc}）
- 具体关系: {specificRelation}
- 亲密度初步评估: {intimacyLevel}

## 关系层数据摘要
{relationDataSummary}

---

# TRUST LEVEL DEFINITIONS

## tier1_intimate（最亲密）
**定义**: 可以分享所有私密信息，包括财务、健康、情感秘密

**判断标准**:
- 有深度情感连接的证据
- 有长期信任历史
- 有明显的相互依赖
- 共同经历重大人生事件

**典型表现**:
- 描述中提到倾诉秘密、分享隐私
- 在困难时刻互相支持
- 了解对方内心深处的想法
- 关系持续多年且不断深化

## tier2_close（亲近）
**定义**: 可以分享大部分个人事务，但某些极度私密话题会保留

**判断标准**:
- 有较强的情感连接
- 有经常性的交流互动
- 有相互支持的行为

**典型表现**:
- 经常见面或联系
- 分享日常生活
- 在需要时会帮助对方
- 了解对方的基本情况

## tier3_familiar（一般熟悉）
**定义**: 有限度的信息分享，主要是日常话题

**判断标准**:
- 有一定互动但不深入
- 了解表面信息
- 关系较为表面化

**典型表现**:
- 偶尔见面或联系
- 聊天内容较为浅显
- 互相了解有限
- 关系停留在社交层面

## tier4_acquaintance（疏远/陌生人）
**定义**: 仅分享基本公共信息

**判断标准**:
- 互动很少或不了解
- 没有深入交流
- 关系疏远或陌生

**典型表现**:
- 几乎没有往来
- 不了解对方情况
- 关系名存实亡
- 刚认识不久

---

# ANALYSIS PROCESS

## 步骤 1：审视关系基础
- 关系持续了多久？
- 是什么类型的关系？
- 有无血缘或特殊连接？

## 步骤 2：评估情感深度
- 是否有深层的情感连接？
- 是否分享过私密信息？
- 是否在困难时相互依赖？

## 步骤 3：分析互动质量
- 互动的频率如何？
- 互动的内容深度如何？
- 是否有共同经历的重要事件？

## 步骤 4：综合判断
- 根据以上分析，匹配最合适的信任等级
- 确保有充分的证据支持判断

## 重点关注的字段
- sharedMemories（共同回忆的深度）
- emotionalBond（情感连接的程度）
- supportDynamics（支持的深度）
- mutualInfluence（影响的深度）

---

# QUALITY STANDARDS

## 必须做到
- 根据实际互动内容判断，不仅凭关系称谓
- 综合多个维度的信息
- 给出清晰的判断理由
- 信心等级与证据强度匹配

## 禁止行为
- 不要仅根据"家人""朋友"标签就做出判断
- 不要忽略互动内容的实际深度
- 不要在证据不足时给出高信心等级

---

# OUTPUT FORMAT

{
  "trustLevel": "tier1_intimate|tier2_close|tier3_familiar|tier4_acquaintance",
  "confidence": "high|medium|low",
  "reasoning": "判断理由（50字以内，说明关键依据）"
}`;

/**
 * 信任等级描述映射
 */
const TRUST_LEVEL_NAMES = {
  'tier1_intimate': '最亲密',
  'tier2_close': '亲近',
  'tier3_familiar': '一般熟悉',
  'tier4_acquaintance': '疏远/陌生人'
};

/**
 * 构建信任等级分析 Prompt
 */
export function buildTrustLevelAnalysisPrompt(
  relationType,
  specificRelation,
  intimacyLevel,
  compressedFields
) {
  // 构建关系数据摘要
  const summaryParts = [];

  const keyFields = [
    'sharedMemories',
    'emotionalBond',
    'supportDynamics',
    'mutualInfluence',
    'interactionPatterns',
    'perceivedTraits'
  ];

  for (const field of keyFields) {
    if (compressedFields[field]?.summary) {
      summaryParts.push(`【${getFieldDisplayName(field)}】\n${compressedFields[field].summary}`);
    }
  }

  const relationDataSummary = summaryParts.length > 0
    ? summaryParts.join('\n\n')
    : '（关系数据较少）';

  return TRUST_LEVEL_ANALYSIS_PROMPT
    .replace('{relationType}', relationType)
    .replace('{relationTypeDesc}', relationType === 'family' ? '家人' : '朋友')
    .replace('{specificRelation}', specificRelation)
    .replace('{intimacyLevel}', TRUST_LEVEL_NAMES[intimacyLevel] || intimacyLevel)
    .replace('{relationDataSummary}', relationDataSummary);
}

/**
 * 获取字段显示名称
 */
function getFieldDisplayName(fieldName) {
  const names = {
    sharedMemories: '共同回忆',
    emotionalBond: '情感纽带',
    supportDynamics: '支持动态',
    mutualInfluence: '相互影响',
    interactionPatterns: '互动模式',
    perceivedTraits: '对方眼中的特质',
    relationshipBasis: '关系基础',
    communicationStyle: '沟通风格',
    topicsAndInterests: '话题与兴趣'
  };
  return names[fieldName] || fieldName;
}

export default {
  COMMON_RELATION_FIELDS,
  FAMILY_SPECIFIC_FIELDS,
  FRIEND_SPECIFIC_FIELDS,
  FAMILY_RELATION_FIELDS,
  FRIEND_RELATION_FIELDS,
  PER_ANSWER_RELATION_EXTRACTION_PROMPT,
  RELATION_FIELD_COMPRESSION_PROMPT,
  TRUST_LEVEL_ANALYSIS_PROMPT,
  getFieldsForRelationType,
  buildPerAnswerRelationExtractionPrompt,
  buildRelationFieldCompressionPrompt,
  buildTrustLevelAnalysisPrompt
};
