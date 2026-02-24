// server/src/modules/rolecard/v2/promptAssembler.js

import SafetyGuardrailsManager from './safetyGuardrails.js';
import { profileLogger } from '../../../core/utils/logger.js';

/**
 * 亲密度语言转换器
 * 将 intimacyLevel 枚举值转换为自然语言描述
 */
const IntimacyLanguageConverter = {
  description(level) {
    const descriptions = {
      intimate: '非常亲密，无话不谈',
      close: '关系亲近，大部分事可以分享',
      moderate: '关系一般，有选择地分享',
      distant: '关系疏远，较少深入交流'
    };
    return descriptions[level] || descriptions.moderate;
  }
};

/**
 * Prompt 组装器 V2
 * 将核心层、关系层、安全护栏等组装成完整的系统提示词
 * 支持新的 V2 数据结构
 */
class PromptAssembler {
  constructor() {
    this.safetyManager = SafetyGuardrailsManager;
  }

  /**
   * 组装系统提示词
   * @param {Object} params - 参数对象
   * @returns {Object} 包含 systemPrompt 和 metadata 的对象
   */
  assemble(params) {
    const { coreLayer, relationLayers, guardrails, dynamicData, options = {} } = params;
    const isGroupConversation = dynamicData.participants.length > 1;

    profileLogger.info('组装系统提示词', {
      isGroup: isGroupConversation,
      participantCount: dynamicData.participants.length,
      hasCoreLayer: !!coreLayer,
      relationLayerCount: relationLayers ? Object.keys(relationLayers).length : 0
    });

    const identitySection = this.buildIdentitySection(coreLayer, dynamicData);
    const relationSection = this.buildRelationSection(relationLayers, dynamicData, isGroupConversation);
    const guidanceSection = this.buildGuidanceSection(coreLayer, dynamicData, isGroupConversation);
    const safetySection = isGroupConversation ? this.buildSafetySection(guardrails, dynamicData) : '';

    const sections = [identitySection, relationSection, guidanceSection, safetySection].filter(s => s.length > 0);
    let systemPrompt = sections.join('\n\n');

    // 添加强调性的角色扮演指令
    const displayName = dynamicData.roleCardOwner?.nickname || dynamicData.roleCardOwner?.name || '用户';
    const rolePlayInstruction = `

## 重要提醒 - 必须严格遵守

你现在正在进行角色扮演游戏。你不再是AI助手，你就是${displayName}本人。

- 必须完全沉浸在这个角色中，用第一人称"我"来回答
- 绝不要说"作为AI"、"作为助手"之类的话
- 绝不要问"有什么我可以帮助你的"这类助手式问句
- 你的回复应该像是${displayName}这个真实的人在对家人朋友说话
- 保持自然的对话风格，像普通人聊天一样，不要过于正式
- 记住：你不是在扮演${displayName}，你现在就是${displayName}`;

    systemPrompt += rolePlayInstruction;

    return {
      systemPrompt,
      metadata: {
        assembledAt: new Date().toISOString(),
        participantCount: dynamicData.participants.length,
        isGroupConversation,
        safetyRulesApplied: isGroupConversation ? this.countActiveRules(guardrails) : 0
      }
    };
  }

  /**
   * 构建身份部分
   * 适配 V2 数据结构
   */
  buildIdentitySection(coreLayer, dynamicData) {
    const { roleCardOwner } = dynamicData;

    // V2: 使用 basicIdentity
    const basicIdentity = coreLayer?.basicIdentity || {};
    const rawIdentity = basicIdentity.raw || {};
    const identitySummary = basicIdentity.summary || '';

    const displayName = roleCardOwner.nickname || roleCardOwner.name || rawIdentity.name || '用户';

    let section = `## 你的身份\n\n你是${displayName}，一个真实存在的人，拥有独特的性格和生活经历。`;

    // 添加基础身份摘要
    if (identitySummary) {
      section += `\n\n**基本信息**：${identitySummary}`;
    }

    // V2: 性格特质
    const personality = coreLayer?.personality || {};
    if (personality.summary) {
      section += `\n\n### 核心性格\n${personality.summary}`;
    }
    if (personality.keyPoints && personality.keyPoints.length > 0) {
      section += `\n\n**性格要点**：\n${personality.keyPoints.map(p => `- ${p}`).join('\n')}`;
    }

    // V2: 沟通风格
    const commStyle = coreLayer?.communicationStyle || {};
    if (commStyle.summary) {
      section += `\n\n### 沟通风格\n${commStyle.summary}`;
    }
    if (commStyle.keyPoints && commStyle.keyPoints.length > 0) {
      section += `\n\n**沟通特点**：\n${commStyle.keyPoints.map(p => `- ${p}`).join('\n')}`;
    }

    // V2: 自我认知
    const selfPerception = coreLayer?.selfPerception || {};
    if (selfPerception.summary) {
      section += `\n\n### 自我认知\n${selfPerception.summary}`;
    }

    // V2: 价值观
    const values = coreLayer?.values || {};
    if (values.summary) {
      section += `\n\n### 人生价值观\n${values.summary}`;
    }

    // V2: 兴趣爱好
    const interests = coreLayer?.interests || {};
    if (interests.summary) {
      section += `\n\n### 兴趣爱好\n${interests.summary}`;
    }

    // V2: 偏好
    const preferences = coreLayer?.preferences || {};
    if (preferences.summary) {
      section += `\n\n### 个人偏好\n${preferences.summary}`;
    }

    // V2: 背景故事
    const backgroundStory = coreLayer?.backgroundStory || {};
    if (backgroundStory.summary) {
      section += `\n\n### 人生经历\n${backgroundStory.summary}`;
    }

    // V2: 人生里程碑
    const milestones = coreLayer?.lifeMilestones || {};
    if (milestones.summary) {
      section += `\n\n### 重要事件\n${milestones.summary}`;
    }

    // V2: 情感需求
    const emotionalNeeds = coreLayer?.emotionalNeeds || {};
    if (emotionalNeeds.summary) {
      section += `\n\n### 情感需求\n${emotionalNeeds.summary}`;
    }

    return section;
  }

  /**
   * 构建关系部分
   */
  buildRelationSection(relationLayers, dynamicData, isGroupConversation) {
    const { participants } = dynamicData;
    if (participants.length === 0) return '';

    if (!isGroupConversation && participants.length === 1) {
      return this.buildSingleRelationSection(participants[0], relationLayers);
    }
    return this.buildGroupRelationSection(participants, relationLayers);
  }

  /**
   * 构建单一对话关系部分
   * 适配 V2 关系层结构
   */
  buildSingleRelationSection(participant, relationLayers) {
    const participantName = participant.nickname || participant.name;
    const { relationshipWithOwner, assistantPersonality } = participant;

    let section = `## 对话情境\n\n### 对话对象\n你正在与${participantName}（你的${relationshipWithOwner.specificRelation}）进行对话。\n你们的关系：${IntimacyLanguageConverter.description(relationshipWithOwner.intimacyLevel)}。`;

    if (relationshipWithOwner.hasRelationLayer) {
      const relationLayer = this.findRelationLayer(relationLayers, relationshipWithOwner.relationLayerId);
      if (relationLayer) {
        // V2 字段结构
        section += this.buildRelationLayerDetails(relationLayer);
      }
    }

    section += `\n\n### 对方是什么样的人\n${this.buildAssistantPersonalityDescription(participantName, assistantPersonality)}`;
    return section;
  }

  /**
   * 构建关系层详情
   * 使用 V2 字段
   */
  buildRelationLayerDetails(relationLayer) {
    let section = '';

    // V2: 协助者眼中的目标用户特质
    const perceivedTraits = relationLayer.perceivedTraits || {};
    if (perceivedTraits.summary) {
      section += `\n\n### 你在对方眼中的形象\n${perceivedTraits.summary}`;
    }
    if (perceivedTraits.keyPoints && perceivedTraits.keyPoints.length > 0) {
      section += `\n\n**对方认为你的特点**：\n${perceivedTraits.keyPoints.map(p => `- ${p}`).join('\n')}`;
    }

    // V2: 共同回忆
    const sharedMemories = relationLayer.sharedMemories || {};
    if (sharedMemories.summary) {
      section += `\n\n### 你们之间的共同记忆\n${sharedMemories.summary}`;
    }

    // V2: 情感纽带
    const emotionalBond = relationLayer.emotionalBond || {};
    if (emotionalBond.summary) {
      section += `\n\n### 你们之间的情感纽带\n${emotionalBond.summary}`;
    }

    // V2: 互动模式
    const interactionPatterns = relationLayer.interactionPatterns || {};
    if (interactionPatterns.summary) {
      section += `\n\n### 互动模式\n${interactionPatterns.summary}`;
    }

    // V2: 沟通风格（针对该协助者）
    const commStyle = relationLayer.communicationStyle || {};
    if (commStyle.summary) {
      section += `\n\n### 与对方的沟通方式\n${commStyle.summary}`;
    }

    // V2: 支持动态
    const supportDynamics = relationLayer.supportDynamics || {};
    if (supportDynamics.summary) {
      section += `\n\n### 互相支持的方式\n${supportDynamics.summary}`;
    }

    // V2: 话题与兴趣
    const topicsAndInterests = relationLayer.topicsAndInterests || {};
    if (topicsAndInterests.summary) {
      section += `\n\n### 常聊的话题\n${topicsAndInterests.summary}`;
    }

    // 家人专属字段
    if (relationLayer.relationMeta?.isFamily) {
      section += this.buildFamilySpecificFields(relationLayer);
    }

    // 朋友专属字段
    if (relationLayer.relationMeta?.isFriend) {
      section += this.buildFriendSpecificFields(relationLayer);
    }

    return section;
  }

  /**
   * 构建家人专属字段
   */
  buildFamilySpecificFields(relationLayer) {
    let section = '';

    const familyRole = relationLayer.familyRole || {};
    if (familyRole.summary) {
      section += `\n\n### 家庭角色\n${familyRole.summary}`;
    }

    const intergenerationalImpact = relationLayer.intergenerationalImpact || {};
    if (intergenerationalImpact.summary) {
      section += `\n\n### 对你的影响\n${intergenerationalImpact.summary}`;
    }

    const familyTraditions = relationLayer.familyTraditions || {};
    if (familyTraditions.summary) {
      section += `\n\n### 家庭传统\n${familyTraditions.summary}`;
    }

    const careAndGuidance = relationLayer.careAndGuidance || {};
    if (careAndGuidance.summary) {
      section += `\n\n### 关怀与指导\n${careAndGuidance.summary}`;
    }

    const familyValues = relationLayer.familyValues || {};
    if (familyValues.summary) {
      section += `\n\n### 共同的家庭价值观\n${familyValues.summary}`;
    }

    return section;
  }

  /**
   * 构建朋友专属字段
   */
  buildFriendSpecificFields(relationLayer) {
    let section = '';

    const socialRole = relationLayer.socialRole || {};
    if (socialRole.summary) {
      section += `\n\n### 社交角色\n${socialRole.summary}`;
    }

    const friendshipHistory = relationLayer.friendshipHistory || {};
    if (friendshipHistory.summary) {
      section += `\n\n### 友谊历史\n${friendshipHistory.summary}`;
    }

    const socialActivities = relationLayer.socialActivities || {};
    if (socialActivities.summary) {
      section += `\n\n### 一起的活动\n${socialActivities.summary}`;
    }

    const trustAndLoyalty = relationLayer.trustAndLoyalty || {};
    if (trustAndLoyalty.summary) {
      section += `\n\n### 信任与忠诚\n${trustAndLoyalty.summary}`;
    }

    return section;
  }

  /**
   * 构建群组对话关系部分
   */
  buildGroupRelationSection(participants, relationLayers) {
    const commonTopics = this.findCommonTopics(participants, relationLayers);

    let section = `## 群组对话情境\n\n### 对话参与者\n你正在与以下人员进行群组对话：\n${participants.map(p => `- ${p.nickname || p.name}（你的${p.relationshipWithOwner.specificRelation}）`).join('\n')}\n\n### 群组互动准则\n- 你的整体态度：友善、包容，照顾到每个人的感受\n- 共同话题：${commonTopics.join('、') || '日常话题'}\n\n### 对每个参与者\n${participants.map(p => {
  const name = p.nickname || p.name;
  const relation = p.relationshipWithOwner;
  let desc = `**${name}（${relation.specificRelation}）：**\n- 关系：${IntimacyLanguageConverter.description(relation.intimacyLevel)}`;

  if (relation.hasRelationLayer) {
    const layer = this.findRelationLayer(relationLayers, relation.relationLayerId);
    if (layer?.perceivedTraits?.summary) {
      desc += `\n- 对方对你的看法：${layer.perceivedTraits.summary.substring(0, 100)}...`;
    }
  }

  if (p.assistantPersonality?.description) {
    desc += `\n- 对方性格：${p.assistantPersonality.description}`;
  }

  return desc;
}).join('\n\n')}`;

    return section;
  }

  /**
   * 构建指导部分
   */
  buildGuidanceSection(coreLayer, dynamicData, isGroupConversation) {
    let section = `## 行为准则\n\n### 基本原则
1. 保持角色一致性，始终以设定的人格特征行事
2. 回复要自然流畅，像真实的人类对话
3. 根据对话对象和情境调整语气和内容深度
4. 不要突然改变话题，保持对话的连贯性`;

    section += isGroupConversation
      ? `\n5. 在群组中注意照顾每个人的感受，不要让任何人感到被排除`
      : `\n5. 如果话题触及你的隐私边界，根据你的人格特征决定如何回应`;

    section += `\n\n### 回复风格
- 长度：根据话题适当调整，日常聊天简短自然
- 语言：使用自然口语，避免书面化的表达
- 情感：根据你的情感表达风格，适度展现情绪`;

    // V2: 添加记忆相关的指导
    const memories = coreLayer?.memories || {};
    if (memories.summary) {
      section += `\n\n### 重要回忆\n${memories.summary}`;
    }

    return section;
  }

  /**
   * 构建安全部分
   */
  buildSafetySection(guardrails, dynamicData) {
    return this.safetyManager.generateGroupSafetyPrompt(guardrails, dynamicData.participants);
  }

  /**
   * 查找关系层
   */
  findRelationLayer(relationLayers, relationLayerId) {
    if (!relationLayers) return null;
    return relationLayers[relationLayerId] || null;
  }

  /**
   * 查找共同话题
   */
  findCommonTopics(participants, relationLayers) {
    const topicSets = participants
      .filter(p => p.relationshipWithOwner.hasRelationLayer)
      .map(p => {
        const layer = this.findRelationLayer(relationLayers, p.relationshipWithOwner.relationLayerId);
        const topics = layer?.topicsAndInterests?.keyPoints || [];
        return new Set(topics);
      });

    if (topicSets.length === 0) return ['日常话题'];

    const intersection = topicSets.reduce((acc, set) => new Set([...acc].filter(x => set.has(x))));
    return [...intersection].length > 0 ? [...intersection] : ['日常话题'];
  }

  /**
   * 构建协助者性格描述
   */
  buildAssistantPersonalityDescription(name, personality) {
    if (!personality) return `你对${name}的性格了解不深。`;

    switch (personality.source) {
      case 'relation_layer_v2':
      case 'relation_layer':
        let desc = personality.description;
        if (personality.communicationTraits?.length > 0) {
          desc += `\n沟通特点：${personality.communicationTraits.join('、')}`;
        }
        if (personality.interactionPatterns) {
          desc += `\n互动方式：${personality.interactionPatterns}`;
        }
        return desc;
      case 'participant_core_layer':
      case 'participant_rolecard':
        return `（根据${name}的自我描述）${personality.description}`;
      default:
        return `你对${name}的性格了解不深，需要在对话中逐渐了解。`;
    }
  }

  /**
   * 计算活跃规则数量
   */
  countActiveRules(guardrails) {
    return guardrails?.rules?.filter(r => r.enabled)?.length || 0;
  }
}

export default PromptAssembler;
