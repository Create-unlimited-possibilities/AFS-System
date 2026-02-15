// server/src/modules/rolecard/v2/promptAssembler.js

import SafetyGuardrailsManager from './safetyGuardrails.js';
import logger from '../../../core/utils/logger.js';

const TraitLanguageConverter = {
  boundaryThicknessDescription(value) {
    const descriptions = {
      thick: '对私人信息非常谨慎，很少主动透露个人信息',
      medium: '对私人信息有一定保护意识，会根据对象和情境决定是否透露',
      thin: '比较开放，乐于分享个人经历和想法'
    };
    return descriptions[value] || descriptions.medium;
  },
  discretionLevelDescription(value) {
    const descriptions = {
      excellent: '口风很紧，从不会泄露别人的秘密',
      good: '大部分时候能守住秘密',
      moderate: '有时会不小心说出不该说的事',
      poor: '经常无意中泄露信息'
    };
    return descriptions[value] || descriptions.good;
  },
  impulsiveSpeechDescription(value) {
    const descriptions = {
      rare: '说话前会三思，很少说出让自己后悔的话',
      occasional: '偶尔会脱口而出，事后可能会后悔',
      often: '经常想到什么说什么',
      frequent: '口无遮拦，说话不过脑子'
    };
    return descriptions[value] || descriptions.occasional;
  },
  emotionalExpressionDescription(value) {
    const descriptions = {
      reserved: '情感内敛，不轻易表露内心感受',
      moderate: '会适度表达情感，能够根据场合控制',
      expressive: '情感外露，喜怒哀乐都会表现出来'
    };
    return descriptions[value] || descriptions.moderate;
  },
  socialCautiousnessDescription(value) {
    const descriptions = {
      high: '社交时非常谨慎，注意言辞',
      moderate: '有一定社交分寸',
      low: '社交时比较随意'
    };
    return descriptions[value] || descriptions.moderate;
  },
  intimacyDescription(level) {
    const descriptions = {
      intimate: '非常亲密，无话不谈',
      close: '关系亲近，大部分事可以分享',
      moderate: '关系一般，有选择地分享',
      distant: '关系疏远，较少深入交流'
    };
    return descriptions[level] || descriptions.moderate;
  }
};

class PromptAssembler {
  constructor() {
    this.safetyManager = SafetyGuardrailsManager;
  }

  assemble(params) {
    const { coreLayer, relationLayers, guardrails, dynamicData, options = {} } = params;
    const isGroupConversation = dynamicData.participants.length > 1;

    const identitySection = this.buildIdentitySection(coreLayer, dynamicData);
    const relationSection = this.buildRelationSection(relationLayers, dynamicData, isGroupConversation);
    const guidanceSection = this.buildGuidanceSection(coreLayer, dynamicData, isGroupConversation);
    const safetySection = isGroupConversation ? this.buildSafetySection(guardrails, dynamicData) : '';

    const sections = [identitySection, relationSection, guidanceSection, safetySection].filter(s => s.length > 0);
    const systemPrompt = sections.join('\n\n');

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

  buildIdentitySection(coreLayer, dynamicData) {
    const { roleCardOwner } = dynamicData;
    const { personalityTraits, communicationStyle, selfPerception } = coreLayer;
    const displayName = roleCardOwner.nickname || roleCardOwner.name;

    let section = `## 你的身份\n\n你是${displayName}，一个真实存在的人，拥有独特的性格和生活经历。`;
    if (roleCardOwner.demographicInfo?.age) section += `\n你今年${roleCardOwner.demographicInfo.age}岁。`;

    section += `\n\n### 核心性格\n【边界意识】${TraitLanguageConverter.boundaryThicknessDescription(personalityTraits.boundaryThickness)}\n【守密程度】${TraitLanguageConverter.discretionLevelDescription(personalityTraits.discretionLevel)}\n【说话习惯】${TraitLanguageConverter.impulsiveSpeechDescription(personalityTraits.impulsiveSpeech)}\n【情感风格】${TraitLanguageConverter.emotionalExpressionDescription(personalityTraits.emotionalExpression)}\n【社交态度】${TraitLanguageConverter.socialCautiousnessDescription(personalityTraits.socialCautiousness)}\n\n### 自我认知\n你认为自己是一个${selfPerception.selfDescriptionKeywords?.join('、') || '普通人'}的人。\n你的人生价值观：${selfPerception.coreValues?.join('、') || '简单生活'}。\n你的人生优先级：${selfPerception.lifePriorities?.join('、') || '家人健康'}。\n\n### 沟通风格\n- 说话语气：${communicationStyle.tonePattern || '自然随意'}\n- 话题偏好：${communicationStyle.preferredTopics?.join('、') || '日常话题'}\n- 话题回避：${communicationStyle.avoidedTopics?.join('、') || '无明显回避'}\n- 幽默程度：${this.humorLevelText(communicationStyle.humorStyle)}\n- 说话习惯：${this.verbosityText(communicationStyle.verbosity)}`;

    if (coreLayer.behavioralIndicators?.length > 0) {
      const indicators = coreLayer.behavioralIndicators.filter(b => b.confidence !== 'low').slice(0, 5);
      if (indicators.length > 0) {
        section += `\n\n### 典型行为模式\n${indicators.map(b => `- 当${b.trigger}时，你通常会${b.response}`).join('\n')}`;
      }
    }
    return section;
  }

  buildRelationSection(relationLayers, dynamicData, isGroupConversation) {
    const { participants } = dynamicData;
    if (participants.length === 0) return '';
    if (!isGroupConversation && participants.length === 1) {
      return this.buildSingleRelationSection(participants[0], relationLayers);
    }
    return this.buildGroupRelationSection(participants, relationLayers);
  }

  buildSingleRelationSection(participant, relationLayers) {
    const participantName = participant.nickname || participant.name;
    const { relationshipWithOwner, assistantPersonality } = participant;

    let section = `## 对话情境\n\n### 对话对象\n你正在与${participantName}（你的${relationshipWithOwner.specificRelation}）进行对话。\n你们的关系：${TraitLanguageConverter.intimacyDescription(relationshipWithOwner.intimacyLevel)}。`;

    if (relationshipWithOwner.hasRelationLayer) {
      const relationLayer = this.findRelationLayer(relationLayers, relationshipWithOwner.relationLayerId);
      if (relationLayer) {
        const { perceivedByAssistant, conversationGuidance, sharedMemories } = relationLayer;
        section += `\n\n### 你在对方眼中的形象\n${perceivedByAssistant?.personalityDescription || ''}\n对方认为你的优点：${perceivedByAssistant?.strengths?.join('、') || '了解不深'}。\n${perceivedByAssistant?.weaknesses?.length > 0 ? `对方认为你的不足：${perceivedByAssistant.weaknesses.join('、')}。\n` : ''}\n### 对话指导\n- 你应该的态度：${conversationGuidance?.suggestedAttitude || '自然真诚'}\n- 你应该的语气：${conversationGuidance?.suggestedTone || '友好'}\n- 你应该展现的性格侧面：${conversationGuidance?.personalityToDisplay || '真实的自己'}\n- 倾向聊的话题：${conversationGuidance?.topicTendencies?.preferred?.join('、') || '日常话题'}\n- 应该避免的话题：${conversationGuidance?.topicTendencies?.avoid?.join('、') || '无'}`;
        if (sharedMemories?.length > 0) {
          const topMemories = sharedMemories.sort((a, b) => b.importance - a.importance).slice(0, 3);
          section += `\n\n### 你们之间的共同记忆\n${topMemories.map(m => `- ${m.content}`).join('\n')}`;
        }
      }
    }

    section += `\n\n### 对方是什么样的人\n${this.buildAssistantPersonalityDescription(participantName, assistantPersonality)}`;
    return section;
  }

  buildGroupRelationSection(participants, relationLayers) {
    const allSecrets = [];
    for (const p of participants) {
      if (p.relationshipWithOwner.hasRelationLayer) {
        const layer = this.findRelationLayer(relationLayers, p.relationshipWithOwner.relationLayerId);
        if (layer?.perceivedByAssistant?.sharedSecrets) allSecrets.push(...layer.perceivedByAssistant.sharedSecrets);
      }
    }

    const commonTopics = this.findCommonTopics(participants, relationLayers);
    let section = `## 群组对话情境\n\n### 对话参与者\n你正在与以下人员进行群组对话：\n${participants.map(p => `- ${p.nickname || p.name}（你的${p.relationshipWithOwner.specificRelation}）`).join('\n')}\n\n### 群组互动准则\n- 你的整体态度：友善、包容，照顾到每个人的感受\n- 共同话题：${commonTopics.join('、') || '日常话题'}\n\n### 对每个参与者\n${participants.map(p => `**${p.nickname || p.name}（${p.relationshipWithOwner.specificRelation}）：**\n- 关系：${TraitLanguageConverter.intimacyDescription(p.relationshipWithOwner.intimacyLevel)}\n- 对方性格：${p.assistantPersonality?.description || '了解不深'}`).join('\n')}`;

    if (allSecrets.length > 0) {
      section += `\n\n### ⚠️ 群组敏感信息（绝对不可提及）\n以下内容仅特定人知道，在群组中绝对不能提起：\n${allSecrets.map(s => `- ${s}`).join('\n')}`;
    }
    return section;
  }

  buildGuidanceSection(coreLayer, dynamicData, isGroupConversation) {
    let section = `## 行为准则\n\n### 基本原则\n1. 保持角色一致性，始终以设定的人格特征行事\n2. 回复要自然流畅，像真实的人类对话\n3. 根据对话对象和情境调整语气和内容深度\n4. 不要突然改变话题，保持对话的连贯性`;
    section += isGroupConversation ? `\n5. 在群组中注意照顾每个人的感受，不要让任何人感到被排除` : `\n5. 如果话题触及你的隐私边界，根据你的人格特征决定如何回应`;
    section += `\n\n### 回复风格\n- 长度：根据话题适当调整，日常聊天简短自然\n- 语言：使用自然口语，避免书面化的表达\n- 情感：根据你的情感表达风格，适度展现情绪`;
    return section;
  }

  buildSafetySection(guardrails, dynamicData) {
    return this.safetyManager.generateGroupSafetyPrompt(guardrails, dynamicData.participants);
  }

  findRelationLayer(relationLayers, relationLayerId) {
    if (!relationLayers) return null;
    return relationLayers[relationLayerId] || null;
  }

  findCommonTopics(participants, relationLayers) {
    const topicSets = participants.filter(p => p.relationshipWithOwner.hasRelationLayer).map(p => {
      const layer = this.findRelationLayer(relationLayers, p.relationshipWithOwner.relationLayerId);
      return new Set(layer?.conversationGuidance?.topicTendencies?.preferred || []);
    });
    if (topicSets.length === 0) return ['日常话题'];
    const intersection = topicSets.reduce((acc, set) => new Set([...acc].filter(x => set.has(x))));
    return [...intersection].length > 0 ? [...intersection] : ['日常话题'];
  }

  buildAssistantPersonalityDescription(name, personality) {
    if (!personality) return `你对${name}的性格了解不深。`;
    switch (personality.source) {
      case 'relation_layer':
        let desc = personality.description;
        if (personality.communicationTraits?.length > 0) desc += `\n沟通特点：${personality.communicationTraits.join('、')}`;
        return desc;
      case 'participant_rolecard': return `（根据${name}的自我描述）${personality.description}`;
      default: return `你对${name}的性格了解不深，需要在对话中逐渐了解。`;
    }
  }

  humorLevelText(level) {
    const texts = { none: '很少开玩笑', light: '偶尔幽默调侃', moderate: '经常开玩笑', heavy: '幽默感很强' };
    return texts[level] || texts.light;
  }

  verbosityText(level) {
    const texts = { concise: '说话简洁，点到为止', moderate: '说话详略得当', elaborate: '说话详细，喜欢展开' };
    return texts[level] || texts.moderate;
  }

  countActiveRules(guardrails) {
    return guardrails?.rules?.filter(r => r.enabled)?.length || 0;
  }
}

export default PromptAssembler;
