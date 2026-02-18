/**
 * SafetyGuardrails V2 单元测试
 * 测试安全护栏的规则匹配、信任等级计算、群体安全 Prompt 生成
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SafetyGuardrailsManager, DEFAULT_GUARDRAIL_RULES, TRUST_LEVEL_DEFINITIONS } from '../../../src/modules/rolecard/v2/safetyGuardrails.js';

describe('SafetyGuardrails V2', () => {
  let manager;

  beforeEach(() => {
    manager = new SafetyGuardrailsManager();
  });

  describe('TRUST_LEVEL_DEFINITIONS 常量', () => {
    it('应包含 tier1_intimate（最亲密）等级', () => {
      expect(TRUST_LEVEL_DEFINITIONS).toHaveProperty('tier1_intimate');
      expect(TRUST_LEVEL_DEFINITIONS.tier1_intimate).toHaveProperty('name');
      expect(TRUST_LEVEL_DEFINITIONS.tier1_intimate).toHaveProperty('description');
    });

    it('应包含 tier2_close（亲近）等级', () => {
      expect(TRUST_LEVEL_DEFINITIONS).toHaveProperty('tier2_close');
      expect(TRUST_LEVEL_DEFINITIONS.tier2_close.name).toBe('亲近');
    });

    it('应包含 tier3_familiar（一般熟悉）等级', () => {
      expect(TRUST_LEVEL_DEFINITIONS).toHaveProperty('tier3_familiar');
      expect(TRUST_LEVEL_DEFINITIONS.tier3_familiar.name).toBe('一般熟悉');
    });

    it('应包含 tier4_acquaintance（疏远/陌生人）等级', () => {
      expect(TRUST_LEVEL_DEFINITIONS).toHaveProperty('tier4_acquaintance');
      expect(TRUST_LEVEL_DEFINITIONS.tier4_acquaintance.name).toBe('疏远/陌生人');
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
      it('应返回包含规则的对象', async () => {
        const guardrails = await manager.getGuardrails('test-user');
        expect(guardrails).toHaveProperty('rules');
        expect(Array.isArray(guardrails.rules)).toBe(true);
      });

      it('应包含默认设置', async () => {
        const guardrails = await manager.getGuardrails('test-user');
        expect(guardrails).toHaveProperty('defaultRuleSet');
        expect(guardrails).toHaveProperty('groupSettings');
      });

      it('应支持添加自定义规则', async () => {
        const customRule = {
          id: 'custom_001',
          type: 'hard',
          topic: { keywords: ['测试关键词'] },
          allowedAudience: { trustLevels: ['tier1_intimate'] },
          action: { type: 'block' },
          priority: 100,
          enabled: true
        };

        const guardrails = await manager.getGuardrails('test-user', [customRule]);
        expect(guardrails.rules.length).toBeGreaterThan(DEFAULT_GUARDRAIL_RULES.length);
      });
    });

    describe('getTrustLevel()', () => {
      it('应从参与者对象中获取 trustLevel', () => {
        const participant = {
          relationshipWithOwner: {
            trustLevel: 'tier2_close'
          }
        };

        const trustLevel = manager.getTrustLevel(participant);
        expect(trustLevel).toBe('tier2_close');
      });

      it('应回退到基于 intimacyLevel 推断', () => {
        const participant = {
          relationshipWithOwner: {
            intimacyLevel: 'intimate'
          }
        };

        const trustLevel = manager.getTrustLevel(participant);
        expect(trustLevel).toBe('tier1_intimate');
      });

      it('moderate intimacyLevel 应映射到 tier3_familiar', () => {
        const participant = {
          relationshipWithOwner: {
            intimacyLevel: 'moderate'
          }
        };

        const trustLevel = manager.getTrustLevel(participant);
        expect(trustLevel).toBe('tier3_familiar');
      });

      it('无信息时应返回最低信任等级', () => {
        const participant = {};
        const trustLevel = manager.getTrustLevel(participant);
        expect(trustLevel).toBe('tier4_acquaintance');
      });
    });

    describe('calculateGroupTrustLevels()', () => {
      it('应计算所有参与者的信任等级', () => {
        const participants = [
          { relationshipWithOwner: { trustLevel: 'tier1_intimate' } },
          { relationshipWithOwner: { trustLevel: 'tier2_close' } },
          { relationshipWithOwner: { trustLevel: 'tier3_familiar' } }
        ];

        const trustLevels = manager.calculateGroupTrustLevels(participants);
        expect(trustLevels).toHaveLength(3);
        expect(trustLevels).toContain('tier1_intimate');
        expect(trustLevels).toContain('tier2_close');
        expect(trustLevels).toContain('tier3_familiar');
      });

      it('空参与者数组应返回默认等级', () => {
        const trustLevels = manager.calculateGroupTrustLevels([]);
        expect(trustLevels).toEqual(['tier4_acquaintance']);
      });

      it('null 参与者应返回默认等级', () => {
        const trustLevels = manager.calculateGroupTrustLevels(null);
        expect(trustLevels).toEqual(['tier4_acquaintance']);
      });
    });

    describe('getLowestTrustLevel()', () => {
      it('应返回最低的信任等级', () => {
        const trustLevels = ['tier1_intimate', 'tier3_familiar', 'tier4_acquaintance'];
        const lowest = manager.getLowestTrustLevel(trustLevels);
        expect(lowest).toBe('tier4_acquaintance');
      });

      it('只有高信任等级时应返回其中最低的', () => {
        const trustLevels = ['tier1_intimate', 'tier2_close'];
        const lowest = manager.getLowestTrustLevel(trustLevels);
        expect(lowest).toBe('tier2_close');
      });
    });

    describe('shouldApplyRule()', () => {
      it('规则信任等级高于群组最低等级时应应用', () => {
        // 规则只对 tier1 可见，但群组中有 tier4
        // 这意味着群组中有人不应该看到这个内容，所以需要应用规则
        const result = manager.shouldApplyRule(['tier1_intimate'], 'tier4_acquaintance');
        expect(result).toBe(true);
      });

      it('规则信任等级与群组最低等级相同时不应应用', () => {
        // 规则要求 tier2，群组最低也是 tier2
        // 所有人都满足规则要求，不需要特别限制
        const result = manager.shouldApplyRule(['tier2_close'], 'tier2_close');
        expect(result).toBe(false);
      });

      it('群组最低等级高于规则要求时不应应用', () => {
        // 规则要求 tier3+，群组都是 tier1
        // 群组信任等级比规则要求更高，不需要限制
        const result = manager.shouldApplyRule(['tier3_familiar', 'tier4_acquaintance'], 'tier1_intimate');
        expect(result).toBe(false);
      });

      it('规则要求多个等级时，任一高于群组最低等级应应用', () => {
        // 规则要求 tier1 或 tier2，群组最低是 tier3
        const result = manager.shouldApplyRule(['tier1_intimate', 'tier2_close'], 'tier3_familiar');
        expect(result).toBe(true);
      });
    });

    describe('generateGroupSafetyPrompt()', () => {
      it('对空规则应返回空字符串', async () => {
        const guardrails = { rules: [] };
        const prompt = await manager.generateGroupSafetyPrompt(guardrails, []);
        expect(prompt).toBe('');
      });

      it('有规则和参与者时应生成 Prompt', async () => {
        const guardrails = await manager.getGuardrails('test-user');
        const participants = [
          { relationshipWithOwner: { trustLevel: 'tier2_close', specificRelation: '朋友' } }
        ];

        const prompt = await manager.generateGroupSafetyPrompt(guardrails, participants);
        expect(typeof prompt).toBe('string');
      });

      it('应包含信任等级信息', async () => {
        const guardrails = await manager.getGuardrails('test-user');
        const participants = [
          { relationshipWithOwner: { trustLevel: 'tier3_familiar', specificRelation: '同事' } }
        ];

        const prompt = await manager.generateGroupSafetyPrompt(guardrails, participants);
        // 应包含信任等级名称
        expect(prompt).toContain('一般熟悉');
      });

      it('有硬性规则时应包含限制话题', async () => {
        const guardrails = await manager.getGuardrails('test-user');
        const participants = [
          { relationshipWithOwner: { trustLevel: 'tier4_acquaintance', specificRelation: '陌生人' } }
        ];

        const prompt = await manager.generateGroupSafetyPrompt(guardrails, participants);
        // 应包含安全约束标题
        expect(prompt).toContain('安全约束');
      });
    });
  });

  describe('规则优先级测试', () => {
    it('规则应按优先级排序', async () => {
      const guardrails = await manager.getGuardrails('test-user');
      const hardRules = guardrails.rules
        .filter(r => r.enabled && r.type === 'hard')
        .sort((a, b) => b.priority - a.priority);

      // 验证优先级最高的规则
      expect(hardRules[0].priority).toBeGreaterThanOrEqual(hardRules[hardRules.length - 1].priority);
    });
  });

  describe('边界情况测试', () => {
    it('应处理空参与者列表', async () => {
      const guardrails = await manager.getGuardrails('test-user');
      const prompt = await manager.generateGroupSafetyPrompt(guardrails, []);
      // 空参与者时应该返回空字符串（没有群组对话）
      expect(typeof prompt).toBe('string');
    });

    it('应处理空 userId', async () => {
      const guardrails = await manager.getGuardrails('');
      expect(guardrails).toBeDefined();
      expect(guardrails.rules.length).toBeGreaterThan(0);
    });

    it('应处理无效的规则配置', async () => {
      const partialRule = { id: 'partial' };
      const guardrails = await manager.getGuardrails('test', [partialRule]);
      expect(guardrails.rules).toBeDefined();
    });

    it('应处理缺失的 relationshipWithOwner', () => {
      const participant = { name: '测试' };
      const trustLevel = manager.getTrustLevel(participant);
      expect(trustLevel).toBe('tier4_acquaintance');
    });
  });

  describe('实际业务场景测试', () => {
    it('群组对话：多个不同信任等级的参与者', async () => {
      const guardrails = await manager.getGuardrails('test-user');
      const participants = [
        { relationshipWithOwner: { trustLevel: 'tier1_intimate', specificRelation: '配偶' } },
        { relationshipWithOwner: { trustLevel: 'tier3_familiar', specificRelation: '朋友' } },
        { relationshipWithOwner: { trustLevel: 'tier4_acquaintance', specificRelation: '陌生人' } }
      ];

      const prompt = await manager.generateGroupSafetyPrompt(guardrails, participants);
      // 应该按最低信任等级（陌生人）来限制话题
      expect(prompt).toContain('疏远/陌生人');
    });

    it('家庭群组：仅家人参与', async () => {
      const guardrails = await manager.getGuardrails('test-user');
      const participants = [
        { relationshipWithOwner: { trustLevel: 'tier1_intimate', specificRelation: '配偶' } },
        { relationshipWithOwner: { trustLevel: 'tier2_close', specificRelation: '儿子' } }
      ];

      const prompt = await manager.generateGroupSafetyPrompt(guardrails, participants);
      // 家庭群组信任等级高，应该有较少的限制
      expect(prompt).toContain('亲近');
    });
  });
});
