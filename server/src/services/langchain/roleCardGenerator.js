/**
 * 角色卡生成器
 * 基于用户 A 套题答案，使用 LLM 生成个人画像，并保存到双重存储系统
 *
 * @author AFS Team
 * @version 2.0.0
 */

import Answer from '../../models/Answer.js';
import Question from '../../models/Question.js';
import User from '../../models/User.js';
import { multiLLMClient } from './multiLLMClient.js';
import DualStorage from '../dualStorage.js';
import logger from '../../utils/logger.js';
import { countTokens } from '../../utils/tokenCounter.js';

/**
 * 角色卡生成器类
 * 负责从用户A套题答案生成个人画像并保存
 */
class RoleCardGenerator {
  constructor() {
    this.dualStorage = new DualStorage();
    this.tokenCache = new Map();
    this.minProgress = 0.8; // 80% 完成度
    this.sentimentKeywords = {
      positive: ['开朗', '外向', '热情', '活泼', '友好', '温和', '乐观'],
      negative: ['内向', '安静', '严肃', '严厉', '冷漠']
    };
  }

  /**
   * 检查用户 A 套题进度
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 进度信息
   */
  async checkASetProgress(userId) {
    try {
      logger.info(`[RoleCardGenerator] 检查用户 ${userId} 的 A 套题进度`);

      const progress = await Answer.getProgress(userId, userId, 'basic');
      
      logger.info(`[RoleCardGenerator] A 套题进度: ${progress.percentage}% (${progress.answered}/${progress.total})`);

      return {
        total: progress.total,
        answered: progress.answered,
        percentage: progress.percentage,
        canGenerate: progress.percentage >= (this.minProgress * 100)
      };
    } catch (error) {
      logger.error(`[RoleCardGenerator] 检查 A 套题进度失败:`, error);
      throw new Error(`检查 A 套题进度失败: ${error.message}`);
    }
  }

  /**
   * 收集用户的 A 套题答案
   * @param {string} userId - 用户ID
   * @returns {Promise<Array>} 答案数组（按问题顺序排序）
   */
  async collectASetAnswers(userId) {
    try {
      logger.info(`[RoleCardGenerator] 收集用户 ${userId} 的 A 套题答案`);

      // 查询所有A套题答案（用户回答自己的问题）
      const answers = await Answer.find({
        userId: userId,
        targetUserId: userId,
        questionLayer: 'basic',
        isSelfAnswer: true
      }).sort({ questionId: 1 });

      if (answers.length === 0) {
        throw new Error('未找到 A 套题答案');
      }

      // 填充问题信息
      const enrichedAnswers = [];
      for (const answer of answers) {
        const question = await Question.findById(answer.questionId);
        if (question) {
          enrichedAnswers.push({
            questionId: question._id,
            question: question.question,
            questionOrder: question.order,
            answer: answer.answer,
            questionLayer: answer.questionLayer
          });
        }
      }

      // 按问题顺序排序
      enrichedAnswers.sort((a, b) => a.questionOrder - b.questionOrder);

      logger.info(`[RoleCardGenerator] 成功收集 ${enrichedAnswers.length} 个 A 套题答案`);

      return enrichedAnswers;
    } catch (error) {
      logger.error(`[RoleCardGenerator] 收集 A 套题答案失败:`, error);
      throw new Error(`收集 A 套题答案失败: ${error.message}`);
    }
  }

  /**
   * 计算文本的 token 数量
   * @param {string} text - 文本内容
   * @returns {number} token 数量
   */
  calculateTokenCount(text) {
    if (!text) return 0;
    const cacheKey = text.substring(0, 50); // 使用前50个字符作为缓存键
    if (this.tokenCache.has(cacheKey)) {
      return this.tokenCache.get(cacheKey);
    }

    // 使用 tiktoken 计算
    const tokenCount = countTokens(text);

    // 缓存结果
    this.tokenCache.set(cacheKey, tokenCount);

    return tokenCount;
  }

  /**
   * 计算所有答案的总 token 数量
   * @param {Array} answers - 答案数组
   * @returns {number} 总 token 数量
   */
  calculateTotalTokenCount(answers) {
    let total = 0;
    for (const answer of answers) {
      total += this.calculateTokenCount(answer.question);
      total += this.calculateTokenCount(answer.answer);
    }
    return total;
  }

  /**
   * 计算陌生人初始好感度
   * @param {string} personality - 性格特点
   * @returns {number} 初始好感度 (0-100)
   */
  calculateStrangerInitialSentiment(personality) {
    let sentiment = 50; // 默认值

    // 检查正面关键词
    for (const keyword of this.sentimentKeywords.positive) {
      if (personality && personality.includes(keyword)) {
        sentiment += 10;
        break;
      }
    }

    // 检查负面关键词
    for (const keyword of this.sentimentKeywords.negative) {
      if (personality && personality.includes(keyword)) {
        sentiment -= 5;
        break;
      }
    }

    // 限制范围
    sentiment = Math.max(0, Math.min(100, sentiment));

    logger.info(`[RoleCardGenerator] 计算陌生人初始好感度: ${sentiment}`);

    return sentiment;
  }

  /**
   * 生成个人画像（角色卡）
   * @param {string} userId - 用户ID
   * @param {Array} answers - 答案数组
   * @returns {Promise<Object>} 角色卡对象
   */
  async generatePersonalProfile(userId, answers) {
    try {
      logger.info(`[RoleCardGenerator] 为用户 ${userId} 生成个人画像`);

      // 构建问答摘要
      const qaSummary = answers.map((a, index) => {
        return `Q${index + 1}. ${a.question}\nA${index + 1}. ${a.answer}`;
      }).join('\n\n');

      // 构建提示词
      const prompt = `请根据以下用户的自我介绍和回答，生成一个详细的个人画像（角色卡）。

用户问答：
${qaSummary}

请生成一个JSON格式的个人画像，包含以下8个维度：
1. personality（性格特点）：3-5个关键词
2. background（生活背景）：简要描述用户的成长经历、教育背景等
3. interests（兴趣爱好）：3-5个兴趣爱好
4. communicationStyle（沟通风格）：描述用户的沟通方式和习惯
5. values（价值观）：3-5个核心价值观
6. emotionalNeeds（情感需求）：3-5个情感需求
7. lifeMilestones（人生里程碑）：3-5个重要的人生经历
8. preferences（偏好）：3-5个个人偏好

请确保所有字段都有值，使用简洁明了的语言。只返回JSON，不要有其他内容。`;

      // 调用 LLM
      const llmResponse = await multiLLMClient.generate(prompt, {
        temperature: 0.7,
        maxTokens: 1500
      });

      logger.info(`[RoleCardGenerator] LLM 响应: ${llmResponse.substring(0, 100)}...`);

      // 解析 JSON 响应
      let profile;
      try {
        // 提取 JSON（可能包含在代码块中）
        const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          profile = JSON.parse(jsonMatch[0]);
        } else {
          profile = JSON.parse(llmResponse);
        }
      } catch (parseError) {
        logger.error(`[RoleCardGenerator] 解析 LLM 响应失败:`, parseError);
        throw new Error('解析 LLM 响应失败');
      }

      // 验证必需字段
      const requiredFields = [
        'personality', 'background', 'interests', 'communicationStyle',
        'values', 'emotionalNeeds', 'lifeMilestones', 'preferences'
      ];

      const missingFields = requiredFields.filter(field => !profile[field]);
      if (missingFields.length > 0) {
        logger.warn(`[RoleCardGenerator] 缺少字段: ${missingFields.join(', ')}`);
        missingFields.forEach(field => {
          profile[field] = this.getDefaultValueForField(field);
        });
      }

      // 确保数组字段是数组
      const arrayFields = ['interests', 'values', 'emotionalNeeds', 'lifeMilestones', 'preferences'];
      arrayFields.forEach(field => {
        if (!Array.isArray(profile[field])) {
          profile[field] = [profile[field]].filter(Boolean);
        }
      });

      // 计算陌生人初始好感度
      const strangerInitialSentiment = this.calculateStrangerInitialSentiment(profile.personality);

      // 构建完整的角色卡
      const roleCard = {
        personality: profile.personality,
        background: profile.background,
        interests: profile.interests,
        communicationStyle: profile.communicationStyle,
        values: profile.values,
        emotionalNeeds: profile.emotionalNeeds,
        lifeMilestones: profile.lifeMilestones,
        preferences: profile.preferences,
        memories: [],
        strangerInitialSentiment: strangerInitialSentiment,
        generatedAt: new Date(),
        updatedAt: new Date(),
        memoryTokenCount: this.calculateTotalTokenCount(answers)
      };

      logger.info(`[RoleCardGenerator] 个人画像生成成功`);

      return roleCard;
    } catch (error) {
      logger.error(`[RoleCardGenerator] 生成个人画像失败:`, error);
      throw new Error(`生成个人画像失败: ${error.message}`);
    }
  }

  /**
   * 获取字段的默认值
   * @param {string} field - 字段名
   * @returns {*} 默认值
   */
  getDefaultValueForField(field) {
    const defaults = {
      personality: '温和友善',
      background: '普通的生活经历',
      interests: ['阅读', '旅行', '音乐'],
      communicationStyle: '友好且耐心',
      values: ['诚实', '尊重', '友善'],
      emotionalNeeds: ['被理解', '被关心', '陪伴'],
      lifeMilestones: ['成长经历', '学习经历', '工作经历'],
      preferences: ['安静的环境', '简单的生活', '和谐的关系']
    };

    return defaults[field] || '';
  }

  /**
   * 保存角色卡到双重存储
   * @param {string} userId - 用户ID
   * @param {Object} roleCard - 角色卡对象
   * @returns {Promise<Object>} 保存结果
   */
  async saveToDualStorage(userId, roleCard) {
    try {
      logger.info(`[RoleCardGenerator] 保存角色卡到双重存储，用户: ${userId}`);

      // 1. 保存到文件系统
      const fileResult = await this.dualStorage.saveRoleCard(userId, roleCard);
      logger.info(`[RoleCardGenerator] 文件系统保存成功: ${fileResult.filePath}`);

      // 2. 计算对话模式（基于 token 数量）
      const tokenCount = roleCard.memoryTokenCount || 0;
      let currentMode = 'mode1';
      if (tokenCount > 5000) {
        currentMode = 'mode3';
      } else if (tokenCount > 2000) {
        currentMode = 'mode2';
      }

      logger.info(`[RoleCardGenerator] Token 数量: ${tokenCount}, 对话模式: ${currentMode}`);

      // 3. 更新 MongoDB
      const updateResult = await User.updateOne(
        { _id: userId },
        {
          $set: {
            'companionChat.roleCard': roleCard,
            'companionChat.currentMode': currentMode,
            'companionChat.modelStatus.hasBaseModel': true
          }
        }
      );

      if (updateResult.matchedCount === 0) {
        throw new Error('用户不存在');
      }

      logger.info(`[RoleCardGenerator] MongoDB 更新成功，匹配 ${updateResult.matchedCount} 个文档`);

      // 4. 验证数据一致性
      const loadedFromFS = await this.dualStorage.loadRoleCard(userId);
      if (!loadedFromFS) {
        throw new Error('文件系统验证失败');
      }

      const user = await User.findById(userId);
      if (!user || !user.companionChat.roleCard) {
        throw new Error('MongoDB 验证失败');
      }

      logger.info(`[RoleCardGenerator] 数据一致性验证通过`);

      return {
        success: true,
        fileResult,
        mongoResult: updateResult,
        currentMode
      };
    } catch (error) {
      logger.error(`[RoleCardGenerator] 保存角色卡到双重存储失败:`, error);

      // 尝试回滚（如果文件系统已经保存）
      try {
        await this.dualStorage.initialize();
        const filePath = `/app/storage/userdata/${userId}/rolecard.json`;
        await fs.unlink(filePath);
        logger.info(`[RoleCardGenerator] 已回滚文件系统删除`);
      } catch (rollbackError) {
        logger.warn(`[RoleCardGenerator] 回滚文件系统失败:`, rollbackError);
      }

      throw new Error(`保存角色卡失败: ${error.message}`);
    }
  }

  /**
   * 生成角色卡（主方法）
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 生成结果
   */
  async generateRoleCard(userId) {
    const startTime = Date.now();

    try {
      logger.info(`[RoleCardGenerator] 开始为用户 ${userId} 生成角色卡`);

      // 1. 检查 A 套题进度
      const progress = await this.checkASetProgress(userId);
      if (!progress.canGenerate) {
        throw new Error(`A 套题进度不足（${progress.percentage}%），需要至少 ${this.minProgress * 100}%`);
      }

      // 2. 收集 A 套题答案
      const answers = await this.collectASetAnswers(userId);

      // 3. 生成个人画像
      const roleCard = await this.generatePersonalProfile(userId, answers);

      // 4. 保存到双重存储
      const saveResult = await this.saveToDualStorage(userId, roleCard);

      const duration = Date.now() - startTime;
      logger.info(`[RoleCardGenerator] 角色卡生成完成，耗时: ${duration}ms`);

      return {
        success: true,
        userId,
        roleCard,
        progress,
        currentMode: saveResult.currentMode,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`[RoleCardGenerator] 角色卡生成失败，耗时: ${duration}ms`, error);
      throw error;
    }
  }
}

// 创建全局实例
export const roleCardGenerator = new RoleCardGenerator();

export default RoleCardGenerator;