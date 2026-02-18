// server/src/modules/rolecard/v2/coreLayerGenerator.js

import {
  CORE_LAYER_FIELDS,
  buildPerAnswerExtractionPrompt,
  buildFieldCompressionPrompt
} from './prompts/coreExtractionV2.js';
import Answer from '../../qa/models/answer.js';
import Question from '../../qa/models/question.js';
import MultiLLMClient from '../../../core/llm/multi.js';
import { llmConfig } from '../../../core/llm/config.js';
import DualStorage from '../../../core/storage/dual.js';
import User from '../../user/model.js';
import { profileLogger } from '../../../core/utils/logger.js';

/**
 * A 套题完成度检查
 * @param {string} userId - 用户ID
 * @returns {Promise<{isComplete: boolean, total: number, answered: number, basic: object, emotional: object}>}
 */
async function validateASetCompletion(userId) {
  // A 套题 = basic + emotional 层的问题
  const basicTotal = await Question.countDocuments({ role: 'elder', layer: 'basic', active: true });
  const emotionalTotal = await Question.countDocuments({ role: 'elder', layer: 'emotional', active: true });

  const basicAnswered = await Answer.countDocuments({
    userId,
    targetUserId: userId,
    questionLayer: 'basic',
    isSelfAnswer: true
  });

  const emotionalAnswered = await Answer.countDocuments({
    userId,
    targetUserId: userId,
    questionLayer: 'emotional',
    isSelfAnswer: true
  });

  const total = basicTotal + emotionalTotal;
  const answered = basicAnswered + emotionalAnswered;
  const isComplete = answered >= total && total > 0;

  return {
    isComplete,
    total,
    answered,
    basic: { total: basicTotal, answered: basicAnswered },
    emotional: { total: emotionalTotal, answered: emotionalAnswered }
  };
}

/**
 * 核心层生成器 V2
 * 采用逐条提取 + 逐字段压缩的方式
 */
class CoreLayerGenerator {
  constructor() {
    this.llmClient = new MultiLLMClient();
    this.dualStorage = new DualStorage();
    // 用于收集每个字段的片段
    this.fieldFragments = {};
    // 初始化字段片段容器
    Object.keys(CORE_LAYER_FIELDS).forEach(key => {
      if (CORE_LAYER_FIELDS[key].source === 'llm') {
        this.fieldFragments[key] = [];
      }
    });
  }

  /**
   * 生成核心层
   * @param {string} userId - 用户ID
   * @param {Function} onProgress - 进度回调函数 (progress) => {}
   * @returns {Promise<Object>} 核心层数据
   */
  async generate(userId, onProgress = null) {
    profileLogger.info('开始生成核心层', { userId });

    try {
      // 1. 获取用户个人档案（用于 basicIdentity）
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 2. 验证 A 套题是否全部完成
      const completion = await validateASetCompletion(userId);
      if (!completion.isComplete) {
        throw new Error(
          `A套题未全部完成 (已完成 ${completion.answered}/${completion.total}，` +
          `basic: ${completion.basic.answered}/${completion.basic.total}，` +
          `emotional: ${completion.emotional.answered}/${completion.emotional.total})`
        );
      }

      profileLogger.info(`A套题验证通过`, { userId, completion });

      // 3. 收集 A 套题答案及问题信息
      const answersWithQuestions = await this.collectASetAnswers(userId);

      profileLogger.info(`收集到 ${answersWithQuestions.length} 个A套题答案`, { userId });

      // 4. 逐条处理答案（串行）
      for (let i = 0; i < answersWithQuestions.length; i++) {
        const item = answersWithQuestions[i];
        profileLogger.info(`处理答案 ${i + 1}/${answersWithQuestions.length}`, {
          userId,
          questionId: item.questionId
        });

        // 发送进度
        if (onProgress) {
          onProgress({
            stage: 'extraction',
            current: i + 1,
            total: answersWithQuestions.length,
            message: `提取答案 ${i + 1}/${answersWithQuestions.length}`
          });
        }

        await this.processOneAnswer(item);
      }

      // 5. 逐字段压缩
      const fieldsToCompress = Object.keys(this.fieldFragments).filter(
        key => this.fieldFragments[key].length > 0
      );

      if (onProgress) {
        onProgress({
          stage: 'compression_start',
          current: 0,
          total: fieldsToCompress.length,
          message: '开始字段压缩'
        });
      }

      const compressedFields = await this.compressAllFields((fieldIndex, fieldName) => {
        if (onProgress) {
          onProgress({
            stage: 'compression',
            current: fieldIndex + 1,
            total: fieldsToCompress.length,
            message: `压缩字段: ${fieldName}`
          });
        }
      });

      // 6. 构建 basicIdentity（从个人档案）
      const basicIdentity = this.buildBasicIdentity(user);

      // 7. 组装最终核心层
      const coreLayer = {
        version: '2.1.0',
        generatedAt: new Date().toISOString(),
        userId,

        // 基础身份（来自个人档案）
        basicIdentity,

        // LLM 提取的字段
        ...compressedFields,

        // 元数据
        metadata: {
          sourceAnswerCount: answersWithQuestions.length,
          sourceQuestionIds: answersWithQuestions.map(a => a.questionId),
          extractionModel: llmConfig.getConfig().ollamaModel,
          compressionModel: llmConfig.getConfig().ollamaModel
        }
      };

      // 8. 双重存储
      await this.dualStorage.saveCoreLayer(userId, coreLayer);

      profileLogger.info('核心层生成完成', { userId });

      return coreLayer;

    } catch (error) {
      profileLogger.error('核心层生成失败', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * 收集 A 套题答案
   */
  async collectASetAnswers(userId) {
    // A套题 = 用户回答自己的问题 (isSelfAnswer: true)
    const answers = await Answer.find({
      userId,
      targetUserId: userId,  // 自己回答自己
      isSelfAnswer: true
    })
    .populate('questionId')
    .sort({ createdAt: 1 });

    return answers
      .filter(a => a.questionId)  // 确保问题存在
      .map(a => ({
        answerId: a._id,
        questionId: a.questionId._id,
        questionText: a.questionId.question,
        questionLayer: a.questionId.layer,
        significance: a.questionId.significance,
        answerText: a.answer
      }));
  }

  /**
   * 处理单条答案
   */
  async processOneAnswer(item) {
    try {
      const prompt = buildPerAnswerExtractionPrompt(
        item.questionText,
        item.answerText,
        item.significance
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
      profileLogger.error('处理单条答案失败', {
        questionId: item.questionId,
        error: error.message
      });
      // 继续处理其他答案，不中断流程
    }
  }

  /**
   * 压缩所有字段
   * @param {Function} onFieldProgress - 字段进度回调 (fieldIndex, fieldName) => {}
   */
  async compressAllFields(onFieldProgress = null) {
    const compressedFields = {};
    const fieldEntries = Object.entries(this.fieldFragments);

    for (let i = 0; i < fieldEntries.length; i++) {
      const [fieldName, fragments] = fieldEntries[i];

      // 调用进度回调
      if (onFieldProgress) {
        onFieldProgress(i, fieldName);
      }

      if (fragments.length === 0) {
        compressedFields[fieldName] = {
          raw: null,
          summary: null,
          sourceCount: 0
        };
        continue;
      }

      profileLogger.info(`压缩字段: ${fieldName}`, { fragmentCount: fragments.length });

      try {
        const fragmentTexts = fragments.map(f => f.content);
        const prompt = buildFieldCompressionPrompt(fieldName, fragmentTexts);

        const compressed = await this.callLLMWithRetry(prompt, {
          temperature: 0.3,
          maxTokens: CORE_LAYER_FIELDS[fieldName].tokenTarget + 100,
          responseFormat: 'json'
        });

        compressedFields[fieldName] = {
          // 结构化数据（如果压缩结果包含 keyPoints）
          keyPoints: compressed?.keyPoints || [],
          // 压缩后的自然语言摘要
          summary: compressed?.compressed || null,
          // 原始片段数量
          sourceCount: fragments.length,
          // 来源问题ID
          sourceQuestionIds: fragments.map(f => f.sourceQuestionId)
        };

      } catch (error) {
        profileLogger.error(`压缩字段失败: ${fieldName}`, { error: error.message });
        // 失败时使用原始片段拼接
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
   * 构建基础身份信息（从个人档案）
   */
  buildBasicIdentity(user) {
    const profile = user.profile || {};

    // 计算年龄
    let age = null;
    if (profile.birthDate) {
      const birthDate = new Date(profile.birthDate);
      const today = new Date();
      age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
    }

    return {
      // 原始数据
      raw: {
        name: user.name,
        gender: profile.gender,
        birthDate: profile.birthDate,
        birthHour: profile.birthHour,
        age,
        birthPlace: profile.birthPlace,
        residence: profile.residence,
        nationality: profile.nationality,
        ethnicity: profile.ethnicity,
        occupation: profile.occupation,
        education: profile.education,
        maritalStatus: profile.maritalStatus,
        children: profile.children,
        height: profile.height,
        appearanceFeatures: profile.appearanceFeatures
      },
      // 自然语言摘要
      summary: this.generateBasicIdentitySummary(user.name, profile, age)
    };
  }

  /**
   * 生成基础身份摘要
   */
  generateBasicIdentitySummary(name, profile, age) {
    const parts = [];

    if (profile.gender) parts.push(profile.gender);
    if (age !== null) parts.push(`${age}岁`);
    if (profile.occupation) parts.push(profile.occupation);
    if (profile.residence?.cityName) parts.push(`现居${profile.residence.cityName}`);
    if (profile.maritalStatus) parts.push(profile.maritalStatus);
    if (profile.children && (profile.children.sons > 0 || profile.children.daughters > 0)) {
      const childParts = [];
      if (profile.children.sons > 0) childParts.push(`${profile.children.sons}子`);
      if (profile.children.daughters > 0) childParts.push(`${profile.children.daughters}女`);
      parts.push(`育有${childParts.join('')}`);
    }

    if (parts.length > 0) {
      return `${name}，${parts.join('，')}。`;
    }
    return name;
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
        // 尝试提取 JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      return null;
    } catch (error) {
      profileLogger.error('解析 JSON 响应失败', { error: error.message, response: response?.substring(0, 200) });
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
   * 重置状态（用于多次生成）
   */
  reset() {
    Object.keys(CORE_LAYER_FIELDS).forEach(key => {
      if (CORE_LAYER_FIELDS[key].source === 'llm') {
        this.fieldFragments[key] = [];
      }
    });
  }
}

export default CoreLayerGenerator;
export { validateASetCompletion };
