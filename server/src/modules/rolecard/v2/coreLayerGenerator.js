// server/src/modules/rolecard/v2/coreLayerGenerator.js

import { buildCoreExtractionPrompt, CORE_LAYER_OUTPUT_SCHEMA } from './prompts/coreExtraction.js';
import Answer from '../../answer/model.js';
import MultiLLMClient from '../../../core/llm/multi.js';
import DualStorage from '../../../core/storage/dual.js';
import User from '../../user/model.js';
import logger from '../../../core/utils/logger.js';

/**
 * 核心层生成器
 * 从A套题答案中提取人格边界特征
 */
class CoreLayerGenerator {
  constructor() {
    this.llmClient = new MultiLLMClient();
    this.dualStorage = new DualStorage();
  }

  /**
   * 生成核心层
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 核心层数据
   */
  async generate(userId) {
    logger.info(`[CoreLayerGenerator] 开始生成核心层 - User: ${userId}`);

    try {
      // 1. 收集A套题答案
      const answers = await this.collectASetAnswers(userId);

      if (answers.length < 10) {
        throw new Error(`A套题答案不足 (需要至少10个，当前${answers.length}个)`);
      }

      logger.info(`[CoreLayerGenerator] 收集到 ${answers.length} 个A套题答案`);

      // 2. 构建 Prompt 并调用 LLM
      const prompt = buildCoreExtractionPrompt(answers);
      const llmResponse = await this.llmClient.generate(prompt, {
        temperature: 0.3,
        maxTokens: 2000,
        responseFormat: 'json'
      });

      // 3. 解析 LLM 响应
      const coreLayer = this.parseLLMResponse(llmResponse);

      // 4. 添加元数据
      coreLayer.version = '2.0.0';
      coreLayer.generatedAt = new Date().toISOString();
      coreLayer.sourceQuestionCount = answers.length;
      coreLayer.sourceQuestionIds = answers.map(a => a._id.toString());

      logger.info(`[CoreLayerGenerator] 核心层生成完成`);

      return coreLayer;

    } catch (error) {
      logger.error(`[CoreLayerGenerator] 生成失败:`, error);
      throw error;
    }
  }

  /**
   * 收集A套题答案
   */
  async collectASetAnswers(userId) {
    const answers = await Answer.find({
      userId,
      questionRole: 'A',
      isSelfAnswer: true
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

  /**
   * 解析 LLM 响应
   */
  parseLLMResponse(response) {
    try {
      let parsed;

      if (typeof response === 'string') {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('无法从响应中提取 JSON');
        }
      } else {
        parsed = response;
      }

      this.validateCoreLayer(parsed);
      return parsed;

    } catch (error) {
      logger.error(`[CoreLayerGenerator] 解析LLM响应失败:`, error);
      throw new Error(`核心层解析失败: ${error.message}`);
    }
  }

  /**
   * 验证核心层结构
   */
  validateCoreLayer(coreLayer) {
    const requiredPaths = [
      'personalityTraits.boundaryThickness',
      'personalityTraits.discretionLevel',
      'personalityTraits.impulsiveSpeech',
      'personalityTraits.emotionalExpression',
      'personalityTraits.socialCautiousness',
      'communicationStyle.tonePattern',
      'selfPerception.selfDescriptionKeywords'
    ];

    for (const path of requiredPaths) {
      const parts = path.split('.');
      let obj = coreLayer;

      for (const part of parts) {
        if (!obj || !obj[part]) {
          throw new Error(`缺少必要字段: ${path}`);
        }
        obj = obj[part];
      }
    }

    const validValues = {
      boundaryThickness: ['thick', 'medium', 'thin'],
      discretionLevel: ['excellent', 'good', 'moderate', 'poor'],
      impulsiveSpeech: ['rare', 'occasional', 'often', 'frequent'],
      emotionalExpression: ['reserved', 'moderate', 'expressive'],
      socialCautiousness: ['high', 'moderate', 'low'],
      humorStyle: ['none', 'light', 'moderate', 'heavy'],
      verbosity: ['concise', 'moderate', 'elaborate']
    };

    for (const [key, valid] of Object.entries(validValues)) {
      const value = coreLayer.personalityTraits[key] || coreLayer.communicationStyle?.[key];
      if (value && !valid.includes(value)) {
        logger.warn(`[CoreLayerGenerator] 无效的枚举值 ${key}=${value}`);
      }
    }
  }
}

export default CoreLayerGenerator;
