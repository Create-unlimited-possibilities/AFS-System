/**
 * PromptAssembler V2 单元测试
 * 测试 Prompt 组装器的特征→语言转换、Prompt 组装
 */

import { describe, it, expect, beforeEach } from 'vitest';
import PromptAssembler from '../../../src/modules/rolecard/v2/promptAssembler.js';

describe('PromptAssembler V2', () => {
  let assembler;

  // 模拟 TraitLanguageConverter 是内部对象，通过测试公共方法来间接测试
  beforeEach(() => {
    assembler = new PromptAssembler();
  });

  // 测试用的模拟数据
  const createMockCoreLayer = () => ({
    personalityTraits: {
      boundaryThickness: 'medium',
      discretionLevel: 'good',
      impulsiveSpeech: 'occasional',
      emotionalExpression: 'moderate',
      socialCautiousness: 'moderate'
    },
    communicationStyle: {
      tonePattern: '温和亲切',
      preferredTopics: ['家庭', '健康', '往事'],
      avoidedTopics: ['政治', '宗教'],
      humorStyle: 'light',
      verbosity: 'moderate'
    },
    selfPerception: {
      selfDescriptionKeywords: ['务实', '坚韧'],
      coreValues: ['家庭和睦', '身体健康'],
      lifePriorities: ['家人', '健康']
    },
    behavioralIndicators: [
      { trigger: '遇到困难', response: '冷静思考解决方案', confidence: 'high' }
    ]
  });

  const createMockRelationLayer = () => ({
    perceivedByAssistant: {
      personalityDescription: '温柔体贴，善解人意',
      strengths: ['孝顺', '懂事'],
      weaknesses: ['有时太操心']
    },
    conversationGuidance: {
      suggestedAttitude: '亲切关怀',
      suggestedTone: '温暖',
      personalityToDisplay: '慈爱的一面',
      topicTendencies: {
        preferred: ['家庭生活', '健康养生'],
        avoid: ['工作压力']
      }
    },
    sharedMemories: [
      { content: '小时候一起在院子里种菜', importance: 0.8 }
    ]
  });

  const createMockDynamicData = (participants = []) => ({
    roleCardOwner: {
      nickname: '测试用户',
      name: '张三',
      demographicInfo: { age: 75 }
    },
    participants
  });

  describe('assemble() 方法', () => {
    it('应返回包含 systemPrompt 的结果', () => {
      const coreLayer = createMockCoreLayer();
      const dynamicData = createMockDynamicData();

      const result = assembler.assemble({
        coreLayer,
        relationLayers: {},
        guardrails: { rules: [] },
        dynamicData
      });

      expect(result).toHaveProperty('systemPrompt');
      expect(typeof result.systemPrompt).toBe('string');
      expect(result.systemPrompt.length).toBeGreaterThan(0);
    });

    it('应返回包含 metadata 的结果', () => {
      const coreLayer = createMockCoreLayer();
      const dynamicData = createMockDynamicData();

      const result = assembler.assemble({
        coreLayer,
        relationLayers: {},
        guardrails: { rules: [] },
        dynamicData
      });

      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('assembledAt');
      expect(result.metadata).toHaveProperty('participantCount');
      expect(result.metadata).toHaveProperty('isGroupConversation');
    });

    it('单人对话不应应用安全规则', () => {
      const coreLayer = createMockCoreLayer();
      const dynamicData = createMockDynamicData([{
        nickname: '儿子',
        relationshipWithOwner: { specificRelation: '儿子', intimacyLevel: 'intimate' },
        assistantPersonality: { description: '孝顺', source: 'relation_layer' }
      }]);

      const result = assembler.assemble({
        coreLayer,
        relationLayers: {},
        guardrails: { rules: [{ id: 'test', enabled: true }] },
        dynamicData
      });

      expect(result.metadata.safetyRulesApplied).toBe(0);
      expect(result.metadata.isGroupConversation).toBe(false);
    });

    it('群组对话应应用安全规则', () => {
      const coreLayer = createMockCoreLayer();
      const dynamicData = createMockDynamicData([
        { nickname: '儿子', relationshipWithOwner: { specificRelation: '儿子' } },
        { nickname: '朋友', relationshipWithOwner: { specificRelation: '朋友' } }
      ]);

      const result = assembler.assemble({
        coreLayer,
        relationLayers: {},
        guardrails: { rules: [{ id: 'test', enabled: true }] },
        dynamicData
      });

      expect(result.metadata.isGroupConversation).toBe(true);
      expect(result.metadata.safetyRulesApplied).toBeGreaterThan(0);
    });
  });

  describe('buildIdentitySection() 方法', () => {
    it('应包含身份标识', () => {
      const coreLayer = createMockCoreLayer();
      const dynamicData = createMockDynamicData();

      const section = assembler.buildIdentitySection(coreLayer, dynamicData);

      expect(section).toContain('你的身份');
      expect(section).toContain('测试用户');
    });

    it('应包含年龄信息', () => {
      const coreLayer = createMockCoreLayer();
      const dynamicData = createMockDynamicData();

      const section = assembler.buildIdentitySection(coreLayer, dynamicData);

      expect(section).toContain('75岁');
    });

    it('应包含核心性格描述', () => {
      const coreLayer = createMockCoreLayer();
      const dynamicData = createMockDynamicData();

      const section = assembler.buildIdentitySection(coreLayer, dynamicData);

      expect(section).toContain('核心性格');
      expect(section).toContain('边界意识');
      expect(section).toContain('守密程度');
    });

    it('应包含沟通风格', () => {
      const coreLayer = createMockCoreLayer();
      const dynamicData = createMockDynamicData();

      const section = assembler.buildIdentitySection(coreLayer, dynamicData);

      expect(section).toContain('沟通风格');
      expect(section).toContain('温和亲切');
      expect(section).toContain('家庭');
    });

    it('应处理缺失的 optional 字段', () => {
      const coreLayer = {
        personalityTraits: {
          boundaryThickness: 'medium',
          discretionLevel: 'good',
          impulsiveSpeech: 'occasional',
          emotionalExpression: 'moderate',
          socialCautiousness: 'moderate'
        },
        communicationStyle: {},
        selfPerception: {}
      };
      const dynamicData = {
        roleCardOwner: { nickname: '测试' }
      };

      const section = assembler.buildIdentitySection(coreLayer, dynamicData);

      expect(section).toBeDefined();
      expect(section.length).toBeGreaterThan(0);
    });
  });

  describe('buildRelationSection() 方法', () => {
    it('无参与者时应返回空字符串', () => {
      const dynamicData = { participants: [] };

      const section = assembler.buildRelationSection({}, dynamicData, false);

      expect(section).toBe('');
    });

    it('单人对话应生成单人对战区域', () => {
      const participants = [{
        nickname: '儿子',
        relationshipWithOwner: {
          specificRelation: '儿子',
          intimacyLevel: 'intimate',
          hasRelationLayer: false
        },
        assistantPersonality: { description: '孝顺', source: 'relation_layer' }
      }];

      const section = assembler.buildRelationSection({}, { participants }, false);

      expect(section).toContain('对话对象');
      expect(section).toContain('儿子');
    });

    it('群组对话应生成群组区域', () => {
      const participants = [
        { nickname: '儿子', relationshipWithOwner: { specificRelation: '儿子', intimacyLevel: 'intimate', hasRelationLayer: false } },
        { nickname: '朋友', relationshipWithOwner: { specificRelation: '朋友', intimacyLevel: 'moderate', hasRelationLayer: false } }
      ];

      const section = assembler.buildRelationSection({}, { participants }, true);

      expect(section).toContain('群组对话情境');
      expect(section).toContain('儿子');
      expect(section).toContain('朋友');
    });
  });

  describe('buildGuidanceSection() 方法', () => {
    it('应包含基本原则', () => {
      const coreLayer = createMockCoreLayer();
      const dynamicData = createMockDynamicData();

      const section = assembler.buildGuidanceSection(coreLayer, dynamicData, false);

      expect(section).toContain('行为准则');
      expect(section).toContain('基本原则');
      expect(section).toContain('保持角色一致性');
    });

    it('单人对话应包含隐私边界提示', () => {
      const coreLayer = createMockCoreLayer();
      const dynamicData = createMockDynamicData();

      const section = assembler.buildGuidanceSection(coreLayer, dynamicData, false);

      expect(section).toContain('隐私边界');
    });

    it('群组对话应包含照顾每个人的提示', () => {
      const coreLayer = createMockCoreLayer();
      const dynamicData = createMockDynamicData();

      const section = assembler.buildGuidanceSection(coreLayer, dynamicData, true);

      expect(section).toContain('照顾每个人的感受');
    });
  });

  describe('findRelationLayer() 方法', () => {
    it('应正确查找关系层', () => {
      const relationLayers = {
        'relation-1': { id: 'relation-1', data: 'test' }
      };

      const layer = assembler.findRelationLayer(relationLayers, 'relation-1');

      expect(layer).toBeDefined();
      expect(layer.id).toBe('relation-1');
    });

    it('找不到时应返回 null', () => {
      const relationLayers = {};

      const layer = assembler.findRelationLayer(relationLayers, 'non-existent');

      expect(layer).toBeNull();
    });

    it('relationLayers 为 null 时应返回 null', () => {
      const layer = assembler.findRelationLayer(null, 'any-id');

      expect(layer).toBeNull();
    });
  });

  describe('findCommonTopics() 方法', () => {
    it('应找到共同话题', () => {
      const participants = [
        {
          relationshipWithOwner: { hasRelationLayer: true, relationLayerId: 'r1' }
        },
        {
          relationshipWithOwner: { hasRelationLayer: true, relationLayerId: 'r2' }
        }
      ];
      const relationLayers = {
        'r1': { conversationGuidance: { topicTendencies: { preferred: ['家庭', '健康'] } } },
        'r2': { conversationGuidance: { topicTendencies: { preferred: ['家庭', '旅游'] } } }
      };

      const topics = assembler.findCommonTopics(participants, relationLayers);

      expect(topics).toContain('家庭');
    });

    it('无共同话题时应返回默认话题', () => {
      const participants = [
        { relationshipWithOwner: { hasRelationLayer: true, relationLayerId: 'r1' } },
        { relationshipWithOwner: { hasRelationLayer: true, relationLayerId: 'r2' } }
      ];
      const relationLayers = {
        'r1': { conversationGuidance: { topicTendencies: { preferred: ['健康'] } } },
        'r2': { conversationGuidance: { topicTendencies: { preferred: ['旅游'] } } }
      };

      const topics = assembler.findCommonTopics(participants, relationLayers);

      expect(topics).toContain('日常话题');
    });

    it('无参与者有关系层时应返回默认话题', () => {
      const participants = [
        { relationshipWithOwner: { hasRelationLayer: false } }
      ];

      const topics = assembler.findCommonTopics(participants, {});

      expect(topics).toContain('日常话题');
    });
  });

  describe('humorLevelText() 方法', () => {
    it('应正确转换幽默等级', () => {
      expect(assembler.humorLevelText('none')).toBe('很少开玩笑');
      expect(assembler.humorLevelText('light')).toBe('偶尔幽默调侃');
      expect(assembler.humorLevelText('moderate')).toBe('经常开玩笑');
      expect(assembler.humorLevelText('heavy')).toBe('幽默感很强');
    });

    it('未知等级应返回默认值', () => {
      expect(assembler.humorLevelText('unknown')).toBe('偶尔幽默调侃');
      expect(assembler.humorLevelText(null)).toBe('偶尔幽默调侃');
    });
  });

  describe('verbosityText() 方法', () => {
    it('应正确转换详略等级', () => {
      expect(assembler.verbosityText('concise')).toBe('说话简洁，点到为止');
      expect(assembler.verbosityText('moderate')).toBe('说话详略得当');
      expect(assembler.verbosityText('elaborate')).toBe('说话详细，喜欢展开');
    });

    it('未知等级应返回默认值', () => {
      expect(assembler.verbosityText('unknown')).toBe('说话详略得当');
    });
  });

  describe('countActiveRules() 方法', () => {
    it('应正确计算启用的规则数量', () => {
      const guardrails = {
        rules: [
          { id: '1', enabled: true },
          { id: '2', enabled: true },
          { id: '3', enabled: false }
        ]
      };

      const count = assembler.countActiveRules(guardrails);

      expect(count).toBe(2);
    });

    it('guardrails 为 null 时应返回 0', () => {
      const count = assembler.countActiveRules(null);

      expect(count).toBe(0);
    });

    it('rules 为空数组时应返回 0', () => {
      const count = assembler.countActiveRules({ rules: [] });

      expect(count).toBe(0);
    });
  });

  describe('完整 Prompt 生成测试', () => {
    it('应生成包含所有必要部分的 System Prompt', () => {
      const coreLayer = createMockCoreLayer();
      const relationLayer = createMockRelationLayer();
      const dynamicData = createMockDynamicData([{
        nickname: '女儿',
        name: '邓榕',
        relationshipWithOwner: {
          specificRelation: '女儿',
          intimacyLevel: 'intimate',
          hasRelationLayer: true,
          relationLayerId: 'relation-1'
        },
        assistantPersonality: {
          description: '孝顺懂事，关心父亲',
          source: 'relation_layer',
          communicationTraits: ['温和', '细心']
        }
      }]);

      const result = assembler.assemble({
        coreLayer,
        relationLayers: { 'relation-1': relationLayer },
        guardrails: { rules: [] },
        dynamicData
      });

      // 验证 Prompt 包含关键部分
      expect(result.systemPrompt).toContain('你的身份');
      expect(result.systemPrompt).toContain('核心性格');
      expect(result.systemPrompt).toContain('对话情境');
      expect(result.systemPrompt).toContain('行为准则');
      expect(result.systemPrompt).toContain('测试用户');
      expect(result.systemPrompt).toContain('女儿');
    });

    it('群组对话应包含安全约束', () => {
      const coreLayer = createMockCoreLayer();
      const dynamicData = createMockDynamicData([
        { nickname: '儿子', relationshipWithOwner: { specificRelation: '儿子' } },
        { nickname: '朋友', relationshipWithOwner: { specificRelation: '朋友' } }
      ]);

      const result = assembler.assemble({
        coreLayer,
        relationLayers: {},
        guardrails: { rules: [{ id: 'test', type: 'hard', enabled: true, topic: { keywords: ['秘密'], description: '秘密话题' }, allowedAudience: {}, action: { type: 'block' }, priority: 100 }] },
        dynamicData
      });

      expect(result.systemPrompt).toContain('安全约束');
    });
  });

  describe('边界情况测试', () => {
    it('应处理空的 coreLayer', () => {
      const result = assembler.assemble({
        coreLayer: {
          personalityTraits: {},
          communicationStyle: {},
          selfPerception: {}
        },
        relationLayers: {},
        guardrails: { rules: [] },
        dynamicData: {
          roleCardOwner: { nickname: '测试' },
          participants: []
        }
      });

      expect(result.systemPrompt).toBeDefined();
    });

    it('应处理空参与者数组', () => {
      const coreLayer = createMockCoreLayer();
      const dynamicData = {
        roleCardOwner: { nickname: '测试' },
        participants: []
      };

      const result = assembler.assemble({
        coreLayer,
        relationLayers: {},
        guardrails: { rules: [] },
        dynamicData
      });

      expect(result.metadata.participantCount).toBe(0);
    });

    it('应处理无 nickname 的 roleCardOwner', () => {
      const coreLayer = createMockCoreLayer();
      const dynamicData = {
        roleCardOwner: { name: '张三' },
        participants: []
      };

      const result = assembler.assemble({
        coreLayer,
        relationLayers: {},
        guardrails: { rules: [] },
        dynamicData
      });

      expect(result.systemPrompt).toContain('张三');
    });
  });
});
