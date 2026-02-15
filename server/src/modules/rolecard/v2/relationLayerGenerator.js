// server/src/modules/rolecard/v2/relationLayerGenerator.js

import { buildRelationExtractionPrompt } from './prompts/relationExtraction.js';
import Answer from '../../answer/model.js';
import AssistRelation from '../../assist-relation/model.js';
import User from '../../user/model.js';
import MultiLLMClient from '../../../core/llm/multi.js';
import DualStorage from '../../../core/storage/dual.js';
import logger from '../../../core/utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

class RelationLayerGenerator {
  constructor() {
    this.llmClient = new MultiLLMClient();
    this.dualStorage = new DualStorage();
  }

  async generateOne({ targetUserId, assistantId, relationId }) {
    logger.info(`[RelationLayerGenerator] 生成关系层 - Target: ${targetUserId}, Assistant: ${assistantId}`);

    try {
      const relation = await AssistRelation.findById(relationId);
      if (!relation) throw new Error(`关系不存在: ${relationId}`);

      const targetUser = await User.findById(targetUserId);
      const assistantUser = await User.findById(assistantId);
      if (!targetUser || !assistantUser) throw new Error('用户不存在');

      const questionRole = relation.relationshipType === 'family' ? 'B' : 'C';
      const answers = await this.collectAnswers({
        assistantId,
        targetId: targetUserId,
        questionRole
      });

      if (answers.length < 5) {
        throw new Error(`答案不足 (需要至少5个，当前${answers.length}个)`);
      }

      const prompt = buildRelationExtractionPrompt({
        relationType: relation.relationshipType,
        specificRelation: relation.specificRelation,
        assistantName: assistantUser.name,
        targetUserName: targetUser.name,
        answers
      });

      const llmResponse = await this.llmClient.generate(prompt, {
        temperature: 0.3,
        maxTokens: 2500,
        responseFormat: 'json'
      });

      const extractedData = this.parseLLMResponse(llmResponse);

      const relationLayer = {
        relationId: `rel_${uuidv4().slice(0, 8)}`,
        assistant: { id: assistantId, name: assistantUser.name, uniqueCode: assistantUser.uniqueCode },
        target: { id: targetUserId, name: targetUser.name },
        relation: {
          type: relation.relationshipType,
          specific: relation.specificRelation,
          intimacyLevel: this.determineIntimacyLevel(answers, extractedData),
          duration: relation.relationshipDuration
        },
        questionnaireSource: {
          type: questionRole,
          answerCount: answers.length,
          completedAt: new Date().toISOString()
        },
        ...extractedData,
        generatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      logger.info(`[RelationLayerGenerator] 关系层生成完成 - ${relation.specificRelation}`);
      return relationLayer;

    } catch (error) {
      logger.error(`[RelationLayerGenerator] 生成失败:`, error);
      throw error;
    }
  }

  async generateAll(targetUserId) {
    logger.info(`[RelationLayerGenerator] 生成所有关系层 - Target: ${targetUserId}`);

    const relations = await AssistRelation.find({ targetId: targetUserId, isActive: true });
    const results = { success: [], failed: [] };

    for (const relation of relations) {
      try {
        const layer = await this.generateOne({
          targetUserId,
          assistantId: relation.assistantId,
          relationId: relation._id
        });
        results.success.push(layer);
      } catch (error) {
        results.failed.push({ assistantId: relation.assistantId, error: error.message });
      }
    }

    logger.info(`[RelationLayerGenerator] 完成 - 成功: ${results.success.length}, 失败: ${results.failed.length}`);
    return results;
  }

  async collectAnswers({ assistantId, targetId, questionRole }) {
    const answers = await Answer.find({
      userId: assistantId,
      targetUserId: targetId,
      questionRole: questionRole
    })
    .populate('questionId')
    .sort({ createdAt: 1 });

    return answers.map(a => ({
      _id: a._id,
      questionId: a.questionId._id,
      questionText: a.questionId.text,
      questionLayer: a.questionId.layer,
      answerText: a.answerText,
      significance: a.questionId.significance
    }));
  }

  determineIntimacyLevel(answers, extractedData) {
    const secretsCount = extractedData.perceivedByAssistant?.sharedSecrets?.length || 0;
    const memoriesCount = extractedData.sharedMemories?.length || 0;

    if (secretsCount >= 3 || memoriesCount >= 5) return 'intimate';
    if (secretsCount >= 1 || memoriesCount >= 3) return 'close';
    if (memoriesCount >= 1) return 'moderate';
    return 'distant';
  }

  parseLLMResponse(response) {
    try {
      let parsed;
      if (typeof response === 'string') {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        else throw new Error('无法提取 JSON');
      } else {
        parsed = response;
      }
      if (!parsed.conversationGuidance || !parsed.perceivedByAssistant) {
        throw new Error('缺少必要字段');
      }
      return parsed;
    } catch (error) {
      logger.error(`[RelationLayerGenerator] 解析失败:`, error);
      throw new Error(`关系层解析失败: ${error.message}`);
    }
  }
}

export default RelationLayerGenerator;
