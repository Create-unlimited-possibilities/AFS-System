/**
 * SafetyGuardrails V2 单元测试
 * 测试安全护栏的规则匹配、信任等级计算、群体安全 Prompt 生成
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SafetyGuardrailsManager, DEFAULT_GUARDRAIL_RULES, RELATION_TRUST_LEVELS } from '../../../src/modules/rolecard/v2/safetyGuardrails.js';

describe('SafetyGuardrails V2', () => {
  let manager;

  beforeEach(() => {
    manager = new SafetyGuardrailsManager();
  });

  describe('RELATION_TRUST_LEVELS 常量', () => {
    it('应包含 tier1_intimate（最亲密）等级', () => {
      expect(RELATION_TRUST_LEVELS).toHaveProperty('tier1_intimate');
      expect(Array.isArray(RELATION_TRUST_LEVELS.tier1_intimate)).toBe(true);
      expect(RELATION_TRUST_LEVELS.tier1_intimate).toContain('配偶');
      expect(RELATION_TRUST_LEVELS.tier1_intimate).toContain('儿子');
      expect(RELATION_TRUST_LEVELS.tier1_intimate).toContain('女儿');
    });

    it('应包含 tier2_close（亲密）等级', () => {
      expect(RELATION_TRUST_LEVELS).toHaveProperty('tier2_close');
      expect(RELATION_TRUST_LEVELS.tier2_close).toContain('兄弟');
      expect(RELATION_TRUST_LEVELS.tier2_close).toContain('姐妹');
      expect(RELATION_TRUST_LEVELS.tier2_close).toContain('挚友');
    });

    it('应包含 tier3_familiar（熟悉）等级', () => {
      expect(RELATION_TRUST_LEVELS).toHaveProperty('tier3_familiar');
      expect(RELATION_TRUST_LEVELS.tier3_familiar).toContain('朋友');
      expect(RELATION_TRUST_LEVELS.tier3_familiar).toContain('同事');
    });

    it('应包含 tier4_acquaintance（泛泛之交）等级', () => {
      expect(RELATION_TRUST_LEVELS).toHaveProperty('tier4_acquaintance');
      expect(Array.isArray(RELATION_TRUST_LEVELS.tier4_acquaintance)).toBe(true);
    });
  });

  describe('DEFAULT_GUARDRAIL_RULES 常量', () => {
    it('应是一个数组', () => {
      expect(Array.isArray(DEFAULT_GUARDRAIL_RULES)).toBe(true);
      expect(DEFAULT_GUARDRAIL_RULES.length).toBeGreaterThan(0);
    });

    it('每个规则应包含必要字段', () => {
      DEFAULT_GUARDRAIL_RULES.forEach(rule => {
        expect(rule).toHaveProperty('id');
        expect(rule).toHaveProperty('type');
        expect(rule).toHaveProperty('topic');
        expect(rule).toHaveProperty('allowedAudience');
        expect(rule).toHaveProperty('action');
        expect(rule).toHaveProperty('priority');
        expect(rule).toHaveProperty('enabled');
      });
    });

    it('应包含硬性规则（type=hard）', () => {
      const hardRules = DEFAULT_GUARDRAIL_RULES.filter(r => r.type === 'hard');
      expect(hardRules.length).toBeGreaterThan(0);
    });

    it('应包含软性规则（type=soft）', () => {
      const softRules = DEFAULT_GUARDRAIL_RULES.filter(r => r.type === 'soft');
      expect(softRules.length).toBeGreaterThan(0);
    });

    it('规则应包含话题关键词', () => {
      DEFAULT_GUARDRAIL_RULES.forEach(rule => {
        expect(rule.topic).toHaveProperty('keywords');
        expect(Array.isArray(rule.topic.keywords)).toBe(true);
        expect(rule.topic.keywords.length).toBeGreaterThan(0);
      });
    });
  });

  describe('SafetyGuardrailsManager 类', () => {
    describe('getGuardrails()', () => {
      it('应返回包含规则的对象', () => {
        const guardrails = manager.getGuardrails('test-user');
        expect(guardrails).toHaveProperty('rules');
        expect(Array.isArray(guardrails.rules)).toBe(true);
      });

      it('应包含默认设置', () => {
        const guardrails = manager.getGuardrails('test-user');
        expect(guardrails).toHaveProperty('defaultRuleSet');
        expect(guardrails).toHaveProperty('groupSettings');
      });

      it('应支持添加自定义规则', () => {
        const customRule = {
          id: 'custom_001',
          type: 'hard',
          topic: { keywords: ['测试关键词'] },
          allowedAudience: { trustLevels: ['tier1_intimate'] },
          action: { type: 'block' },
          priority: 99,
          enabled: true
        };
        const guardrails = manager.getGuardrails('test-user', [customRule]);
        const customFound = guardrails.rules.find(r => r.id === 'custom_001');
        expect(customFound).toBeDefined();
      });
    });

    describe('getTrustLevel()', () => {
      it('对 tier1 关系应返回 tier1_intimate', () => {
        expect(manager.getTrustLevel('配偶')).toBe('tier1_intimate');
        expect(manager.getTrustLevel('妻子')).toBe('tier1_intimate');
        expect(manager.getTrustLevel('儿子')).toBe('tier1_intimate');
        expect(manager.getTrustLevel('女儿')).toBe('tier1_intimate');
      });

      it('对 tier2 关系应返回 tier2_close', () => {
        expect(manager.getTrustLevel('兄弟')).toBe('tier2_close');
        expect(manager.getTrustLevel('姐妹')).toBe('tier2_close');
        expect(manager.getTrustLevel('挚友')).toBe('tier2_close');
      });

      it('对 tier3 关系应返回 tier3_familiar', () => {
        expect(manager.getTrustLevel('朋友')).toBe('tier3_familiar');
        expect(manager.getTrustLevel('同事')).toBe('tier3_familiar');
      });

      it('对未知关系应返回 tier4_acquaintance', () => {
        expect(manager.getTrustLevel('陌生人')).toBe('tier4_acquaintance');
        expect(manager.getTrustLevel(null)).toBe('tier4_acquaintance');
        expect(manager.getTrustLevel(undefined)).toBe('tier4_acquaintance');
        expect(manager.getTrustLevel('')).toBe('tier4_acquaintance');
      });
    });

    describe('generateGroupSafetyPrompt()', () => {
      it('应生成包含安全约束的 Prompt', () => {
        const guardrails = manager.getGuardrails('test-user');
        const prompt = manager.generateGroupSafetyPrompt(guardrails, [
          { relation: '儿子' },
          { relation: '朋友' }
        ]);
        expect(prompt).toContain('安全约束');
        expect(prompt).toContain('话题限制');
        expect(typeof prompt).toBe('string');
      });

      it('应只包含硬性规则', () => {
        const guardrails = manager.getGuardrails('test-user');
        const prompt = manager.generateGroupSafetyPrompt(guardrails, []);
        // 软性规则关键词不应出现在安全约束中
        expect(prompt).not.toContain('健康和医疗');
      });

      it('应包含硬性规则的描述', () => {
        const guardrails = manager.getGuardrails('test-user');
        const prompt = manager.generateGroupSafetyPrompt(guardrails, []);
        const hardRules = DEFAULT_GUARDRAIL_RULES.filter(r => r.type === 'hard');
        hardRules.forEach(rule => {
          expect(prompt).toContain(rule.topic.description);
        });
      });

      it('应包含群组隐私原则', () => {
        const guardrails = manager.getGuardrails('test-user');
        const prompt = manager.generateGroupSafetyPrompt(guardrails, []);
        expect(prompt).toContain('群组隐私原则');
      });

      it('对空规则应返回空字符串', () => {
        const emptyGuardrails = { rules: [] };
        const prompt = manager.generateGroupSafetyPrompt(emptyGuardrails, []);
        expect(prompt).toBe('');
      });

      it('应按优先级排序规则', () => {
        const guardrails = manager.getGuardrails('test-user');
        const prompt = manager.generateGroupSafetyPrompt(guardrails, []);
        // 最高优先级规则应最先出现
        const hardRules = DEFAULT_GUARDRAIL_RULES
          .filter(r => r.type === 'hard' && r.enabled)
          .sort((a, b) => b.priority - a.priority);

        if (hardRules.length >= 2) {
          const firstIndex = prompt.indexOf(hardRules[0].topic.description);
          const secondIndex = prompt.indexOf(hardRules[1].topic.description);
          expect(firstIndex).toBeLessThan(secondIndex);
        }
      });
    });
  });

  describe('实际数据测试', () => {
    it('应正确处理测试用户的家人关系', () => {
      // 测试用户 698abdf152e5e295fe72c0a0 的 Bste 数据中有 helper_698c032cfaf605eff2a230d4 (邓榕)
      // 这是子女关系
      const trustLevel = manager.getTrustLevel('女儿');
      expect(trustLevel).toBe('tier1_intimate');
    });

    it('应为混合群组生成正确的安全 Prompt（限制 tier1 专属话题）', () => {
      // 当群组中有 tier3 成员（朋友）和 tier1 成员（女儿）时
      // tier1 专属话题（如夫妻私密关系）应该被限制
      const guardrails = manager.getGuardrails('698abdf152e5e295fe72c0a0');
      const prompt = manager.generateGroupSafetyPrompt(guardrails, [
        { relationshipWithOwner: { specificRelation: '女儿' }, nickname: '邓榕' },
        { relationshipWithOwner: { specificRelation: '朋友' }, nickname: '朋友' }
      ]);

      // 应包含夫妻亲密关系的限制（因为有朋友在场，不应该讨论）
      expect(prompt).toContain('夫妻/伴侣间的私密关系细节');
    });

    it('仅为 tier1 成员时不应限制 tier1 专属话题', () => {
      const guardrails = manager.getGuardrails('test-user');
      const prompt = manager.generateGroupSafetyPrompt(guardrails, [
        { relationshipWithOwner: { specificRelation: '配偶' } },
        { relationshipWithOwner: { specificRelation: '女儿' } }
      ]);

      // 全员 tier1，不应限制 tier1 专属话题
      expect(prompt).not.toContain('夫妻/伴侣间的私密关系细节');
    });
  });

  describe('群组信任等级计算测试', () => {
    it('应正确计算群组信任等级', () => {
      const participants = [
        { relationshipWithOwner: { specificRelation: '配偶' } },
        { relationshipWithOwner: { specificRelation: '儿子' } }
      ];
      const trustLevels = manager.calculateGroupTrustLevels(participants);
      expect(trustLevels).toContain('tier1_intimate');
    });

    it('应识别群组中的最低信任等级', () => {
      const participants = [
        { relationshipWithOwner: { specificRelation: '配偶' } },
        { relationshipWithOwner: { specificRelation: '朋友' } }
      ];
      const trustLevels = manager.calculateGroupTrustLevels(participants);
      const lowest = manager.getLowestTrustLevel(trustLevels);
      expect(lowest).toBe('tier3_familiar');
    });

    it('陌生人应降低群组信任等级', () => {
      const participants = [
        { relationshipWithOwner: { specificRelation: '配偶' } },
        { relationshipWithOwner: { specificRelation: '陌生人' } }
      ];
      const trustLevels = manager.calculateGroupTrustLevels(participants);
      const lowest = manager.getLowestTrustLevel(trustLevels);
      expect(lowest).toBe('tier4_acquaintance');
    });

    it('空参与者应返回最低信任等级', () => {
      const trustLevels = manager.calculateGroupTrustLevels([]);
      expect(trustLevels).toContain('tier4_acquaintance');
    });
  });

  describe('规则过滤测试', () => {
    it('tier1 专属规则在混合群组中应被应用', () => {
      // 规则只允许 tier1_intimate，但群组中有 tier3 成员
      const ruleTrustLevels = ['tier1_intimate'];
      const lowestGroupTier = 'tier3_familiar';
      const shouldApply = manager.shouldApplyRule(ruleTrustLevels, lowestGroupTier);
      expect(shouldApply).toBe(true);
    });

    it('全员可见规则应始终应用', () => {
      const ruleTrustLevels = [];
      const lowestGroupTier = 'tier4_acquaintance';
      const shouldApply = manager.shouldApplyRule(ruleTrustLevels, lowestGroupTier);
      expect(shouldApply).toBe(true);
    });

    it('当群组全员满足规则要求时规则不应额外限制', () => {
      // 规则要求 tier2，群组全员都是 tier1（更高信任）
      const ruleTrustLevels = ['tier2_close'];
      const lowestGroupTier = 'tier1_intimate';
      const shouldApply = manager.shouldApplyRule(ruleTrustLevels, lowestGroupTier);
      expect(shouldApply).toBe(false);
    });
  });

  describe('边界情况测试', () => {
    it('应处理空参与者列表', () => {
      const guardrails = manager.getGuardrails('test-user');
      const prompt = manager.generateGroupSafetyPrompt(guardrails, []);
      // 即使没有参与者，只要有规则就应该生成 Prompt
      expect(typeof prompt).toBe('string');
    });

    it('应处理空 userId', () => {
      const guardrails = manager.getGuardrails('');
      expect(guardrails).toBeDefined();
      expect(guardrails.rules.length).toBeGreaterThan(0);
    });

    it('应处理无效的规则配置', () => {
      // 传入部分规则，确保系统不会崩溃
      const partialRule = { id: 'partial' };
      const guardrails = manager.getGuardrails('test', [partialRule]);
      expect(guardrails.rules).toBeDefined();
    });
  });
});
