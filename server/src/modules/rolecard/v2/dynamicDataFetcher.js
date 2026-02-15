// server/src/modules/rolecard/v2/dynamicDataFetcher.js

import User from '../../user/model.js';
import AssistRelation from '../../assist-relation/model.js';
import DualStorage from '../../../core/storage/dual.js';
import logger from '../../../core/utils/logger.js';

class DynamicDataFetcher {
  constructor() {
    this.dualStorage = new DualStorage();
  }

  async fetchDynamicData(roleCardOwnerId, participantUserIds, roleCardCollection) {
    logger.info(`[DynamicDataFetcher] 获取动态数据 - Owner: ${roleCardOwnerId}, Participants: ${participantUserIds.length}`);

    const owner = await User.findById(roleCardOwnerId);
    if (!owner) throw new Error(`用户不存在: ${roleCardOwnerId}`);

    const participants = await Promise.all(
      participantUserIds.map(id => this.resolveParticipant(id, roleCardCollection, owner))
    );

    return {
      roleCardOwner: {
        userId: owner._id.toString(),
        name: owner.name,
        nickname: owner.nickname,
        avatar: owner.avatar,
        demographicInfo: { age: owner.age, gender: owner.gender, location: owner.location }
      },
      participants
    };
  }

  async resolveParticipant(participantId, roleCardCollection, owner) {
    const participant = await User.findById(participantId);

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

    const participantName = participant.nickname || participant.name;
    const relationLayer = this.findRelationLayerByAssistantId(
      roleCardCollection?.relationLayers || {},
      participantId
    );

    let relationshipWithOwner, assistantPersonality;

    if (relationLayer) {
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

      const participantRoleCard = await this.dualStorage.loadRoleCardV2(participantId);

      if (participantRoleCard?.coreLayer) {
        assistantPersonality = {
          source: 'participant_rolecard',
          description: participantRoleCard.coreLayer.selfPerception?.selfDescriptionKeywords?.join('、') || '了解不深',
          communicationTraits: this.extractTraitsFromCoreLayer(participantRoleCard.coreLayer)
        };
      } else {
        assistantPersonality = { source: 'default', description: '对这个人的性格了解不深' };
      }
    }

    return { userId: participantId, name: participant.name, nickname: participant.nickname, relationshipWithOwner, assistantPersonality };
  }

  findRelationLayerByAssistantId(relationLayers, assistantId) {
    for (const relationId of Object.keys(relationLayers)) {
      const layer = relationLayers[relationId];
      if (layer.assistant?.id === assistantId) return layer;
    }
    return null;
  }

  async findUserRelation(assistantId, targetId) {
    try {
      return await AssistRelation.findOne({ assistantId, targetId, isActive: true });
    } catch { return null; }
  }

  extractTraitsFromCoreLayer(coreLayer) {
    const traits = [];
    const { personalityTraits } = coreLayer;
    if (personalityTraits) {
      if (personalityTraits.impulsiveSpeech !== 'rare') traits.push('说话比较直接');
      if (personalityTraits.emotionalExpression === 'expressive') traits.push('情感外露');
    }
    return traits;
  }
}

export default DynamicDataFetcher;
