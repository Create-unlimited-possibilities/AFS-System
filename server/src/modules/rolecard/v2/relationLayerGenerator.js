// server/src/modules/rolecard/v2/relationLayerGenerator.js

import {
  COMMON_RELATION_FIELDS,
  FAMILY_SPECIFIC_FIELDS,
  FRIEND_SPECIFIC_FIELDS,
  FAMILY_RELATION_FIELDS,
  FRIEND_RELATION_FIELDS,
  buildPerAnswerRelationExtractionPrompt,
  buildRelationFieldCompressionPrompt,
  buildTrustLevelAnalysisPrompt,
  getFieldsForRelationType
} from './prompts/relationExtractionV2.js';
import Answer from '../../qa/models/answer.js';
import Question from '../../qa/models/question.js';
import MultiLLMClient from '../../../core/llm/multi.js';
import { llmConfig } from '../../../core/llm/config.js';
import DualStorage from '../../../core/storage/dual.js';
import User from '../../user/model.js';
import AssistRelation from '../../assist/model.js';
import { profileLogger } from '../../../core/utils/logger.js';

/**
 * 关系层生成器 V2
 * 处理 B-set（家人）和 C-set（朋友）问题
 * 为每个协助者生成独立的关系层
 * 采用逐条提取 + 逐字段压缩的方式
 */
class RelationLayerGenerator {
  constructor() {
    this.llmClient = new MultiLLMClient();
    this.dualStorage = new DualStorage();
    // 用于收集每个字段的片段
    this.fieldFragments = {};
  }

  /**
   * 为指定用户的所有协助者生成关系层
   * @param {string} userId - 目标用户ID
   * @param {Function} onProgress - 进度回调函数 (progress) => {}
   * @returns {Promise<Object>} 生成结果 { success: [], skipped: [], failed: [] }
   */
  async generateAll(userId, onProgress = null) {
    profileLogger.info('开始生成所有关系层', { userId });

    try {
      // 1. 获取用户的所有协助关系
      const relations = await AssistRelation.find({ targetId: userId })
        .populate('assistantId');

      if (relations.length === 0) {
        profileLogger.info('没有找到协助关系', { userId });
        return { success: [], skipped: [], failed: [] };
      }

      profileLogger.info(`找到 ${relations.length} 个协助关系`, { userId });

      const results = { success: [], skipped: [], failed: [] };

      // 2. 为每个协助者生成关系层
      for (let i = 0; i < relations.length; i++) {
        const relation = relations[i];

        // 发送进度
        if (onProgress) {
          onProgress({
            stage: 'relation_layer',
            current: i + 1,
            total: relations.length,
            message: `生成关系层 ${i + 1}/${relations.length}`
          });
        }

        try {
          const layer = await this.generateOne(userId, relation);
          if (layer) {
            results.success.push(layer);
          } else {
            results.skipped.push({
              assistantId: relation.assistantId?._id || relation.assistantId,
              reason: '答案不足'
            });
          }
        } catch (error) {
          profileLogger.error('生成单个关系层失败', {
            userId,
            relationId: relation._id,
            error: error.message
          });
          results.failed.push({
            assistantId: relation.assistantId?._id || relation.assistantId,
            error: error.message
          });
        }
      }

      profileLogger.info(`关系层生成完成 - 成功: ${results.success.length}, 跳过: ${results.skipped.length}, 失败: ${results.failed.length}`, { userId });

      return results;

    } catch (error) {
      profileLogger.error('生成所有关系层失败', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * 为单个协助者生成关系层
   * @param {string} userId - 目标用户ID
   * @param {Object} relation - 协助关系对象
   * @returns {Promise<Object|null>} 关系层数据，如果答案不足返回 null
   */
  async generateOne(userId, relation) {
    const relationId = relation._id.toString();
    const assistantId = relation.assistantId?._id?.toString() || relation.assistantId?.toString();
    const assistantName = relation.assistantId?.name || '协助者';
    const specificRelation = relation.relationType || relation.specificRelation || '朋友';

    // 确定关系类型（家人/朋友）
    const relationType = this.classifyRelationType(specificRelation);

    profileLogger.info('开始生成单个关系层', {
      userId,
      relationId,
      assistantName,
      specificRelation,
      relationType
    });

    // 重置字段片段容器
    this.resetFieldFragments(relationType);

    try {
      // 1. 收集该协助者的答案
      const answersWithQuestions = await this.collectAssistantAnswers(
        userId,
        assistantId,
        relationType
      );

      if (answersWithQuestions.length < 3) {
        profileLogger.warn('协助者答案不足，跳过生成', {
          userId,
          relationId,
          answerCount: answersWithQuestions.length,
          minimum: 3
        });
        return null;
      }

      profileLogger.info(`收集到 ${answersWithQuestions.length} 个协助者答案`, {
        userId,
        relationId
      });

      // 2. 逐条处理答案（串行）
      for (let i = 0; i < answersWithQuestions.length; i++) {
        const item = answersWithQuestions[i];
        profileLogger.info(`处理答案 ${i + 1}/${answersWithQuestions.length}`, {
          userId,
          relationId,
          questionId: item.questionId
        });

        await this.processOneAnswer(item, relationType, assistantName, specificRelation);
      }

      // 3. 逐字段压缩
      const compressedFields = await this.compressAllFields(relationType, specificRelation);

      // 4. 确定亲密度
      const intimacyLevel = this.determineIntimacyLevel(answersWithQuestions, compressedFields);

      // 5. LLM 分析信任等级
      const trustLevel = await this.determineTrustLevel(
        relationType,
        specificRelation,
        intimacyLevel,
        compressedFields
      );

      profileLogger.info('信任等级分析完成', {
        userId,
        relationId,
        trustLevel,
        intimacyLevel
      });

      // 6. 构建最终关系层
      const relationLayer = {
        version: '2.1.0',
        generatedAt: new Date().toISOString(),
        userId,
        relationId,
        assistantId,
        assistantName,

        // 关系元信息（简单关系层）
        relationMeta: {
          specificRelation,
          relationType,
          isFamily: relationType === 'family',
          isFriend: relationType === 'friend',
          intimacyLevel,
          trustLevel  // LLM 分析的信任等级
        },

        // LLM 提取的字段（复杂关系层）
        ...compressedFields,

        // 元数据
        metadata: {
          sourceAnswerCount: answersWithQuestions.length,
          sourceQuestionIds: answersWithQuestions.map(a => a.questionId),
          extractionModel: llmConfig.getConfig().ollamaModel,
          compressionModel: llmConfig.getConfig().ollamaModel
        }
      };

      // 7. 双重存储
      await this.dualStorage.saveRelationLayer(userId, relationId, relationLayer);

      profileLogger.info('单个关系层生成完成', { userId, relationId });

      return relationLayer;

    } catch (error) {
      profileLogger.error('生成单个关系层失败', {
        userId,
        relationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 分类关系类型（家人/朋友）
   */
  classifyRelationType(specificRelation) {
    const familyKeywords = ['父亲', '母亲', '爸爸', '妈妈', '儿子', '女儿', '兄弟', '姐妹',
                           '哥哥', '弟弟', '姐姐', '妹妹', '爷爷', '奶奶', '外公', '外婆',
                           '叔叔', '阿姨', '舅舅', '舅妈', '丈夫', '妻子', '老公', '老婆',
                           '亲人', '家人', '长辈', '晚辈', '亲戚'];

    const relationLower = (specificRelation || '').toLowerCase();

    for (const keyword of familyKeywords) {
      if (relationLower.includes(keyword)) {
        return 'family';
      }
    }

    return 'friend';
  }

  /**
   * 收集协助者的答案
   */
  async collectAssistantAnswers(userId, assistantId, relationType) {
    // 根据关系类型选择题目集
    // B-set (role: family) = 家人问题, C-set (role: friend) = 朋友问题
    const targetRole = relationType === 'family' ? 'family' : 'friend';

    profileLogger.info('收集协助者答案', { userId, assistantId, relationType, targetRole });

    const answers = await Answer.find({
      userId: assistantId,        // 协助者回答
      targetUserId: userId,       // 关于目标用户
      isSelfAnswer: false         // 不是自答
    })
    .populate('questionId')
    .sort({ createdAt: 1 });

    const filtered = answers.filter(a => a.questionId && a.questionId.role === targetRole);

    profileLogger.info(`收集到 ${filtered.length} 个符合条件的协助者答案`, {
      userId,
      assistantId,
      relationType,
      targetRole,
      totalCount: answers.length,
      filteredCount: filtered.length
    });

    return filtered.map(a => ({
      answerId: a._id,
      questionId: a.questionId._id,
      questionText: a.questionId.question,
      questionLayer: a.questionId.layer,
      questionRole: a.questionId.role,
      significance: a.questionId.significance,
      answerText: a.answer
    }));
  }

  /**
   * 处理单条答案
   */
  async processOneAnswer(item, relationType, assistantName, specificRelation) {
    try {
      const prompt = buildPerAnswerRelationExtractionPrompt(
        item.questionText,
        item.answerText,
        item.significance,
        relationType,
        assistantName,
        specificRelation
      );

      const extracted = await this.callLLMWithRetry(prompt, {
        temperature: 0.3,
        maxTokens: 1000,
        responseFormat: 'json'
      });

      if (extracted && extracted.extractedFields) {
        // 将提取的内容添加到对应字段的片段列表
        for (const [fieldName, content] of Object.entries(extracted.extractedFields)) {
          if (content && this.fieldFragments[fieldName]) {
            this.fieldFragments[fieldName].push({
              content,
              sourceQuestionId: item.questionId,
              confidence: extracted.confidence || 'medium'
            });
          }
        }
      }

    } catch (error) {
      profileLogger.error('处理单条关系答案失败', {
        questionId: item.questionId,
        error: error.message
      });
      // 继续处理其他答案
    }
  }

  /**
   * 压缩所有字段
   */
  async compressAllFields(relationType, specificRelation) {
    const compressedFields = {};
    const fields = getFieldsForRelationType(relationType);

    for (const [fieldName, fragments] of Object.entries(this.fieldFragments)) {
      if (fragments.length === 0) {
        compressedFields[fieldName] = {
          raw: null,
          summary: null,
          sourceCount: 0
        };
        continue;
      }

      profileLogger.info(`压缩关系字段: ${fieldName}`, { fragmentCount: fragments.length });

      try {
        const fragmentTexts = fragments.map(f => f.content);
        const prompt = buildRelationFieldCompressionPrompt(
          fieldName,
          fragmentTexts,
          relationType,
          specificRelation
        );

        const field = fields[fieldName];
        const compressed = await this.callLLMWithRetry(prompt, {
          temperature: 0.3,
          maxTokens: (field?.tokenTarget || 200) + 100,
          responseFormat: 'json'
        });

        compressedFields[fieldName] = {
          keyPoints: compressed?.keyPoints || [],
          summary: compressed?.compressed || null,
          sourceCount: fragments.length,
          sourceQuestionIds: fragments.map(f => f.sourceQuestionId)
        };

      } catch (error) {
        profileLogger.error(`压缩关系字段失败: ${fieldName}`, { error: error.message });
        compressedFields[fieldName] = {
          raw: fragments.map(f => f.content).join('\n'),
          summary: fragments.map(f => f.content).join('\n'),
          sourceCount: fragments.length,
          sourceQuestionIds: fragments.map(f => f.sourceQuestionId)
        };
      }
    }

    return compressedFields;
  }

  /**
   * 确定亲密度级别
   */
  determineIntimacyLevel(answers, compressedFields) {
    // 基于共同回忆和支持动态评估亲密度
    const sharedMemories = compressedFields.sharedMemories?.sourceCount || 0;
    const emotionalBond = compressedFields.emotionalBond?.sourceCount || 0;
    const supportDynamics = compressedFields.supportDynamics?.sourceCount || 0;

    const totalDepth = sharedMemories + emotionalBond + supportDynamics;

    if (totalDepth >= 6) return 'intimate';
    if (totalDepth >= 4) return 'close';
    if (totalDepth >= 2) return 'moderate';
    return 'distant';
  }

  /**
   * LLM 分析信任等级
   * 根据复杂关系层的完整数据判断该关系的信任等级
   * @param {string} relationType - 关系类型 (family/friend)
   * @param {string} specificRelation - 具体关系描述
   * @param {string} intimacyLevel - 亲密度级别
   * @param {Object} compressedFields - 压缩后的字段数据
   * @returns {Promise<string>} 信任等级
   */
  async determineTrustLevel(relationType, specificRelation, intimacyLevel, compressedFields) {
    try {
      const prompt = buildTrustLevelAnalysisPrompt(
        relationType,
        specificRelation,
        intimacyLevel,
        compressedFields
      );

      const result = await this.callLLMWithRetry(prompt, {
        temperature: 0.2,
        maxTokens: 300,
        responseFormat: 'json'
      });

      if (result && result.trustLevel) {
        // 验证返回的 trustLevel 是否有效
        const validLevels = ['tier1_intimate', 'tier2_close', 'tier3_familiar', 'tier4_acquaintance'];
        if (validLevels.includes(result.trustLevel)) {
          profileLogger.info('LLM 信任等级分析结果', {
            trustLevel: result.trustLevel,
            confidence: result.confidence,
            reasoning: result.reasoning
          });
          return result.trustLevel;
        }
      }

      // 如果 LLM 返回无效结果，基于 intimacyLevel 回退
      profileLogger.warn('LLM 信任等级分析返回无效结果，使用回退逻辑', { result });
      return this.fallbackTrustLevel(intimacyLevel, relationType);

    } catch (error) {
      profileLogger.error('LLM 信任等级分析失败，使用回退逻辑', { error: error.message });
      return this.fallbackTrustLevel(intimacyLevel, relationType);
    }
  }

  /**
   * 回退信任等级判断（当 LLM 失败时使用）
   */
  fallbackTrustLevel(intimacyLevel, relationType) {
    // 家人关系默认信任等级更高
    if (relationType === 'family') {
      switch (intimacyLevel) {
        case 'intimate': return 'tier1_intimate';
        case 'close': return 'tier1_intimate';
        case 'moderate': return 'tier2_close';
        default: return 'tier3_familiar';
      }
    } else {
      // 朋友关系
      switch (intimacyLevel) {
        case 'intimate': return 'tier2_close';
        case 'close': return 'tier2_close';
        case 'moderate': return 'tier3_familiar';
        default: return 'tier4_acquaintance';
      }
    }
  }

  /**
   * 重置字段片段容器
   */
  resetFieldFragments(relationType) {
    this.fieldFragments = {};
    const fields = getFieldsForRelationType(relationType);

    Object.keys(fields).forEach(key => {
      this.fieldFragments[key] = [];
    });
  }

  /**
   * 解析 JSON 响应
   */
  parseJsonResponse(response) {
    try {
      if (typeof response === 'object') {
        return response;
      }

      if (typeof response === 'string') {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      return null;
    } catch (error) {
      profileLogger.error('解析 JSON 响应失败', {
        error: error.message,
        response: response?.substring?.(0, 200)
      });
      return null;
    }
  }

  /**
   * 带 JSON 解析重试的 LLM 调用
   * @param {string} prompt - 提示词
   * @param {Object} options - LLM 调用选项
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<Object|null>} 解析后的 JSON 对象或 null
   */
  async callLLMWithRetry(prompt, options, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.llmClient.generate(prompt, options);
        const parsed = this.parseJsonResponse(response);

        if (parsed) {
          if (attempt > 1) {
            profileLogger.info(`JSON 解析重试成功`, { attempt });
          }
          return parsed;
        }

        profileLogger.warn('JSON 解析失败，准备重试', {
          attempt,
          maxRetries,
          responsePreview: typeof response === 'string' ? response.substring(0, 100) : 'object'
        });
      } catch (error) {
        profileLogger.error('LLM 调用失败', { attempt, error: error.message });
      }
    }

    profileLogger.error('JSON 解析重试次数用尽', { maxRetries });
    return null;
  }

  /**
   * 为新添加的协助者生成关系层（增量生成）
   * @param {string} userId - 目标用户ID
   * @param {string} relationId - 协助关系ID
   */
  async generateForNewRelation(userId, relationId) {
    const relation = await AssistRelation.findById(relationId).populate('assistantId');

    if (!relation) {
      throw new Error('协助关系不存在');
    }

    return await this.generateOne(userId, relation);
  }

  /**
   * 获取用户的所有关系层（从存储加载）
   */
  async loadAll(userId) {
    return await this.dualStorage.loadAllRelationLayers(userId);
  }
}

export default RelationLayerGenerator;
