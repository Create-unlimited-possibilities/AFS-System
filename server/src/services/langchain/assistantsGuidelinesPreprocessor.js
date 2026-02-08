/**
 * 协助者对话准则预处理器
 * 收集并预处理所有协助者的对话准则，使用 LLM 压缩答案并生成对话准则，保存到双重存储系统
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import mongoose from 'mongoose';
import Answer from '../../models/Answer.js';
import Question from '../../models/Question.js';
import AssistRelation from '../../models/AssistRelation.js';
import User from '../../models/User.js';
import { multiLLMClient } from './multiLLMClient.js';
import DualStorage from '../dualStorage.js';
import logger from '../../utils/logger.js';

/**
 * 协助者对话准则预处理器类
 * 负责收集、压缩、生成协助者的对话准则
 */
class AssistantsGuidelinesPreprocessor {
  constructor() {
    this.dualStorage = new DualStorage();
    this.minProgress = 0.8; // 80% 完成度
  }

  /**
   * 获取所有协助者关系
   * @param {string} userId - 用户ID（作为assistantId查询）
   * @returns {Promise<Array>} 协助者关系数组
   */
  async getAssistRelations(userId) {
    try {
      logger.info(`[AssistantsGuidelinesPreprocessor] 获取用户 ${userId} 的所有协助者关系`);

      const relations = await AssistRelation.find({ 
        assistantId: userId, 
        isActive: true 
      }).populate('targetId', 'uniqueCode email name');

      if (relations.length === 0) {
        throw new Error('未找到任何协助者关系');
      }

      logger.info(`[AssistantsGuidelinesPreprocessor] 找到 ${relations.length} 个协助者关系`);

      return relations;
    } catch (error) {
      logger.error(`[AssistantsGuidelinesPreprocessor] 获取协助者关系失败:`, error);
      throw new Error(`获取协助者关系失败: ${error.message}`);
    }
  }

  /**
   * 收集协助者的 B/C 套题答案
   * @param {string} assistantId - 协助者ID
   * @param {string} targetId - 目标用户ID
   * @returns {Promise<Object>} 包含 basic 和 emotional 答案的对象
   */
  async collectAnswers(assistantId, targetId) {
    try {
      logger.info(`[AssistantsGuidelinesPreprocessor] 收集协助者 ${assistantId} 对目标用户 ${targetId} 的 B/C 套题答案`);

      const answers = await Answer.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(assistantId),
            targetUserId: new mongoose.Types.ObjectId(targetId),
            questionLayer: { $in: ['basic', 'emotional'] }
          }
        },
        {
          $group: {
            _id: '$questionId',
            questionLayer: { $first: '$questionLayer' },
            answers: {
              $push: {
                userId: '$userId',
                answer: '$answer',
                createdAt: '$createdAt',
                relationshipType: '$relationshipType'
              }
            }
          }
        },
        {
          $sort: { questionLayer: 1 }
        }
      ]);

      if (answers.length === 0) {
        logger.warn(`[AssistantsGuidelinesPreprocessor] 未找到 B/C 套题答案`);
        return {
          basic: [],
          emotional: []
        };
      }

      // 填充问题信息
      const enrichedAnswers = [];
      for (const answerGroup of answers) {
        const question = await Question.findById(answerGroup._id);
        if (question) {
          enrichedAnswers.push({
            questionId: question._id,
            question: question.question,
            questionLayer: answerGroup.questionLayer,
            answers: answerGroup.answers
          });
        }
      }

      const basicAnswers = enrichedAnswers.filter(a => a.questionLayer === 'basic');
      const emotionalAnswers = enrichedAnswers.filter(a => a.questionLayer === 'emotional');

      logger.info(`[AssistantsGuidelinesPreprocessor] 收集到 ${basicAnswers.length} 个 B 套题答案，${emotionalAnswers.length} 个 C 套题答案`);

      return {
        basic: basicAnswers,
        emotional: emotionalAnswers
      };
    } catch (error) {
      logger.error(`[AssistantsGuidelinesPreprocessor] 收集 B/C 套题答案失败:`, error);
      throw new Error(`收集 B/C 套题答案失败: ${error.message}`);
    }
  }

  /**
   * 压缩答案（使用 LLM）
   * @param {Array} answersWithQuestion - 带问题的答案数组
   * @param {Object} roleCard - 目标用户的角色卡
   * @returns {Promise<Array>} 压缩后的答案数组
   */
  async compressAnswers(answersWithQuestion, roleCard) {
    try {
      logger.info(`[AssistantsGuidelinesPreprocessor] 开始压缩 ${answersWithQuestion.length} 个问题的答案`);

      const compressedAnswers = [];

      for (const item of answersWithQuestion) {
        try {
          // 构建压缩提示词
          const prompt = `请将以下针对同一个问题的多个回答压缩成 2-5 个关键点。

问题：${item.question}

原始回答：
${item.answers.map((a, i) => `${i + 1}. ${a.answer}`).join('\n')}

目标用户的角色卡参考：
- 性格特点：${roleCard.personality || '未知'}
- 沟通风格：${roleCard.communicationStyle || '未知'}

请以JSON格式返回，包含：
{
  "keyPoints": ["关键点1", "关键点2", ...],
  "summary": "简要总结（一句话）"
}

只返回JSON，不要有其他内容。`;

          // 调用 LLM 压缩
          const llmResponse = await multiLLMClient.generate(prompt, {
            temperature: 0.5,
            maxTokens: 500
          });

          // 解析 JSON 响应
          let compressed;
          try {
            const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              compressed = JSON.parse(jsonMatch[0]);
            } else {
              compressed = JSON.parse(llmResponse);
            }
          } catch (parseError) {
            logger.warn(`[AssistantsGuidelinesPreprocessor] 解析压缩响应失败，保留原始答案`);
            compressed = {
              keyPoints: item.answers.map(a => a.answer).slice(0, 3),
              summary: item.answers[0]?.answer || ''
            };
          }

          compressedAnswers.push({
            questionId: item.questionId,
            question: item.question,
            originalAnswer: item.answers.map(a => a.answer).join('; '),
            compressed: JSON.stringify(compressed),
            questionLayer: item.questionLayer,
            compressedAt: new Date()
          });

          logger.info(`[AssistantsGuidelinesPreprocessor] 问题 "${item.question.substring(0, 30)}..." 压缩完成`);
        } catch (error) {
          logger.error(`[AssistantsGuidelinesPreprocessor] 压缩问题失败:`, error);
          // 保留原始答案
          compressedAnswers.push({
            questionId: item.questionId,
            question: item.question,
            originalAnswer: item.answers.map(a => a.answer).join('; '),
            compressed: null,
            questionLayer: item.questionLayer,
            error: error.message
          });
        }
      }

      logger.info(`[AssistantsGuidelinesPreprocessor] 成功压缩 ${compressedAnswers.filter(a => a.compressed).length} / ${compressedAnswers.length} 个答案`);

      return compressedAnswers;
    } catch (error) {
      logger.error(`[AssistantsGuidelinesPreprocessor] 压缩答案失败:`, error);
      throw new Error(`压缩答案失败: ${error.message}`);
    }
  }

  /**
   * 生成协助者对话准则
   * @param {Array} compressedAnswers - 压缩后的答案数组
   * @param {Object} relation - 协助关系
   * @param {Object} targetRoleCard - 目标用户的角色卡
   * @returns {Promise<string>} 对话准则文本
   */
  async generateGuidelines(compressedAnswers, relation, targetRoleCard) {
    try {
      logger.info(`[AssistantsGuidelinesPreprocessor] 为协助者 ${relation.assistantId} 生成对话准则`);

      // 构建准则生成提示词
      const basicSummary = compressedAnswers
        .filter(a => a.questionLayer === 'basic')
        .map(a => `${a.question}: ${a.compressed || a.originalAnswer}`)
        .join('\n');

      const emotionalSummary = compressedAnswers
        .filter(a => a.questionLayer === 'emotional')
        .map(a => `${a.question}: ${a.compressed || a.originalAnswer}`)
        .join('\n');

      const prompt = `请根据以下信息，为协助者生成与目标用户的对话准则。

协助者信息：
- 关系类型：${relation.relationshipType}
- 具体关系：${relation.specificRelation}

目标用户的角色卡：
- 性格特点：${targetRoleCard.personality || '未知'}
- 沟通风格：${targetRoleCard.communicationStyle || '未知'}
- 兴趣爱好：${(targetRoleCard.interests || []).join('、') || '未知'}
- 情感需求：${(targetRoleCard.emotionalNeeds || []).join('、') || '未知'}

B套题答案摘要（基本信息）：
${basicSummary || '无'}

C套题答案摘要（情感信息）：
${emotionalSummary || '无'}

请生成300-600字的对话准则，包含以下内容：
1. 语气建议（温和、友好等）
2. 沟通风格建议（适合的沟通方式）
3. 话题建议（3-5条建议话题）
4. 避免话题（3-5条应避免的话题）

准则应该具体、实用，能够指导实际的对话。只返回对话准则文本，不要有其他内容。`;

      // 调用 LLM 生成准则
      const guidelines = await multiLLMClient.generate(prompt, {
        temperature: 0.7,
        maxTokens: 1000
      });

      // 检查长度
      if (guidelines.length < 200) {
        logger.warn(`[AssistantsGuidelinesPreprocessor] 生成的对话准则过短: ${guidelines.length} 字`);
      }

      logger.info(`[AssistantsGuidelinesPreprocessor] 对话准则生成成功，长度: ${guidelines.length} 字`);

      return guidelines;
    } catch (error) {
      logger.error(`[AssistantsGuidelinesPreprocessor] 生成对话准则失败:`, error);
      throw new Error(`生成对话准则失败: ${error.message}`);
    }
  }

  /**
   * 保存单个协助者的对话准则
   * @param {string} userId - 用户ID（作为assistantId）
   * @param {Object} guideline - 协助者对话准则对象
   * @returns {Promise<Object>} 保存结果
   */
  async saveOneGuideline(userId, guideline) {
    try {
      logger.info(`[AssistantsGuidelinesPreprocessor] 保存协助者 ${guideline.assistantId} 的对话准则`);

      // 1. 保存到文件系统
      await this.dualStorage.updateOneAssistantGuideline(userId, guideline.assistantId, guideline);

      // 2. 更新 MongoDB - 更新或插入到用户的 assistantsGuidelines 数组
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      const existingIndex = (user.companionChat?.assistantsGuidelines || [])
        .findIndex(g => g.assistantId.toString() === guideline.assistantId.toString());

      const updateQuery = existingIndex >= 0
        ? { $set: { [`companionChat.assistantsGuidelines.${existingIndex}`]: guideline } }
        : { $push: { 'companionChat.assistantsGuidelines': guideline } };

      await User.updateOne({ _id: userId }, updateQuery);

      logger.info(`[AssistantsGuidelinesPreprocessor] 对话准则保存成功`);

      return {
        success: true,
        guideline
      };
    } catch (error) {
      logger.error(`[AssistantsGuidelinesPreprocessor] 保存对话准则失败:`, error);
      throw new Error(`保存对话准则失败: ${error.message}`);
    }
  }

  /**
   * 保存所有协助者的对话准则
   * @param {string} userId - 用户ID（作为assistantId）
   * @param {Array} guidelines - 协助者对话准则数组
   * @returns {Promise<Object>} 保存结果
   */
  async saveAllGuidelines(userId, guidelines) {
    try {
      logger.info(`[AssistantsGuidelinesPreprocessor] 保存所有 ${guidelines.length} 个协助者的对话准则`);

      // 1. 保存到文件系统
      await this.dualStorage.saveAssistantsGuidelines(userId, guidelines);

      // 2. 更新 MongoDB
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            'companionChat.assistantsGuidelines': guidelines,
            'companionChat.modelStatus.hasBaseModel': true
          }
        }
      );

      // 3. 更新所有 AssistRelation 的 guidelinesGenerated 标记
      const assistantIds = guidelines.map(g => g.assistantId);
      await AssistRelation.updateMany(
        { assistantId: userId, isActive: true },
        { guidelinesGenerated: true }
      );

      logger.info(`[AssistantsGuidelinesPreprocessor] 所有对话准则保存成功`);

      return {
        success: true,
        count: guidelines.length
      };
    } catch (error) {
      logger.error(`[AssistantsGuidelinesPreprocessor] 保存所有对话准则失败:`, error);
      throw new Error(`保存所有对话准则失败: ${error.message}`);
    }
  }

  /**
   * 预处理单个协助者的对话准则
   * @param {string} userId - 用户ID（作为assistantId）
   * @param {string} assistantId - 协助者ID
   * @param {Object} relation - 协助关系对象
   * @returns {Promise<Object>} 预处理结果
   */
  async preprocessOne(userId, assistantId, relation) {
    const startTime = Date.now();

    try {
      logger.info(`[AssistantsGuidelinesPreprocessor] 开始预处理协助者 ${assistantId} 的对话准则`);

      // 1. 加载目标用户的角色卡
      const targetUser = await User.findById(relation.targetId);
      const roleCard = targetUser.companionChat?.roleCard;
      
      // 检查角色卡是否存在且有效
      // 有效的角色卡应该包含至少一个实际的文本字段（不是仅包含数组或数字默认值）
      const hasValidFields = roleCard && (
        (roleCard.personality && typeof roleCard.personality === 'string') ||
        (roleCard.background && typeof roleCard.background === 'string') ||
        (roleCard.communicationStyle && typeof roleCard.communicationStyle === 'string')
      );
      
      if (!targetUser || !hasValidFields) {
        throw new Error('目标用户的角色卡不存在，请先生成角色卡');
      }

      const targetRoleCard = roleCard;

      // 2. 收集 B/C 套题答案
      const answers = await this.collectAnswers(assistantId, relation.targetId);

      // 3. 压缩答案
      const allAnswers = [...answers.basic, ...answers.emotional];
      const compressedAnswers = await this.compressAnswers(allAnswers, targetRoleCard);

      // 4. 生成对话准则
      const guidelinesText = await this.generateGuidelines(compressedAnswers, relation, targetRoleCard);

      // 5. 构建准则对象
      const guideline = {
        assistantId: assistantId,
        assistantName: targetUser.name || '未知',
        assistantUniqueCode: targetUser.uniqueCode || '',
        assistRelationId: relation._id,
        relationType: relation.relationshipType,
        specificRelation: relation.specificRelation,
        conversationGuidelines: guidelinesText,
        compressedAnswers: compressedAnswers,
        generatedAt: new Date(),
        updatedAt: new Date(),
        isValid: true
      };

      // 6. 保存单个准则
      const saveResult = await this.saveOneGuideline(userId, guideline);

      // 7. 更新 AssistRelation 的 guidelinesGenerated 标记
      await AssistRelation.updateOne(
        { _id: relation._id },
        { guidelinesGenerated: true }
      );

      const duration = Date.now() - startTime;
      logger.info(`[AssistantsGuidelinesPreprocessor] 协助者 ${assistantId} 的对话准则预处理完成，耗时: ${duration}ms`);

      return {
        success: true,
        guideline,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`[AssistantsGuidelinesPreprocessor] 协助者 ${assistantId} 的对话准则预处理失败，耗时: ${duration}ms`, error);
      throw error;
    }
  }

  /**
   * 预处理所有协助者的对话准则
   * @param {string} userId - 用户ID（作为assistantId）
   * @returns {Promise<Object>} 预处理结果
   */
  async preprocessAll(userId) {
    const startTime = Date.now();

    try {
      logger.info(`[AssistantsGuidelinesPreprocessor] 开始为用户 ${userId} 预处理所有协助者的对话准则`);

      // 1. 获取所有协助者关系
      const relations = await this.getAssistRelations(userId);

      // 2. 排序：未生成的优先
      relations.sort((a, b) => {
        if (a.guidelinesGenerated === b.guidelinesGenerated) return 0;
        return a.guidelinesGenerated ? 1 : -1;
      });

      // 3. 逐个预处理（串行处理，避免并发压力）
      const allGuidelines = [];
      const errors = [];

      for (const relation of relations) {
        try {
          const result = await this.preprocessOne(userId, relation.targetId, relation);
          allGuidelines.push(result.guideline);
          logger.info(`[AssistantsGuidelinesPreprocessor] 协助者 ${relation.targetId} 预处理成功`);
        } catch (error) {
          logger.error(`[AssistantsGuidelinesPreprocessor] 协助者 ${relation.targetId} 预处理失败:`, error);
          errors.push({
            assistantId: relation.targetId,
            error: error.message
          });
        }
      }

      // 4. 如果有成功的准则，保存到双重存储
      if (allGuidelines.length > 0) {
        await this.saveAllGuidelines(userId, allGuidelines);
      }

      const duration = Date.now() - startTime;
      logger.info(`[AssistantsGuidelinesPreprocessor] 所有协助者的对话准则预处理完成，耗时: ${duration}ms`);

      return {
        success: true,
        total: relations.length,
        successful: allGuidelines.length,
        failed: errors.length,
        guidelines: allGuidelines,
        errors,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`[AssistantsGuidelinesPreprocessor] 预处理所有协助者的对话准则失败，耗时: ${duration}ms`, error);
      throw error;
    }
  }

  /**
   * 更新单个协助者的对话准则（增量更新）
   * @param {string} userId - 用户ID（作为assistantId）
   * @param {string} assistantId - 协助者ID
   * @returns {Promise<Object>} 更新结果
   */
  async updateOneGuideline(userId, assistantId) {
    const startTime = Date.now();

    try {
      logger.info(`[AssistantsGuidelinesPreprocessor] 开始更新协助者 ${assistantId} 的对话准则`);

      // 1. 获取协助关系
      const relation = await AssistRelation.findOne({ 
        assistantId: userId, 
        targetId: assistantId, 
        isActive: true 
      });

      if (!relation) {
        throw new Error('协助关系不存在');
      }

      // 2. 重新预处理
      const result = await this.preprocessOne(userId, assistantId, relation);

      const duration = Date.now() - startTime;
      logger.info(`[AssistantsGuidelinesPreprocessor] 协助者 ${assistantId} 的对话准则更新完成，耗时: ${duration}ms`);

      return {
        success: true,
        guideline: result.guideline,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`[AssistantsGuidelinesPreprocessor] 协助者 ${assistantId} 的对话准则更新失败，耗时: ${duration}ms`, error);
      throw error;
    }
  }
}

// 创建全局实例
export const assistantsGuidelinesPreprocessor = new AssistantsGuidelinesPreprocessor();

export default AssistantsGuidelinesPreprocessor;
