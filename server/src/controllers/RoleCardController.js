/**
 * 角色卡控制器
 * 处理角色卡相关的API请求
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import RoleCardGenerator from '../services/langchain/roleCardGenerator.js';
import AssistantsGuidelinesPreprocessor from '../services/langchain/assistantsGuidelinesPreprocessor.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

const roleCardGenerator = new RoleCardGenerator();
const guidelinesPreprocessor = new AssistantsGuidelinesPreprocessor();

class RoleCardController {
  /**
   * 生成角色卡
   */
  async generateRoleCard(req, res) {
    try {
      const userId = req.user.id;

      logger.info(`[RoleCardController] 开始生成角色卡 - User: ${userId}`);

      const result = await roleCardGenerator.generateRoleCard(userId);

      logger.info(`[RoleCardController] 角色卡生成成功 - User: ${userId}`);

      res.json({
        success: true,
        roleCard: result.roleCard,
        tokenCount: result.tokenCount,
        assistantsProcessed: result.assistantsProcessed,
        processingTime: result.processingTime
      });
    } catch (error) {
      logger.error('[RoleCardController] 生成角色卡失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取角色卡
   */
  async getRoleCard(req, res) {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user || !user.companionChat?.roleCard) {
        return res.status(404).json({
          success: false,
          error: '角色卡不存在'
        });
      }

      const roleCard = user.companionChat.roleCard;

      res.json({
        success: true,
        roleCard: {
          personality: roleCard.personality,
          background: roleCard.background,
          interests: roleCard.interests,
          communicationStyle: roleCard.communicationStyle,
          values: roleCard.values,
          emotionalNeeds: roleCard.emotionalNeeds,
          lifeMilestones: roleCard.lifeMilestones,
          preferences: roleCard.preferences,
          strangerInitialSentiment: roleCard.strangerInitialSentiment,
          generatedAt: roleCard.generatedAt,
          updatedAt: roleCard.updatedAt
        }
      });
    } catch (error) {
      logger.error('[RoleCardController] 获取角色卡失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 更新角色卡
   */
  async updateRoleCard(req, res) {
    try {
      const userId = req.user.id;
      const updates = req.body;

      const user = await User.findById(userId);
      if (!user || !user.companionChat?.roleCard) {
        return res.status(404).json({
          success: false,
          error: '角色卡不存在'
        });
      }

      Object.keys(updates).forEach(key => {
        if (key !== '_id' && key !== 'generatedAt') {
          user.companionChat.roleCard[key] = updates[key];
        }
      });

      user.companionChat.roleCard.updatedAt = new Date();
      await user.save();

      logger.info(`[RoleCardController] 角色卡更新成功 - User: ${userId}`);

      res.json({
        success: true,
        roleCard: user.companionChat.roleCard
      });
    } catch (error) {
      logger.error('[RoleCardController] 更新角色卡失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 删除角色卡
   */
  async deleteRoleCard(req, res) {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user || !user.companionChat?.roleCard) {
        return res.status(404).json({
          success: false,
          error: '角色卡不存在'
        });
      }

      user.companionChat.roleCard = undefined;
      await user.save();

      logger.info(`[RoleCardController] 角色卡删除成功 - User: ${userId}`);

      res.json({
        success: true,
        message: '角色卡已删除'
      });
    } catch (error) {
      logger.error('[RoleCardController] 删除角色卡失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 增量更新：重新生成指定协助者的对话准则
   */
  async regenerateAssistantGuidelines(req, res) {
    try {
      const userId = req.user.id;
      const { assistantId } = req.params;

      logger.info(`[RoleCardController] 重新生成协助者对话准则 - User: ${userId}, Assistant: ${assistantId}`);

      await guidelinesPreprocessor.updateOneAssistant(userId, assistantId);

      logger.info(`[RoleCardController] 协助者对话准则更新成功 - User: ${userId}, Assistant: ${assistantId}`);

      res.json({
        success: true,
        message: '对话准则已更新'
      });
    } catch (error) {
      logger.error('[RoleCardController] 更新协助者对话准则失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new RoleCardController();
