# 角色卡系统 V2 重构 - 第5部分：动态组装器和LangGraph集成

> **前置条件:** 完成第4部分

---

## Task 5.1: 创建动态数据获取服务

**Files:**
- Create: `server/src/modules/rolecard/v2/dynamicDataFetcher.js`

```javascript
// server/src/modules/rolecard/v2/dynamicDataFetcher.js

import User from '../../user/model.js';
import AssistRelation from '../../assist-relation/model.js';
import DualStorage from '../../../core/storage/dual.js';
import logger from '../../../core/utils/logger.js';

/**
 * 动态数据获取服务
 * 负责在对话时获取用户信息、关系信息等动态数据
 */
class DynamicDataFetcher {
  constructor() {
    this.dualStorage = new DualStorage();
  }

  /**
   * 获取完整的动态用户数据
   * @param {string} roleCardOwnerId - 角色卡所属用户ID
   * @param {string[]} participantUserIds - 对话参与者用户ID列表
   * @param {Object} roleCardCollection - 用户A的完整角色卡（包含所有关系层）
   */
  async fetchDynamicData(roleCardOwnerId, participantUserIds, roleCardCollection) {
    logger.info(`[DynamicDataFetcher] 获取动态数据 - Owner: ${roleCardOwnerId}, Participants: ${participantUserIds.length}`);

    // 1. 获取角色卡所属用户信息
    const owner = await User.findById(roleCardOwnerId);
    if (!owner) {
      throw new Error(`用户不存在: ${roleCardOwnerId}`);
    }

    // 2. 解析每个参与者
    const participants = await Promise.all(
      participantUserIds.map(id => this.resolveParticipant(id, roleCardCollection, owner))
    );

    return {
      roleCardOwner: {
        userId: owner._id.toString(),
        name: owner.name,
        nickname: owner.nickname,
        avatar: owner.avatar,
        demographicInfo: {
          age: owner.age,
          gender: owner.gender,
          location: owner.location
        }
      },
      participants
    };
  }

  /**
   * 解析单个参与者
   */
  async resolveParticipant(participantId, roleCardCollection, owner) {
    const participant = await User.findById(participantId);

    if (!participant) {
      // 返回陌生人信息
      return {
        userId: participantId,
        name: '陌生人',
        nickname: null,
        relationshipWithOwner: {
          hasRelationLayer: false,
          specificRelation: '陌生人',
          relationType: 'other',
          intimacyLevel: 'distant'
        },
        assistantPersonality: {
          source: 'default',
          description: '对这个人的性格了解不深'
        }
      };
    }

    const participantName = participant.nickname || participant.name;

    // 在关系层中查找该参与者
    const relationLayer = this.findRelationLayerByAssistantId(
      roleCardCollection?.relationLayers || {},
      participantId
    );

    let relationshipWithOwner;
    let assistantPersonality;

    if (relationLayer) {
      // ✅ 有关系层
      relationshipWithOwner = {
        hasRelationLayer: true,
        relationLayerId: relationLayer.relationId,
        specificRelation: relationLayer.relation.specific,
        relationType: relationLayer.relation.type,
        intimacyLevel: relationLayer.relation.intimacyLevel,
        duration: relationLayer.relation.duration
      };

      assistantPersonality = {
        source: 'relation_layer',
        description: relationLayer.conversationGuidance?.assistantPersonality || '了解不深',
        communicationTraits: relationLayer.perceivedByAssistant?.communicationPatterns || []
      };

    } else {
      // ⚠️ 没有关系层，尝试从用户关系表获取
      const userRelation = await this.findUserRelation(participantId, owner._id);

      if (userRelation) {
        relationshipWithOwner = {
          hasRelationLayer: false,
          specificRelation: userRelation.specificRelation || '认识的人',
          relationType: userRelation.relationshipType || 'other',
          intimacyLevel: userRelation.intimacyLevel || 'moderate'
        };
      } else {
        relationshipWithOwner = {
          hasRelationLayer: false,
          specificRelation: '陌生人',
          relationType: 'other',
          intimacyLevel: 'distant'
        };
      }

      // 尝试获取参与者的角色卡（辅助信息）
      const participantRoleCard = await this.dualStorage.loadRoleCardV2(participantId);

      if (participantRoleCard?.coreLayer) {
        assistantPersonality = {
          source: 'participant_rolecard',
          description: participantRoleCard.coreLayer.selfPerception?.selfDescriptionKeywords?.join('、') || '了解不深',
          communicationTraits: this.extractTraitsFromCoreLayer(participantRoleCard.coreLayer)
        };
      } else {
        assistantPersonality = {
          source: 'default',
          description: '对这个人的性格了解不深'
        };
      }
    }

    return {
      userId: participantId,
      name: participant.name,
      nickname: participant.nickname,
      relationshipWithOwner,
      assistantPersonality
    };
  }

  /**
   * 在关系层集合中查找特定协助者
   */
  findRelationLayerByAssistantId(relationLayers, assistantId) {
    for (const relationId of Object.keys(relationLayers)) {
      const layer = relationLayers[relationId];
      if (layer.assistant?.id === assistantId) {
        return layer;
      }
    }
    return null;
  }

  /**
   * 查找用户关系
   */
  async findUserRelation(assistantId, targetId) {
    try {
      return await AssistRelation.findOne({
        assistantId,
        targetId,
        isActive: true
      });
    } catch {
      return null;
    }
  }

  /**
   * 从核心层提取沟通特征
   */
  extractTraitsFromCoreLayer(coreLayer) {
    const traits = [];
    const { personalityTraits } = coreLayer;

    if (personalityTraits) {
      if (personalityTraits.impulsiveSpeech !== 'rare') {
        traits.push('说话比较直接');
      }
      if (personalityTraits.emotionalExpression === 'expressive') {
        traits.push('情感外露');
      }
    }

    return traits;
  }
}

export default DynamicDataFetcher;
```

---

## Task 5.2: 创建动态 Prompt 组装器

**Files:**
- Create: `server/src/modules/rolecard/v2/promptAssembler.js`

```javascript
// server/src/modules/rolecard/v2/promptAssembler.js

import SafetyGuardrailsManager from './safetyGuardrails.js';
import logger from '../../../core/utils/logger.js';

/**
 * 特征到自然语言转换器
 */
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

/**
 * 动态 Prompt 组装器
 */
class PromptAssembler {
  constructor() {
    this.safetyManager = SafetyGuardrailsManager;
  }

  /**
   * 组装完整的 System Prompt
   */
  assemble(params) {
    const { coreLayer, relationLayers, guardrails, dynamicData, options = {} } = params;
    const isGroupConversation = dynamicData.participants.length > 1;

    // 组装各部分
    const identitySection = this.buildIdentitySection(coreLayer, dynamicData);
    const relationSection = this.buildRelationSection(relationLayers, dynamicData, isGroupConversation);
    const guidanceSection = this.buildGuidanceSection(coreLayer, dynamicData, isGroupConversation);
    const safetySection = isGroupConversation
      ? this.buildSafetySection(guardrails, dynamicData)
      : '';

    const sections = [identitySection, relationSection, guidanceSection, safetySection]
      .filter(s => s.length > 0);

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

  /**
   * 构建身份定义部分
   */
  buildIdentitySection(coreLayer, dynamicData) {
    const { roleCardOwner } = dynamicData;
    const { personalityTraits, communicationStyle, selfPerception } = coreLayer;
    const displayName = roleCardOwner.nickname || roleCardOwner.name;

    let section = `## 你的身份

你是${displayName}，一个真实存在的人，拥有独特的性格和生活经历。`;

    if (roleCardOwner.demographicInfo?.age) {
      section += `\n你今年${roleCardOwner.demographicInfo.age}岁。`;
    }

    section += `

### 核心性格
【边界意识】${TraitLanguageConverter.boundaryThicknessDescription(personalityTraits.boundaryThickness)}
【守密程度】${TraitLanguageConverter.discretionLevelDescription(personalityTraits.discretionLevel)}
【说话习惯】${TraitLanguageConverter.impulsiveSpeechDescription(personalityTraits.impulsiveSpeech)}
【情感风格】${TraitLanguageConverter.emotionalExpressionDescription(personalityTraits.emotionalExpression)}
【社交态度】${TraitLanguageConverter.socialCautiousnessDescription(personalityTraits.socialCautiousness)}

### 自我认知
你认为自己是一个${selfPerception.selfDescriptionKeywords?.join('、') || '普通人'}的人。
你的人生价值观：${selfPerception.coreValues?.join('、') || '简单生活'}。
你的人生优先级：${selfPerception.lifePriorities?.join('、') || '家人健康'}。

### 沟通风格
- 说话语气：${communicationStyle.tonePattern || '自然随意'}
- 话题偏好：${communicationStyle.preferredTopics?.join('、') || '日常话题'}
- 话题回避：${communicationStyle.avoidedTopics?.join('、') || '无明显回避'}
- 幽默程度：${this.humorLevelText(communicationStyle.humorStyle)}
- 说话习惯：${this.verbosityText(communicationStyle.verbosity)}`;

    // 添加行为指示器
    if (coreLayer.behavioralIndicators?.length > 0) {
      const indicators = coreLayer.behavioralIndicators
        .filter(b => b.confidence !== 'low')
        .slice(0, 5);

      if (indicators.length > 0) {
        section += `

### 典型行为模式
${indicators.map(b => `- 当${b.trigger}时，你通常会${b.response}`).join('\n')}`;
      }
    }

    return section;
  }

  /**
   * 构建关系情境部分
   */
  buildRelationSection(relationLayers, dynamicData, isGroupConversation) {
    const { participants } = dynamicData;

    if (participants.length === 0) return '';

    if (!isGroupConversation && participants.length === 1) {
      return this.buildSingleRelationSection(participants[0], relationLayers);
    } else {
      return this.buildGroupRelationSection(participants, relationLayers);
    }
  }

  /**
   * 构建单人对话关系部分
   */
  buildSingleRelationSection(participant, relationLayers) {
    const participantName = participant.nickname || participant.name;
    const { relationshipWithOwner, assistantPersonality } = participant;

    let section = `## 对话情境

### 对话对象
你正在与${participantName}（你的${relationshipWithOwner.specificRelation}）进行对话。
你们的关系：${TraitLanguageConverter.intimacyDescription(relationshipWithOwner.intimacyLevel)}。`;

    // 如果有关系层，添加详细信息
    if (relationshipWithOwner.hasRelationLayer) {
      const relationLayer = this.findRelationLayer(relationLayers, relationshipWithOwner.relationLayerId);

      if (relationLayer) {
        const { perceivedByAssistant, conversationGuidance, sharedMemories } = relationLayer;

        section += `

### 你在对方眼中的形象
${perceivedByAssistant?.personalityDescription || ''}
对方认为你的优点：${perceivedByAssistant?.strengths?.join('、') || '了解不深'}。
${perceivedByAssistant?.weaknesses?.length > 0
  ? `对方认为你的不足：${perceivedByAssistant.weaknesses.join('、')}。`
  : ''}

### 对话指导
- 你应该的态度：${conversationGuidance?.suggestedAttitude || '自然真诚'}
- 你应该的语气：${conversationGuidance?.suggestedTone || '友好'}
- 你应该展现的性格侧面：${conversationGuidance?.personalityToDisplay || '真实的自己'}
- 倾向聊的话题：${conversationGuidance?.topicTendencies?.preferred?.join('、') || '日常话题'}
- 应该避免的话题：${conversationGuidance?.topicTendencies?.avoid?.join('、') || '无'}`;

        // 添加共同记忆
        if (sharedMemories?.length > 0) {
          const topMemories = sharedMemories
            .sort((a, b) => b.importance - a.importance)
            .slice(0, 3);

          section += `

### 你们之间的共同记忆
${topMemories.map(m => `- ${m.content}`).join('\n')}`;
        }
      }
    }

    // 对方性格信息
    section += `

### 对方是什么样的人
${this.buildAssistantPersonalityDescription(participantName, assistantPersonality)}`;

    return section;
  }

  /**
   * 构建群组对话关系部分
   */
  buildGroupRelationSection(participants, relationLayers) {
    // 收集所有私密信息
    const allSecrets = [];
    for (const p of participants) {
      if (p.relationshipWithOwner.hasRelationLayer) {
        const layer = this.findRelationLayer(relationLayers, p.relationshipWithOwner.relationLayerId);
        if (layer?.perceivedByAssistant?.sharedSecrets) {
          allSecrets.push(...layer.perceivedByAssistant.sharedSecrets);
        }
      }
    }

    // 计算共同话题
    const commonTopics = this.findCommonTopics(participants, relationLayers);

    let section = `## 群组对话情境

### 对话参与者
你正在与以下人员进行群组对话：
${participants.map(p => {
  const name = p.nickname || p.name;
  return `- ${name}（你的${p.relationshipWithOwner.specificRelation}）`;
}).join('\n')}

### 群组互动准则
- 你的整体态度：友善、包容，照顾到每个人的感受
- 共同话题：${commonTopics.join('、') || '日常话题'}

### 对每个参与者
${participants.map(p => {
  const name = p.nickname || p.name;
  return `
**${name}（${p.relationshipWithOwner.specificRelation}）：**
- 关系：${TraitLanguageConverter.intimacyDescription(p.relationshipWithOwner.intimacyLevel)}
- 对方性格：${p.assistantPersonality?.description || '了解不深'}`;
}).join('\n')}`;

    if (allSecrets.length > 0) {
      section += `

### ⚠️ 群组敏感信息（绝对不可提及）
以下内容仅特定人知道，在群组中绝对不能提起：
${allSecrets.map(s => `- ${s}`).join('\n')}`;
    }

    return section;
  }

  /**
   * 构建行为准则部分
   */
  buildGuidanceSection(coreLayer, dynamicData, isGroupConversation) {
    let section = `## 行为准则

### 基本原则
1. 保持角色一致性，始终以设定的人格特征行事
2. 回复要自然流畅，像真实的人类对话
3. 根据对话对象和情境调整语气和内容深度
4. 不要突然改变话题，保持对话的连贯性`;

    if (isGroupConversation) {
      section += `
5. 在群组中注意照顾每个人的感受，不要让任何人感到被排除`;
    } else {
      section += `
5. 如果话题触及你的隐私边界，根据你的人格特征决定如何回应`;
    }

    section += `

### 回复风格
- 长度：根据话题适当调整，日常聊天简短自然
- 语言：使用自然口语，避免书面化的表达
- 情感：根据你的情感表达风格，适度展现情绪`;

    return section;
  }

  /**
   * 构建安全约束部分
   */
  buildSafetySection(guardrails, dynamicData) {
    return this.safetyManager.generateGroupSafetyPrompt(
      guardrails,
      dynamicData.participants
    );
  }

  // 辅助方法
  findRelationLayer(relationLayers, relationLayerId) {
    if (!relationLayers) return null;
    return relationLayers[relationLayerId] || null;
  }

  findCommonTopics(participants, relationLayers) {
    const topicSets = participants
      .filter(p => p.relationshipWithOwner.hasRelationLayer)
      .map(p => {
        const layer = this.findRelationLayer(relationLayers, p.relationshipWithOwner.relationLayerId);
        return new Set(layer?.conversationGuidance?.topicTendencies?.preferred || []);
      });

    if (topicSets.length === 0) return ['日常话题'];

    const intersection = topicSets.reduce((acc, set) => {
      return new Set([...acc].filter(x => set.has(x)));
    });

    return [...intersection].length > 0 ? [...intersection] : ['日常话题'];
  }

  buildAssistantPersonalityDescription(name, personality) {
    if (!personality) return `你对${name}的性格了解不深。`;

    switch (personality.source) {
      case 'relation_layer':
        let desc = personality.description;
        if (personality.communicationTraits?.length > 0) {
          desc += `\n沟通特点：${personality.communicationTraits.join('、')}`;
        }
        return desc;

      case 'participant_rolecard':
        return `（根据${name}的自我描述）${personality.description}`;

      default:
        return `你对${name}的性格了解不深，需要在对话中逐渐了解。`;
    }
  }

  humorLevelText(level) {
    const texts = {
      none: '很少开玩笑',
      light: '偶尔幽默调侃',
      moderate: '经常开玩笑',
      heavy: '幽默感很强'
    };
    return texts[level] || texts.light;
  }

  verbosityText(level) {
    const texts = {
      concise: '说话简洁，点到为止',
      moderate: '说话详略得当',
      elaborate: '说话详细，喜欢展开'
    };
    return texts[level] || texts.moderate;
  }

  countActiveRules(guardrails) {
    return guardrails?.rules?.filter(r => r.enabled)?.length || 0;
  }
}

export default PromptAssembler;
```

---

## Task 5.3: 更新 v2/index.js

```javascript
// server/src/modules/rolecard/v2/index.js

export { default as CoreLayerGenerator } from './coreLayerGenerator.js';
export { default as RelationLayerGenerator } from './relationLayerGenerator.js';
export { default as DynamicDataFetcher } from './dynamicDataFetcher.js';
export { default as PromptAssembler } from './promptAssembler.js';

export { SafetyGuardrailsManager, DEFAULT_GUARDRAIL_RULES, RELATION_TRUST_LEVELS } from './safetyGuardrails.js';
export { CalibrationLayerManager, DEFAULT_CALIBRATION_CONFIG } from './calibrationLayer.js';

export { buildCoreExtractionPrompt } from './prompts/coreExtraction.js';
export { buildRelationExtractionPrompt } from './prompts/relationExtraction.js';
```

---

## Task 5.4: 替换 assembler.js

**Files:**
- Replace: `server/src/modules/chat/assembler.js`

```javascript
// server/src/modules/chat/assembler.js - 完全替换

import User from '../user/model.js';
import ChatSession from './model.js';
import DualStorage from '../../core/storage/dual.js';
import { PromptAssembler, DynamicDataFetcher, CalibrationLayerManager } from '../rolecard/v2/index.js';
import SentimentManager from '../sentiment/manager.js';
import logger from '../../core/utils/logger.js';

/**
 * 角色卡组装器 V2
 */
class RoleCardAssemblerV2 {
  constructor() {
    this.dualStorage = new DualStorage();
    this.promptAssembler = new PromptAssembler();
    this.dataFetcher = new DynamicDataFetcher();
    this.sentimentManager = new SentimentManager();
    this.calibrationManager = CalibrationLayerManager;
  }

  /**
   * 组装动态角色卡
   */
  async assembleDynamicRoleCard({ targetUserId, interlocutorUserId, sessionId, assistantId }) {
    logger.info(`[RoleCardAssemblerV2] 开始组装 - Session: ${sessionId}`);

    try {
      // 1. 加载 V2 角色卡
      const roleCardV2 = await this.dualStorage.loadRoleCardV2(targetUserId);

      if (!roleCardV2) {
        throw new Error(`用户未生成V2角色卡: ${targetUserId}`);
      }

      // 2. 获取对话者信息
      const interlocutorUser = await User.findById(interlocutorUserId);

      // 3. 获取会话信息
      const session = await ChatSession.findOne({ sessionId });

      // 4. 获取动态数据
      const participantIds = assistantId ? [assistantId] : [interlocutorUserId];
      const dynamicData = await this.dataFetcher.fetchDynamicData(
        targetUserId,
        participantIds,
        roleCardV2
      );

      // 5. 获取好感度（陌生人场景）
      const sentiment = await this.sentimentManager.getStrangerSentiment(targetUserId, interlocutorUserId);

      // 6. 组装 System Prompt
      const { systemPrompt, metadata } = this.promptAssembler.assemble({
        coreLayer: roleCardV2.coreLayer,
        relationLayers: roleCardV2.relationLayers,
        guardrails: roleCardV2.safetyGuardrails,
        dynamicData,
        calibration: roleCardV2.calibration
      });

      // 7. 更新校准层统计
      if (roleCardV2.calibration) {
        this.calibrationManager.updateConversationStats(roleCardV2.calibration, 100);
        await this.dualStorage.saveRoleCardV2(targetUserId, roleCardV2);
      }

      logger.info(`[RoleCardAssemblerV2] 组装完成`);

      return {
        systemPrompt,
        dynamicData,
        session: {
          sessionId: session?.sessionId || sessionId,
          relation: session?.relation || 'unknown',
          sentimentScore: sentiment?.currentScore || 50
        },
        metadata
      };

    } catch (error) {
      logger.error(`[RoleCardAssemblerV2] 组装失败:`, error);
      throw error;
    }
  }
}

// 兼容旧版导出
export { RoleCardAssemblerV2 as default };
export { RoleCardAssemblerV2 as DynamicRoleCardAssembler };
```

---

## Task 5.5: 更新 roleCardAssemble.js 节点

**Files:**
- Modify: `server/src/modules/chat/nodes/roleCardAssemble.js`

```javascript
// server/src/modules/chat/nodes/roleCardAssemble.js - 修改

import RoleCardAssemblerV2 from '../assembler.js';
import logger from '../../../core/utils/logger.js';

/**
 * 角色卡组装节点 V2
 */
export async function roleCardAssembleNode(state) {
  try {
    logger.info('[RoleCardAssemble] 组装角色卡 V2');

    const { userId, interlocutor, metadata } = state;
    const sessionId = metadata?.sessionId || '';
    const assistantId = interlocutor.specificId;

    const assembler = new RoleCardAssemblerV2();
    const result = await assembler.assembleDynamicRoleCard({
      targetUserId: userId,
      interlocutorUserId: interlocutor.id,
      sessionId: sessionId,
      assistantId: assistantId
    });

    state.systemPrompt = result.systemPrompt;
    state.dynamicData = result.dynamicData;
    state.sessionMeta = result.session;

    logger.info('[RoleCardAssemble] V2角色卡组装完成');

    return state;

  } catch (error) {
    logger.error('[RoleCardAssemble] 处理失败:', error);
    state.addError(error);
    return state;
  }
}
```

---

## Task 5.6: 删除旧文件

完成所有上述任务后，删除以下旧文件：

```bash
rm server/src/modules/rolecard/generators/generatorA.js
rm server/src/modules/rolecard/generators/generatorB.js
rm server/src/modules/rolecard/preprocessor.js
rmdir server/src/modules/rolecard/generators
```

---

## Task 5.7: 更新 controller.js

**Files:**
- Modify: `server/src/modules/rolecard/controller.js`

更新生成角色卡的方法，使用新的 V2 生成器：

```javascript
// 在 controller.js 顶部添加导入
import {
  CoreLayerGenerator,
  RelationLayerGenerator,
  SafetyGuardrailsManager,
  CalibrationLayerManager
} from './v2/index.js';

// 替换 generateRoleCard 方法
async generateRoleCard(req, res) {
  const userId = req.user._id;

  try {
    // 1. 生成核心层
    const coreGenerator = new CoreLayerGenerator();
    const coreLayer = await coreGenerator.generate(userId);

    // 2. 生成关系层
    const relationGenerator = new RelationLayerGenerator();
    const relationResults = await relationGenerator.generateAll(userId);

    // 3. 获取安全护栏
    const guardrails = SafetyGuardrailsManager.getGuardrails(userId);

    // 4. 创建校准层
    const calibration = CalibrationLayerManager.createInitialCalibrationLayer(coreLayer);

    // 5. 组装完整角色卡
    const roleCardV2 = {
      version: '2.0.0',
      userId,
      coreLayer,
      relationLayers: relationResults.success.reduce((acc, layer) => {
        acc[layer.relationId] = layer;
        return acc;
      }, {}),
      safetyGuardrails: guardrails,
      calibration,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 6. 保存
    await dualStorage.saveRoleCardV2(userId, roleCardV2);

    // 7. 更新 MongoDB
    await User.updateOne(
      { _id: userId },
      { $set: { 'companionChat.roleCardV2': roleCardV2 } }
    );

    res.json({
      success: true,
      data: {
        roleCard: roleCardV2,
        relationStats: {
          success: relationResults.success.length,
          failed: relationResults.failed.length
        }
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
```

---

## 最终检查点

完成所有任务后，你应该有：

```
server/src/modules/rolecard/v2/
├── index.js                   ✅
├── coreLayerGenerator.js      ✅
├── relationLayerGenerator.js  ✅
├── safetyGuardrails.js        ✅
├── calibrationLayer.js        ✅
├── dynamicDataFetcher.js      ✅
├── promptAssembler.js         ✅
└── prompts/
    ├── coreExtraction.js      ✅
    └── relationExtraction.js  ✅

server/src/modules/chat/
├── assembler.js               ✅ (已替换)
└── nodes/
    └── roleCardAssemble.js    ✅ (已更新)

server/src/modules/rolecard/
├── controller.js              ✅ (已更新)
├── generators/                ❌ (已删除)
├── preprocessor.js            ❌ (已删除)
```

---

## 执行建议

1. 按顺序执行 Part 1 → Part 5
2. 每完成一个 Part 进行测试
3. 最后删除旧文件
4. 进行端到端集成测试
