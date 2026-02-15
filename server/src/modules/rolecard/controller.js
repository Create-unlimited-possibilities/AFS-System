/**
 * 角色卡控制器 V2
 * 处理角色卡相关的API请求（使用新的分层角色卡系统）
 *
 * @author AFS Team
 * @version 2.0.0
 */

import {
  CoreLayerGenerator,
  RelationLayerGenerator,
  SafetyGuardrailsManager,
  CalibrationLayerManager
} from './v2/index.js';
import User from '../user/model.js';
import DualStorage from '../../core/storage/dual.js';
import logger from '../../core/utils/logger.js';
import VectorIndexService from '../../core/storage/vector.js';

class RoleCardController {
  constructor() {
    this.coreGenerator = new CoreLayerGenerator();
    this.relationGenerator = new RelationLayerGenerator();
    this.dualStorage = new DualStorage();
  }

  /**
   * 生成角色卡 V2
   */
  async generateRoleCard(req, res) {
    const userId = req.user.id;

    logger.info(`[RoleCardController] 开始生成V2角色卡 - User: ${userId}`);

    try {
      // 1. 生成核心层
      const coreLayer = await this.coreGenerator.generate(userId);

      // 2. 生成关系层
      const relationResults = await this.relationGenerator.generateAll(userId);

      // 3. 获取安全护栏
      const guardrails = SafetyGuardrailsManager.getGuardrails(userId);

      // 4. 创建校准层
      const calibration = CalibrationLayerManager.createInitialCalibrationLayer(coreLayer);

      // 5. 组装完整角色卡
      const roleCardV2 = {
        version: '2.0.0',
        userId,
        coreLayer,
        relationLayers: relationResults.success.reduce((acc, layer) => {
          acc[layer.relationId] = layer;
          return acc;
        }, {}),
        safetyGuardrails: guardrails,
        calibration,
        generatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 6. 保存到文件系统
      await this.dualStorage.saveRoleCardV2(userId, roleCardV2);

      // 7. 更新 MongoDB（兼容旧版）
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            'companionChat.roleCardV2': roleCardV2,
            'companionChat.roleCard': {
              personality: coreLayer.personalityTraits ?
                `边界意识:${coreLayer.personalityTraits.boundaryThickness}, 守密程度:${coreLayer.personalityTraits.discretionLevel}` : '',
              background: coreLayer.selfPerception?.coreValues?.join('、') || '',
              interests: coreLayer.communicationStyle?.preferredTopics || [],
              communicationStyle: coreLayer.communicationStyle?.tonePattern || '',
              values: coreLayer.selfPerception?.coreValues || [],
              emotionalNeeds: coreLayer.selfPerception?.lifePriorities || [],
              lifeMilestones: [],
              preferences: coreLayer.communicationStyle?.avoidedTopics || [],
              strangerInitialSentiment: 50,
              generatedAt: new Date(),
              updatedAt: new Date()
            }
          }
        }
      );

      logger.info(`[RoleCardController] V2角色卡生成成功 - User: ${userId}`);

      res.json({
        success: true,
        data: {
          roleCard: roleCardV2,
          relationStats: {
            success: relationResults.success.length,
            failed: relationResults.failed.length,
            failures: relationResults.failed
          }
        }
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

      // 优先加载 V2 角色卡
      const roleCardV2 = await this.dualStorage.loadRoleCardV2(userId);

      if (roleCardV2) {
        return res.json({
          success: true,
          roleCard: roleCardV2,
          version: '2.0.0'
        });
      }

      // 回退到旧版角色卡
      const user = await User.findById(userId);

      if (user?.companionChat?.roleCard) {
        const roleCard = user.companionChat.roleCard;
        return res.json({
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
          },
          version: '1.0.0'
        });
      }

      return res.status(404).json({
        success: false,
        error: '角色卡不存在'
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

      const roleCardV2 = await this.dualStorage.loadRoleCardV2(userId);

      if (!roleCardV2) {
        return res.status(404).json({
          success: false,
          error: '角色卡不存在'
        });
      }

      // 更新核心层字段
      if (updates.coreLayer) {
        Object.assign(roleCardV2.coreLayer, updates.coreLayer);
      }

      roleCardV2.updatedAt = new Date().toISOString();

      await this.dualStorage.saveRoleCardV2(userId, roleCardV2);

      logger.info(`[RoleCardController] 角色卡更新成功 - User: ${userId}`);

      res.json({
        success: true,
        roleCard: roleCardV2
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

      // 删除文件系统中的角色卡
      await this.dualStorage.saveRoleCardV2(userId, null);

      // 删除 MongoDB 中的角色卡
      await User.updateOne(
        { _id: userId },
        {
          $unset: {
            'companionChat.roleCard': '',
            'companionChat.roleCardV2': ''
          }
        }
      );

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
   * 重新生成指定协助者的关系层
   */
  async regenerateAssistantGuidelines(req, res) {
    try {
      const userId = req.user.id;
      const { assistantId } = req.params;

      logger.info(`[RoleCardController] 重新生成协助者关系层 - User: ${userId}, Assistant: ${assistantId}`);

      // 获取协助关系
      const AssistRelation = (await import('../assist-relation/model.js')).default;
      const relation = await AssistRelation.findOne({
        assistantId,
        targetId: userId,
        isActive: true
      });

      if (!relation) {
        return res.status(404).json({
          success: false,
          error: '协助关系不存在'
        });
      }

      // 重新生成关系层
      const relationLayer = await this.relationGenerator.generateOne({
        targetUserId: userId,
        assistantId,
        relationId: relation._id
      });

      // 更新角色卡
      const roleCardV2 = await this.dualStorage.loadRoleCardV2(userId);
      if (roleCardV2) {
        roleCardV2.relationLayers[relationLayer.relationId] = relationLayer;
        roleCardV2.updatedAt = new Date().toISOString();
        await this.dualStorage.saveRoleCardV2(userId, roleCardV2);
      }

      logger.info(`[RoleCardController] 协助者关系层更新成功 - User: ${userId}, Assistant: ${assistantId}`);

      res.json({
        success: true,
        message: '关系层已更新',
        relationLayer
      });

    } catch (error) {
      logger.error('[RoleCardController] 更新协助者关系层失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 构建向量索引（SSE进度反馈）
   */
  async buildVectorIndex(req, res) {
    const userId = req.user.id;

    logger.info(`[RoleCardController] 开始构建向量索引 - User: ${userId}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const progressCallback = (data) => {
      try {
        res.write(`event: progress\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        logger.error('[RoleCardController] SSE写入失败:', error);
      }
    };

    try {
      const FileStorage = (await import('../../core/storage/file.js')).default;
      const fileStorage = new FileStorage();

      const memories = await fileStorage.loadUserMemories(userId);

      if (memories.A_set.length === 0) {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ success: false, error: '请先完成至少一个A套问题' })}\n\n`);
        res.end();
        return;
      }

      const vectorService = new VectorIndexService();

      const exists = await vectorService.indexExists(userId);
      if (exists) {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ success: false, error: '记忆库已存在，无需重复构建' })}\n\n`);
        res.end();
        return;
      }

      const result = await vectorService.rebuildIndex(userId, progressCallback);

      logger.info(`[RoleCardController] 向量索引构建成功 - User: ${userId}`);

      res.write(`event: done\n`);
      res.write(`data: ${JSON.stringify({ success: true, ...result })}\n\n`);
    } catch (error) {
      logger.error('[RoleCardController] 构建向量索引失败:', error);

      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ success: false, error: error.message })}\n\n`);
    } finally {
      res.end();
    }
  }

  /**
   * 获取向量索引状态
   */
  async getVectorIndexStatus(req, res) {
    const userId = req.user.id;

    try {
      const vectorService = new VectorIndexService();
      const exists = await vectorService.indexExists(userId);

      const stats = exists ? await vectorService.getStats(userId) : null;

      const FileStorage = (await import('../../core/storage/file.js')).default;
      const fileStorage = new FileStorage();
      const memories = await fileStorage.loadUserMemories(userId);

      const memoryCount = memories.A_set.length + memories.Bste.length + memories.Cste.length;

      const roleCardV2 = await this.dualStorage.loadRoleCardV2(userId);
      const hasRoleCard = !!roleCardV2;
      const canBuild = memories.A_set.length > 0 && !exists;

      logger.info(`[RoleCardController] 向量索引状态 - User: ${userId}, hasRoleCard: ${hasRoleCard}, exists: ${exists}, canBuild: ${canBuild}`);

      res.json({
        success: true,
        status: {
          exists,
          memoryCount,
          hasRoleCard,
          canBuild,
          ...stats
        }
      });
    } catch (error) {
      logger.error('[RoleCardController] 获取索引状态失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new RoleCardController();
