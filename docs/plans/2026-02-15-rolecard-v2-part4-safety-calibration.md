# 角色卡系统 V2 重构 - 第4部分：安全护栏和校准层

> **前置条件:** 完成第3部分

---

## Task 4.1: 创建安全护栏配置

**Files:**
- Create: `server/src/modules/rolecard/v2/safetyGuardrails.js`

**Step 1: 创建安全护栏模块**

```javascript
// server/src/modules/rolecard/v2/safetyGuardrails.js

import logger from '../../../core/utils/logger.js';

/**
 * 系统默认的护栏规则
 */
export const DEFAULT_GUARDRAIL_RULES = [
  // ========== 硬规则（绝对不可违反）==========
  {
    id: 'rule_hard_001',
    type: 'hard',
    topic: {
      category: 'intimate_relations',
      keywords: ['性生活', '夫妻亲密', '床第', '性关系'],
      description: '夫妻/伴侣间的私密关系细节'
    },
    allowedAudience: {
      trustLevels: ['tier1_intimate'],
      specificRelations: ['配偶', '丈夫', '妻子']
    },
    action: {
      type: 'block',
      redirectHint: '转移到家庭日常话题'
    },
    priority: 100,
    enabled: true
  },

  {
    id: 'rule_hard_002',
    type: 'hard',
    topic: {
      category: 'financial_secrets',
      keywords: ['存款数额', '具体收入', '债务金额', '财产分配', '银行密码'],
      description: '具体的财务数字和财产细节'
    },
    allowedAudience: {
      trustLevels: ['tier1_intimate'],
      specificRelations: ['配偶', '子女', '儿子', '女儿']
    },
    action: {
      type: 'vague_response',
      vagueTemplate: '关于钱的事，家里有安排的'
    },
    priority: 90,
    enabled: true
  },

  {
    id: 'rule_hard_003',
    type: 'hard',
    topic: {
      category: 'family_disputes',
      keywords: ['吵架', '矛盾', '不和', '闹翻', '关系不好'],
      description: '家庭内部的矛盾和冲突'
    },
    allowedAudience: {
      trustLevels: ['tier1_intimate', 'tier2_close'],
      excludeRelations: ['朋友', '同事', '邻居']
    },
    action: {
      type: 'redirect',
      redirectHint: '转移到积极的家庭话题'
    },
    priority: 80,
    enabled: true
  },

  // ========== 软规则（LLM自行判断）==========
  {
    id: 'rule_soft_001',
    type: 'soft',
    topic: {
      category: 'health_concerns',
      keywords: ['病情', '生病', '身体问题', '疾病'],
      description: '健康和医疗相关话题'
    },
    allowedAudience: {
      trustLevels: ['tier1_intimate', 'tier2_close', 'tier3_familiar']
    },
    action: {
      type: 'vague_response',
      vagueTemplate: '年纪大了，小毛病是难免的'
    },
    priority: 50,
    enabled: true
  },

  {
    id: 'rule_soft_002',
    type: 'soft',
    topic: {
      category: 'past_failures',
      keywords: ['失败', '挫折', '不如意', '跌倒'],
      description: '过去的失败经历'
    },
    allowedAudience: {
      trustLevels: ['tier1_intimate', 'tier2_close']
    },
    action: {
      type: 'vague_response'
    },
    priority: 40,
    enabled: true
  }
];

/**
 * 关系信任等级映射
 */
export const RELATION_TRUST_LEVELS = {
  // 最亲密层
  tier1_intimate: ['配偶', '丈夫', '妻子', '父亲', '母亲', '儿子', '女儿'],

  // 亲密层
  tier2_close: ['兄弟', '姐妹', '哥哥', '弟弟', '姐姐', '妹妹', '挚友', '闺蜜'],

  // 熟悉层
  tier3_familiar: ['朋友', '同事', '同学', '邻居'],

  // 熟人层
  tier4_acquaintance: ['普通朋友', '一般朋友', '认识的人']
};

/**
 * 安全护栏管理器
 */
class SafetyGuardrailsManager {
  constructor() {
    this.rules = [...DEFAULT_GUARDRAIL_RULES];
  }

  /**
   * 获取用户的护栏配置
   */
  getGuardrails(userId, customRules = []) {
    const guardrails = {
      rules: [...this.rules, ...customRules],
      defaultRuleSet: 'balanced',
      groupSettings: {
        autoStrictMode: true,
        defaultDisclosureLevel: 'lowest_common',
        conflictResolution: 'block_content'
      }
    };

    return guardrails;
  }

  /**
   * 检查话题是否允许
   * @returns {{ allowed: boolean, action: string, reason: string }}
   */
  checkTopicAllowed(topic, participants, guardrails) {
    const rules = guardrails.rules
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of rules) {
      // 检查是否匹配话题
      const matchesTopic = rule.topic.keywords.some(kw =>
        topic.toLowerCase().includes(kw.toLowerCase())
      );

      if (!matchesTopic) continue;

      // 检查是否有参与者被排除
      const excludedParticipant = participants.find(p => {
        const trustLevel = this.getTrustLevel(p.specificRelation);
        const isExcluded = rule.allowedAudience.excludeRelations?.includes(p.specificRelation);
        const isNotAllowed = !rule.allowedAudience.trustLevels.includes(trustLevel) &&
          !rule.allowedAudience.specificRelations?.includes(p.specificRelation);

        return isExcluded || isNotAllowed;
      });

      if (excludedParticipant) {
        return {
          allowed: false,
          action: rule.action.type,
          reason: `话题「${rule.topic.description}」不适合在当前群组讨论`,
          redirectHint: rule.action.redirectHint,
          vagueTemplate: rule.action.vagueTemplate
        };
      }
    }

    return { allowed: true, action: 'proceed', reason: '' };
  }

  /**
   * 获取关系的信任等级
   */
  getTrustLevel(specificRelation) {
    for (const [level, relations] of Object.entries(RELATION_TRUST_LEVELS)) {
      if (relations.includes(specificRelation)) {
        return level;
      }
    }
    return 'tier4_acquaintance';
  }

  /**
   * 生成群组安全约束 Prompt
   */
  generateGroupSafetyPrompt(guardrails, participants) {
    const activeRules = guardrails.rules
      .filter(r => r.enabled && r.type === 'hard')
      .sort((a, b) => b.priority - a.priority);

    if (activeRules.length === 0) return '';

    let prompt = `## 🔒 安全约束（群组模式激活）

### 话题限制
以下话题在当前群组中受到限制，请严格遵守：

${activeRules.map(rule => {
  const allowedTo = rule.allowedAudience.specificRelations?.join('、') || '仅特定亲密关系';
  const actionText = {
    block: '完全不可讨论',
    redirect: '避免讨论，如触及请自然转移话题',
    vague_response: '如被问及，请模糊回应'
  }[rule.action.type];

  return `**${rule.topic.description}**
- 敏感关键词：${rule.topic.keywords.join('、')}
- 允许对象：${allowedTo}
- 处理方式：${actionText}`;
}).join('\n\n')}

### 群组隐私原则
1. 假设群组中的任何信息都可能被传播
2. 不要分享任何只对其中部分人透露过的私密信息
3. 如果不确定某话题是否适合，宁可不提
4. 遇到敏感话题时，自然地转移到安全话题`;

    return prompt;
  }
}

export { SafetyGuardrailsManager };
export default new SafetyGuardrailsManager();
```

---

## Task 4.2: 创建校准层模块

**Files:**
- Create: `server/src/modules/rolecard/v2/calibrationLayer.js`

```javascript
// server/src/modules/rolecard/v2/calibrationLayer.js

import logger from '../../../core/utils/logger.js';

/**
 * 校准层配置
 */
export const DEFAULT_CALIBRATION_CONFIG = {
  // Token 数阈值
  tokenCountThreshold: 10000,
  minSampleCount: 5,
  minTokensPerConversation: 100,

  // 时间维度阈值
  maxCalibrationIntervalDays: 14,
  sampleDecayHalfLife: 7,
  minValidSampleWeight: 0.1,

  // 快速校准
  quickCalibration: {
    tokenRatio: 0.5,
    minDays: 3
  },

  // 高活跃用户
  highActivityCalibration: {
    tokensPerDay: 2000,
    minDays: 2
  },

  // 学习权重
  learningWeight: 0.1,
  baselineWeight: 0.9
};

/**
 * 特征枚举到数值的映射
 */
const TRAIT_TO_NUMBER = {
  boundaryThickness: { thick: 0, medium: 0.5, thin: 1 },
  discretionLevel: { excellent: 0, good: 0.33, moderate: 0.66, poor: 1 },
  impulsiveSpeech: { rare: 0, occasional: 0.33, often: 0.66, frequent: 1 },
  emotionalExpression: { reserved: 0, moderate: 0.5, expressive: 1 },
  socialCautiousness: { high: 0, moderate: 0.5, low: 1 }
};

/**
 * 校准层管理器
 */
class CalibrationLayerManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CALIBRATION_CONFIG, ...config };
  }

  /**
   * 创建初始校准层
   */
  createInitialCalibrationLayer(coreLayer) {
    const traitVector = this.traitsToVector(coreLayer.personalityTraits);

    return {
      baseline: {
        traitVector,
        behavioralIndicators: coreLayer.behavioralIndicators || [],
        generatedAt: new Date().toISOString(),
        sourceQuestionIds: coreLayer.sourceQuestionIds || []
      },
      currentState: {
        traitVector: { ...traitVector },
        lastUpdatedAt: new Date().toISOString(),
        totalConversations: 0,
        totalTokens: 0
      },
      learningSamples: {
        pending: [],
        incorporated: [],
        rejected: [],
        maxSamples: 100
      },
      calibrationConfig: this.config,
      calibrationHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * 特征枚举转数值向量
   */
  traitsToVector(traits) {
    const vector = {};

    for (const [key, mapping] of Object.entries(TRAIT_TO_NUMBER)) {
      const value = traits[key];
      vector[key] = mapping[value] ?? 0.5;
    }

    return vector;
  }

  /**
   * 计算漂移距离
   */
  calculateDriftDistance(v1, v2) {
    const dimensions = Object.keys(TRAIT_TO_NUMBER);
    const squaredDiffs = dimensions.map(dim => {
      return Math.pow((v1[dim] ?? 0.5) - (v2[dim] ?? 0.5), 2);
    });

    const sumSquared = squaredDiffs.reduce((sum, val) => sum + val, 0);
    return Math.sqrt(sumSquared) / Math.sqrt(dimensions.length);
  }

  /**
   * 计算时间衰减权重
   */
  calculateTimeDecayWeight(timestamp, currentTime = new Date()) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const ageInDays = (currentTime.getTime() - new Date(timestamp).getTime()) / msPerDay;
    const lambda = Math.LN2 / this.config.sampleDecayHalfLife;
    return Math.exp(-lambda * ageInDays);
  }

  /**
   * 检查是否需要校准
   */
  checkCalibrationNeeded(calibrationLayer) {
    const { baseline, currentState, calibrationConfig } = calibrationLayer;
    const now = new Date();

    // 1. 计算漂移距离
    const driftDistance = this.calculateDriftDistance(
      baseline.traitVector,
      currentState.traitVector
    );

    // 2. 检查 Token 阈值
    if (currentState.totalTokens >= calibrationConfig.tokenCountThreshold) {
      return {
        needed: true,
        reason: `Token数达到阈值 (${currentState.totalTokens}/${calibrationConfig.tokenCountThreshold})`,
        urgency: 'high',
        driftDistance
      };
    }

    // 3. 检查时间间隔
    const lastUpdate = new Date(currentState.lastUpdatedAt);
    const daysSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (24 * 60 * 60 * 1000);

    if (daysSinceUpdate >= calibrationConfig.maxCalibrationIntervalDays) {
      return {
        needed: true,
        reason: `距上次更新已过 ${daysSinceUpdate.toFixed(1)} 天`,
        urgency: daysSinceUpdate >= calibrationConfig.maxCalibrationIntervalDays * 1.5 ? 'high' : 'medium',
        driftDistance
      };
    }

    // 4. 快速校准条件
    const quickThreshold = calibrationConfig.tokenCountThreshold * calibrationConfig.quickCalibration.tokenRatio;
    if (currentState.totalTokens >= quickThreshold &&
        daysSinceUpdate >= calibrationConfig.quickCalibration.minDays) {
      return {
        needed: true,
        reason: `快速校准条件满足`,
        urgency: 'low',
        driftDistance
      };
    }

    // 5. 漂移距离检查
    if (driftDistance > calibrationConfig.autoCalibrationThreshold) {
      return {
        needed: true,
        reason: `漂移距离 ${driftDistance.toFixed(3)} 超过阈值`,
        urgency: 'medium',
        driftDistance
      };
    }

    return {
      needed: false,
      reason: '无需校准',
      urgency: 'low',
      driftDistance
    };
  }

  /**
   * 更新对话统计
   */
  updateConversationStats(calibrationLayer, tokens) {
    calibrationLayer.currentState.totalConversations += 1;
    calibrationLayer.currentState.totalTokens += tokens;
    calibrationLayer.currentState.lastUpdatedAt = new Date().toISOString();
    calibrationLayer.updatedAt = new Date().toISOString();

    return calibrationLayer;
  }
}

export { CalibrationLayerManager, DEFAULT_CALIBRATION_CONFIG };
export default new CalibrationLayerManager();
```

---

## Task 4.3: 更新 v2/index.js 导出

**Files:**
- Modify: `server/src/modules/rolecard/v2/index.js`

添加以下导出：

```javascript
// 在现有导出后添加

export { SafetyGuardrailsManager, DEFAULT_GUARDRAIL_RULES, RELATION_TRUST_LEVELS } from './safetyGuardrails.js';
export { CalibrationLayerManager, DEFAULT_CALIBRATION_CONFIG } from './calibrationLayer.js';
```

---

## 检查点

完成 Task 4.1-4.3 后，你应该有：

```
server/src/modules/rolecard/v2/
├── index.js                   ✅ (已更新)
├── coreLayerGenerator.js      ✅
├── relationLayerGenerator.js  ✅
├── safetyGuardrails.js        ✅ (新建)
├── calibrationLayer.js        ✅ (新建)
└── prompts/
    ├── coreExtraction.js      ✅
    └── relationExtraction.js  ✅
```

**下一步:** 继续阅读 Part 5 - 动态组装器和 LangGraph 集成
