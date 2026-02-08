/**
 * 动态角色卡组装器
 * 在每次对话时组装动态角色卡，整合个人画像、对话准则、好感度等信息
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import User from '../../models/User.js';
import ChatSession from '../../models/ChatSession.js';
import DualStorage from '../dualStorage.js';
import SentimentManager from '../langchain/sentimentManager.js';
import logger from '../../utils/logger.js';

/**
 * 动态角色卡组装器类
 * 负责组装对话所需的动态角色卡信息
 */
class DynamicRoleCardAssembler {
  constructor() {
    this.dualStorage = new DualStorage();
    this.sentimentManager = new SentimentManager();
  }

  /**
   * 组装动态角色卡
   * @param {Object} params - 组装参数
   * @param {string} params.targetUserId - 目标用户ID
   * @param {string} params.interlocutorUserId - 对话者用户ID
   * @param {string} params.sessionId - 对话会话ID
   * @param {string} [params.assistantId] - 协助者用户ID（可选）
   * @returns {Promise<Object>} 动态角色卡信息
   */
  async assembleDynamicRoleCard({ targetUserId, interlocutorUserId, sessionId, assistantId }) {
    try {
      logger.info(`[DynamicRoleCardAssembler] 开始组装动态角色卡 - Session: ${sessionId}, Interlocutor: ${interlocutorUserId}`);

      // 1. 加载目标用户信息和个人画像
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        throw new Error(`目标用户不存在: ${targetUserId}`);
      }

      if (!targetUser.companionChat?.roleCard) {
        throw new Error(`目标用户未生成角色卡: ${targetUserId}`);
      }

      const personaProfile = targetUser.companionChat.roleCard;

      // 2. 加载对话者信息
      const interlocutorUser = await User.findById(interlocutorUserId);
      if (!interlocutorUser) {
        throw new Error(`对话者用户不存在: ${interlocutorUserId}`);
      }

      // 3. 加载对话会话信息
      const session = await ChatSession.findOne({ sessionId });
      if (!session) {
        throw new Error(`对话会话不存在: ${sessionId}`);
      }

      logger.info(`[DynamicRoleCardAssembler] 会话信息 - Relation: ${session.relation}, Sentiment: ${session.sentimentScore}`);

      // 4. 加载协助者对话准则（如果有协助者）
      let conversationGuidelines = '';
      let sentimentGuidelines = '';

      if (assistantId) {
        const guidelines = await this.dualStorage.loadAssistantsGuidelines(targetUserId);
        const assistantGuideline = guidelines.find(g => g.assistantId.toString() === assistantId.toString());
        
        if (assistantGuideline) {
          conversationGuidelines = assistantGuideline.conversationGuidelines;
          logger.info(`[DynamicRoleCardAssembler] 加载协助者对话准则 - Assistant: ${assistantId}`);
        }
      }

      // 5. 生成陌生人对话准则（基于好感度）
      const sentiment = await this.sentimentManager.getStrangerSentiment(targetUserId, interlocutorUserId);
      sentimentGuidelines = await this.generateSentimentGuidelines(sentiment.currentScore);

      logger.info(`[DynamicRoleCardAssembler] 好感度信息 - Current: ${sentiment.currentScore}`);

      // 6. 构建System Prompt
      const systemPrompt = await this.buildSystemPrompt({
        personaProfile,
        conversationGuidelines,
        sentimentGuidelines,
        interlocutorName: interlocutorUser.name,
        relation: session.relation
      });

      logger.info(`[DynamicRoleCardAssembler] 动态角色卡组装完成`);

      return {
        targetUser: {
          _id: targetUser._id,
          name: targetUser.name
        },
        interlocutorUser: {
          _id: interlocutorUser._id,
          name: interlocutorUser.name
        },
        personaProfile: {
          personality: personaProfile.personality,
          background: personaProfile.background,
          interests: personaProfile.interests,
          communicationStyle: personaProfile.communicationStyle,
          values: personaProfile.values,
          emotionalNeeds: personaProfile.emotionalNeeds,
          lifeMilestones: personaProfile.lifeMilestones,
          preferences: personaProfile.preferences
        },
        conversationGuidelines,
        sentimentGuidelines,
        systemPrompt,
        session: {
          sessionId: session.sessionId,
          relation: session.relation,
          sentimentScore: session.sentimentScore,
          isActive: session.isActive
        },
        assembledAt: new Date()
      };
    } catch (error) {
      logger.error(`[DynamicRoleCardAssembler] 组装动态角色卡失败:`, error);
      throw error;
    }
  }

  /**
   * 构建System Prompt
   * @param {Object} params - Prompt构建参数
   * @param {Object} params.personaProfile - 个人画像
   * @param {string} params.conversationGuidelines - 对话准则
   * @param {string} params.sentimentGuidelines - 好感度准则
   * @param {string} params.interlocutorName - 对话者名称
   * @param {string} params.relation - 关系类型
   * @returns {Promise<string>} System Prompt
   */
  async buildSystemPrompt({ personaProfile, conversationGuidelines, sentimentGuidelines, interlocutorName, relation }) {
    try {
      const prompt = `你是一个AI助手，正在与${interlocutorName}（${relation}）进行对话。

${personaProfile ? `## 个人画像
- 性格特点：${personaProfile.personality || '未设定'}
- 生活背景：${personaProfile.background || '未设定'}
- 兴趣爱好：${personaProfile.interests?.join('、') || '未设定'}
- 沟通风格：${personaProfile.communicationStyle || '未设定'}
- 价值观：${personaProfile.values?.join('、') || '未设定'}
- 情感需求：${personaProfile.emotionalNeeds?.join('、') || '未设定'}
- 人生里程碑：${personaProfile.lifeMilestones?.join('、') || '未设定'}
- 个人喜好：${personaProfile.preferences?.join('、') || '未设定'}
` : ''}${conversationGuidelines ? `## 对话准则
${conversationGuidelines}
` : ''}${sentimentGuidelines ? `## 好感度提示
${sentimentGuidelines}
` : ''}

请以上述个人画像和对话准则为基础，自然地与${interlocutorName}进行对话。`;

      return prompt;
    } catch (error) {
      logger.error(`[DynamicRoleCardAssembler] 构建System Prompt失败:`, error);
      throw error;
    }
  }

  /**
   * 生成好感度准则
   * @param {number} sentimentScore - 好感度分数（0-100）
   * @returns {Promise<string>} 好感度准则
   */
  async generateSentimentGuidelines(sentimentScore) {
    try {
      let guidelines = '';

      if (sentimentScore > 70) {
        guidelines = '对方对你好感度很高，可以适当拉近关系，分享更多个人话题';
      } else if (sentimentScore >= 50) {
        guidelines = '对方对你有一定好感，保持礼貌和友好的对话风格';
      } else if (sentimentScore >= 30) {
        guidelines = '对方对你比较熟悉但关系一般，保持适度友好，不要过于亲密';
      } else {
        guidelines = '对方对你不太熟悉，需要保持适当距离，礼貌而客气';
      }

      logger.info(`[DynamicRoleCardAssembler] 生成好感度准则 - Score: ${sentimentScore}, Guidelines: ${guidelines}`);

      return guidelines;
    } catch (error) {
      logger.error(`[DynamicRoleCardAssembler] 生成好感度准则失败:`, error);
      throw error;
    }
  }
}

export default DynamicRoleCardAssembler;
