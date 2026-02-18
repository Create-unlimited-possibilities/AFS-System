// server/src/modules/rolecard/v2/safetyGuardrails.js

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { profileLogger } from '../../../core/utils/logger.js';

// 获取项目根目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../..');

/**
 * 信任等级定义
 * 用于生成安全提示词时的说明
 */
export const TRUST_LEVEL_DEFINITIONS = {
  tier1_intimate: {
    name: '最亲密',
    description: '可以分享所有私密信息，包括财务、健康、情感秘密',
    characteristics: ['深度情感连接', '长期信任历史', '相互依赖']
  },
  tier2_close: {
    name: '亲近',
    description: '可以分享大部分个人事务，但某些极度私密话题会保留',
    characteristics: ['较强的情感连接', '经常交流', '相互支持']
  },
  tier3_familiar: {
    name: '一般熟悉',
    description: '有限度的信息分享，主要是日常话题',
    characteristics: ['有互动但不深入', '了解表面信息']
  },
  tier4_acquaintance: {
    name: '疏远/陌生人',
    description: '仅分享基本公共信息',
    characteristics: ['互动很少或不了解', '没有深入交流']
  }
};

/**
 * 默认安全规则（当配置文件不存在时使用）
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
    allowedAudience: { trustLevels: ['tier1_intimate'] },
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
    allowedAudience: { trustLevels: ['tier1_intimate'] },
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
    allowedAudience: { trustLevels: ['tier1_intimate', 'tier2_close'] },
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
 * 安全护栏管理器 V2
 * 从配置文件读取规则，使用 LLM 分析的 trustLevel 进行判断
 */
class SafetyGuardrailsManager {
  constructor() {
    this.rules = null;
    this.groupSettings = {
      autoStrictMode: true,
      defaultDisclosureLevel: 'lowest_common',
      conflictResolution: 'block_content'
    };
    this.configPath = this.getConfigPath();
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath() {
    // Docker 环境使用 /app/storage
    const isDocker = fs.existsSync('/.dockerenv') ||
                     process.env.DOCKER_CONTAINER === 'true' ||
                     process.env.NODE_ENV === 'docker';

    if (isDocker) {
      return '/app/storage/safety-rules.json';
    }
    return path.join(projectRoot, 'server', 'storage', 'safety-rules.json');
  }

  /**
   * 加载安全规则配置
   */
  async loadRules() {
    if (this.rules) {
      return this.rules;
    }

    try {
      const data = await fsPromises.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(data);

      this.rules = config.rules || DEFAULT_GUARDRAIL_RULES;
      this.groupSettings = config.groupSettings || this.groupSettings;

      profileLogger.info('安全规则配置已加载', {
        path: this.configPath,
        ruleCount: this.rules.length
      });

      return this.rules;
    } catch (error) {
      profileLogger.warn('安全规则配置文件不存在，使用默认规则', {
        path: this.configPath,
        error: error.message
      });
      this.rules = DEFAULT_GUARDRAIL_RULES;
      return this.rules;
    }
  }

  /**
   * 重新加载安全规则配置（用于热更新）
   */
  async reloadRules() {
    this.rules = null;
    return await this.loadRules();
  }

  /**
   * 获取护栏配置
   */
  async getGuardrails(userId, customRules = []) {
    const rules = await this.loadRules();
    return {
      rules: [...rules, ...customRules],
      defaultRuleSet: 'balanced',
      groupSettings: this.groupSettings
    };
  }

  /**
   * 获取参与者的信任等级
   * V2: 直接从 relationMeta.trustLevel 读取，无需硬编码映射
   * @param {Object} participant - 参与者对象
   * @returns {string} 信任等级
   */
  getTrustLevel(participant) {
    // 从 relationshipWithOwner 中获取 trustLevel
    const trustLevel = participant?.relationshipWithOwner?.trustLevel;

    if (trustLevel) {
      // 验证是否为有效的信任等级
      const validLevels = ['tier1_intimate', 'tier2_close', 'tier3_familiar', 'tier4_acquaintance'];
      if (validLevels.includes(trustLevel)) {
        return trustLevel;
      }
    }

    // 回退：基于 intimacyLevel 推断
    const intimacyLevel = participant?.relationshipWithOwner?.intimacyLevel;
    if (intimacyLevel) {
      switch (intimacyLevel) {
        case 'intimate': return 'tier1_intimate';
        case 'close': return 'tier2_close';
        case 'moderate': return 'tier3_familiar';
        default: return 'tier4_acquaintance';
      }
    }

    // 默认返回最低信任等级
    return 'tier4_acquaintance';
  }

  /**
   * 计算群组中所有参与者的信任等级
   */
  calculateGroupTrustLevels(participants) {
    if (!participants || participants.length === 0) {
      return ['tier4_acquaintance'];
    }

    return participants.map(p => this.getTrustLevel(p));
  }

  /**
   * 获取群组中的最低信任等级
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
   */
  shouldApplyRule(ruleTrustLevels, lowestGroupTier) {
    if (!ruleTrustLevels || ruleTrustLevels.length === 0) return true;

    const tierOrder = ['tier4_acquaintance', 'tier3_familiar', 'tier2_close', 'tier1_intimate'];
    const lowestIndex = tierOrder.indexOf(lowestGroupTier);

    for (const requiredTier of ruleTrustLevels) {
      const requiredIndex = tierOrder.indexOf(requiredTier);
      if (requiredIndex > lowestIndex) return true;
    }

    return false;
  }

  /**
   * 生成群组安全提示词
   */
  async generateGroupSafetyPrompt(guardrails, participants) {
    // 确保规则已加载
    const rules = guardrails?.rules || await this.loadRules();

    // 计算群组的最低信任等级
    const groupTrustLevels = this.calculateGroupTrustLevels(participants);
    const lowestTrustLevel = this.getLowestTrustLevel(groupTrustLevels);

    profileLogger.info('生成群组安全提示词', {
      participantCount: participants.length,
      groupTrustLevels,
      lowestTrustLevel
    });

    // 根据群组信任等级过滤规则
    const activeRules = rules
      .filter(r => {
        if (!r.enabled || r.type !== 'hard') return false;
        const ruleTrustLevels = r.allowedAudience?.trustLevels || [];
        return this.shouldApplyRule(ruleTrustLevels, lowestTrustLevel);
      })
      .sort((a, b) => b.priority - a.priority);

    if (activeRules.length === 0) return '';

    let prompt = `## 🔒 安全约束（群组模式激活）

### 当前群组信任等级
最低信任等级：**${TRUST_LEVEL_DEFINITIONS[lowestTrustLevel]?.name || lowestTrustLevel}**

### 话题限制
以下话题在当前群组中受到限制，请严格遵守：

${activeRules.map(rule => {
  const actionText = {
    block: '完全不可讨论',
    redirect: '避免讨论，如触及请自然转移话题',
    vague_response: '如被问及，请模糊回应'
  }[rule.action.type];

  return `**${rule.topic.description}**
- 敏感关键词：${rule.topic.keywords.join('、')}
- 处理方式：${actionText}${rule.action.vagueTemplate ? `\n- 模糊回应模板："${rule.action.vagueTemplate}"` : ''}${rule.action.redirectHint ? `\n- 转移方向：${rule.action.redirectHint}` : ''}`;
}).join('\n\n')}

### 群组隐私原则
1. 假设群组中的任何信息都可能被传播
2. 不要分享任何只对其中部分人透露过的私密信息
3. 如果不确定某话题是否适合，宁可不提
4. 遇到敏感话题时，自然地转移到安全话题`;

    return prompt;
  }

  /**
   * 保存安全规则配置
   */
  async saveRules(config) {
    try {
      const configDir = path.dirname(this.configPath);
      await fsPromises.mkdir(configDir, { recursive: true });

      const dataToSave = {
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        description: '全局安全护栏规则配置',
        trustLevelDefinitions: TRUST_LEVEL_DEFINITIONS,
        rules: config.rules,
        groupSettings: config.groupSettings || this.groupSettings
      };

      await fsPromises.writeFile(this.configPath, JSON.stringify(dataToSave, null, 2), 'utf-8');

      // 清除缓存，下次加载时重新读取
      this.rules = null;

      profileLogger.info('安全规则配置已保存', { path: this.configPath });
      return { success: true, path: this.configPath };
    } catch (error) {
      profileLogger.error('保存安全规则配置失败', { error: error.message });
      throw error;
    }
  }
}

export { SafetyGuardrailsManager };
export default new SafetyGuardrailsManager();
