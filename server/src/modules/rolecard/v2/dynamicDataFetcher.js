// server/src/modules/rolecard/v2/dynamicDataFetcher.js

import User from '../../user/model.js';
import AssistRelation from '../../assist/model.js';
import DualStorage from '../../../core/storage/dual.js';
import { profileLogger } from '../../../core/utils/logger.js';

/**
 * 动态数据获取器 V2
 * 用于在 LangGraph 组装阶段获取动态数据
 * 适配新的 V2 数据结构
 */
class DynamicDataFetcher {
  constructor() {
    this.dualStorage = new DualStorage();
  }

  /**
   * 获取动态数据
   * @param {string} roleCardOwnerId - 角色卡所有者ID
   * @param {string[]} participantUserIds - 参与者用户ID列表
   * @returns {Promise<Object>} 动态数据对象
   */
  async fetchDynamicData(roleCardOwnerId, participantUserIds) {
    profileLogger.info('获取动态数据', {
      ownerId: roleCardOwnerId,
      participantCount: participantUserIds.length
    });

    // 获取角色卡所有者的核心层和关系层
    const coreLayer = await this.dualStorage.loadCoreLayer(roleCardOwnerId);
    const relationLayers = await this.dualStorage.loadAllRelationLayers(roleCardOwnerId);

    const owner = await User.findById(roleCardOwnerId);
    if (!owner) throw new Error(`用户不存在: ${roleCardOwnerId}`);

    const participants = await Promise.all(
      participantUserIds.map(id => this.resolveParticipant(id, relationLayers, owner))
    );

    return {
      roleCardOwner: {
        userId: owner._id.toString(),
        name: owner.name,
        nickname: owner.nickname,
        avatar: owner.avatar,
        profile: owner.profile,
        coreLayer
      },
      participants,
      relationLayers
    };
  }

  /**
   * 解析参与者信息
   */
  async resolveParticipant(participantId, relationLayers, owner) {
    const participant = await User.findById(participantId);

    // 陌生人情况
    if (!participant) {
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
        assistantPersonality: { source: 'default', description: '对这个人的性格了解不深' }
      };
    }

    // 查找关系层
    const relationLayer = this.findRelationLayerByAssistantId(relationLayers, participantId);

    let relationshipWithOwner, assistantPersonality;

    if (relationLayer) {
      // V2 数据结构
      const meta = relationLayer.relationMeta || {};

      relationshipWithOwner = {
        hasRelationLayer: true,
        relationLayerId: relationLayer.relationId,
        specificRelation: meta.specificRelation || '认识的人',
        relationType: meta.relationType || 'friend',
        intimacyLevel: meta.intimacyLevel || 'moderate',
        trustLevel: meta.trustLevel || 'tier4_acquaintance',  // LLM 分析的信任等级
        isFamily: meta.isFamily || false,
        isFriend: meta.isFriend || true
      };

      // 从 V2 字段中提取协助者视角的性格描述
      assistantPersonality = {
        source: 'relation_layer_v2',
        description: relationLayer.perceivedTraits?.summary || '了解不深',
        communicationTraits: relationLayer.communicationStyle?.keyPoints || [],
        interactionPatterns: relationLayer.interactionPatterns?.summary || null
      };
    } else {
      // 没有关系层，尝试从 AssistRelation 获取基本信息
      const userRelation = await this.findUserRelation(participantId, owner._id);

      if (userRelation) {
        relationshipWithOwner = {
          hasRelationLayer: false,
          specificRelation: userRelation.specificRelation || '认识的人',
          relationType: userRelation.relationshipType || 'other',
          intimacyLevel: 'moderate',
          trustLevel: 'tier3_familiar'  // 默认一般熟悉
        };
      } else {
        relationshipWithOwner = {
          hasRelationLayer: false,
          specificRelation: '陌生人',
          relationType: 'other',
          intimacyLevel: 'distant',
          trustLevel: 'tier4_acquaintance'  // 陌生人
        };
      }

      // 尝试从参与者的角色卡获取性格信息
      const participantCoreLayer = await this.dualStorage.loadCoreLayer(participantId);

      if (participantCoreLayer) {
        assistantPersonality = {
          source: 'participant_core_layer',
          description: participantCoreLayer.selfPerception?.summary ||
                       participantCoreLayer.personality?.summary || '了解不深',
          communicationTraits: participantCoreLayer.communicationStyle?.keyPoints || []
        };
      } else {
        assistantPersonality = { source: 'default', description: '对这个人的性格了解不深' };
      }
    }

    return {
      userId: participantId,
      name: participant.name,
      nickname: participant.nickname,
      avatar: participant.avatar,
      relationshipWithOwner,
      assistantPersonality
    };
  }

  /**
   * 通过协助者ID查找关系层
   */
  findRelationLayerByAssistantId(relationLayers, assistantId) {
    if (!relationLayers) return null;

    for (const relationId of Object.keys(relationLayers)) {
      const layer = relationLayers[relationId];
      // V2 结构使用 assistantId 字段
      if (layer.assistantId === assistantId || layer.assistantId?.toString() === assistantId) {
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
      return await AssistRelation.findOne({ assistantId, targetId: targetId, isActive: true });
    } catch {
      return null;
    }
  }

  /**
   * 获取核心层数据
   */
  async getCoreLayer(userId) {
    return await this.dualStorage.loadCoreLayer(userId);
  }

  /**
   * 获取所有关系层数据
   */
  async getRelationLayers(userId) {
    return await this.dualStorage.loadAllRelationLayers(userId);
  }

  /**
   * 获取特定协助者的关系层
   */
  async getRelationLayerForAssistant(userId, assistantId) {
    const layers = await this.dualStorage.loadAllRelationLayers(userId);
    return this.findRelationLayerByAssistantId(layers, assistantId);
  }
}

export default DynamicDataFetcher;
