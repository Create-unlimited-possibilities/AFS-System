// server/src/modules/rolecard/v2/safetyGuardrails.js

import logger from '../../../core/utils/logger.js';

/**
 * 系统默认的护栏规则
 */
export const DEFAULT_GUARDRAIL_RULES = [
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
    action: { type: 'block', redirectHint: '转移到家庭日常话题' },
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
    action: { type: 'vague_response', vagueTemplate: '关于钱的事，家里有安排的' },
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
    action: { type: 'redirect', redirectHint: '转移到积极的家庭话题' },
    priority: 80,
    enabled: true
  },
  {
    id: 'rule_soft_001',
    type: 'soft',
    topic: {
      category: 'health_concerns',
      keywords: ['病情', '生病', '身体问题', '疾病'],
      description: '健康和医疗相关话题'
    },
    allowedAudience: { trustLevels: ['tier1_intimate', 'tier2_close', 'tier3_familiar'] },
    action: { type: 'vague_response', vagueTemplate: '年纪大了，小毛病是难免的' },
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
    allowedAudience: { trustLevels: ['tier1_intimate', 'tier2_close'] },
    action: { type: 'vague_response' },
    priority: 40,
    enabled: true
  }
];

/**
 * 关系信任等级映射
 */
export const RELATION_TRUST_LEVELS = {
  tier1_intimate: ['配偶', '丈夫', '妻子', '父亲', '母亲', '儿子', '女儿'],
  tier2_close: ['兄弟', '姐妹', '哥哥', '弟弟', '姐姐', '妹妹', '挚友', '闺蜜'],
  tier3_familiar: ['朋友', '同事', '同学', '邻居'],
  tier4_acquaintance: ['普通朋友', '一般朋友', '认识的人']
};

class SafetyGuardrailsManager {
  constructor() {
    this.rules = [...DEFAULT_GUARDRAIL_RULES];
  }

  getGuardrails(userId, customRules = []) {
    return {
      rules: [...this.rules, ...customRules],
      defaultRuleSet: 'balanced',
      groupSettings: {
        autoStrictMode: true,
        defaultDisclosureLevel: 'lowest_common',
        conflictResolution: 'block_content'
      }
    };
  }

  getTrustLevel(specificRelation) {
    for (const [level, relations] of Object.entries(RELATION_TRUST_LEVELS)) {
      if (relations.includes(specificRelation)) return level;
    }
    return 'tier4_acquaintance';
  }

  generateGroupSafetyPrompt(guardrails, participants) {
    // 计算群组的最低信任等级
    const groupTrustLevels = this.calculateGroupTrustLevels(participants);
    const lowestTrustLevel = this.getLowestTrustLevel(groupTrustLevels);

    // 根据群组信任等级过滤规则
    const activeRules = guardrails.rules
      .filter(r => {
        if (!r.enabled || r.type !== 'hard') return false;
        // 检查规则的信任等级要求是否高于群组最低信任等级
        const ruleTrustLevels = r.allowedAudience?.trustLevels || [];
        // 如果规则要求的信任等级高于群组最低等级，则在当前群组中需要应用该规则
        return this.shouldApplyRule(ruleTrustLevels, lowestTrustLevel);
      })
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

  /**
   * 计算群组中所有参与者的信任等级
   * @param {Array} participants - 参与者列表
   * @returns {string[]} 信任等级数组
   */
  calculateGroupTrustLevels(participants) {
    if (!participants || participants.length === 0) return ['tier4_acquaintance'];

    return participants.map(p => {
      const relation = p.relationshipWithOwner?.specificRelation || p.relation;
      return this.getTrustLevel(relation);
    });
  }

  /**
   * 获取群组中的最低信任等级
   * @param {string[]} trustLevels - 信任等级数组
   * @returns {string} 最低信任等级
   */
  getLowestTrustLevel(trustLevels) {
    const tierOrder = ['tier4_acquaintance', 'tier3_familiar', 'tier2_close', 'tier1_intimate'];
    for (const tier of tierOrder) {
      if (trustLevels.includes(tier)) return tier;
    }
    return 'tier4_acquaintance';
  }

  /**
   * 判断规则是否应该在当前群组中应用
   * @param {string[]} ruleTrustLevels - 规则要求的信任等级
   * @param {string} lowestGroupTier - 群组最低信任等级
   * @returns {boolean} 是否应用规则
   */
  shouldApplyRule(ruleTrustLevels, lowestGroupTier) {
    if (!ruleTrustLevels || ruleTrustLevels.length === 0) return true;

    const tierOrder = ['tier4_acquaintance', 'tier3_familiar', 'tier2_close', 'tier1_intimate'];
    const lowestIndex = tierOrder.indexOf(lowestGroupTier);

    // 如果群组中有低信任等级成员，规则要求的信任等级越高，越需要应用
    // 例如：tier1 专属话题在 tier4 成员在场时需要被限制
    for (const requiredTier of ruleTrustLevels) {
      const requiredIndex = tierOrder.indexOf(requiredTier);
      // 如果规则要求的信任等级高于群组最低等级，则需要应用该规则
      if (requiredIndex > lowestIndex) return true;
    }

    return false;
  }
}

export { SafetyGuardrailsManager };
export default new SafetyGuardrailsManager();
