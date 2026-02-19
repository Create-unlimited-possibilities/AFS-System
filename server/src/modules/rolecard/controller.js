/**
 * 角色卡控制器 V2
 * 处理角色卡相关的API请求（使用新的分层角色卡系统）
 *
 * @author AFS Team
 * @version 2.0.0
 */

import {
  CoreLayerGenerator,
  RelationLayerGenerator
} from './v2/index.js';
// 导入实例（default export）而非类
import SafetyGuardrailsManager from './v2/safetyGuardrails.js';
import CalibrationLayerManager from './v2/calibrationLayer.js';
import User from '../user/model.js';
import AssistRelation from '../assist/model.js';
import Answer from '../qa/models/answer.js';
import DualStorage from '../../core/storage/dual.js';
import logger from '../../core/utils/logger.js';
import VectorIndexService from '../../core/storage/vector.js';
import MemoryExtractor from '../memory/MemoryExtractor.js';
import MemoryStore from '../memory/MemoryStore.js';

class RoleCardController {
  constructor() {
    this.coreGenerator = new CoreLayerGenerator();
    this.relationGenerator = new RelationLayerGenerator();
    this.dualStorage = new DualStorage();
    this.memoryExtractor = new MemoryExtractor();
    this.memoryStore = new MemoryStore();
  }

  /**
   * Process pending memories in background (non-blocking)
   * @param {string} userId - User ID
   * @param {Object} roleCard - Generated role card
   */
  processPendingMemoriesBackground(userId, roleCard) {
    // Run in background without blocking the response
    setImmediate(async () => {
      try {
        logger.info(`[RoleCardController] Starting background pending memory processing for user ${userId}`);

        const results = await this.memoryExtractor.processPendingMemories(
          userId,
          roleCard,
          this.memoryStore
        );

        logger.info(`[RoleCardController] Background memory processing completed`, {
          userId,
          processed: results.processed,
          failed: results.failed,
          total: results.total
        });
      } catch (error) {
        // Log error but don't affect the main response
        logger.error(`[RoleCardController] Background memory processing failed`, {
          userId,
          error: error.message
        });
      }
    });
  }

  /**
   * 生成角色卡 V2
   */
  async generateRoleCard(req, res) {
    const userId = req.user.id;

    logger.info(`[RoleCardController] ========== 开始生成V2角色卡 ==========`);
    logger.info(`[RoleCardController] User: ${userId}`);

    try {
      // 1. 生成核心层
      logger.info(`[RoleCardController] 步骤 1/7: 生成核心层 (从A套问答提取人格特质)`);
      const coreLayer = await this.coreGenerator.generate(userId);
      logger.info(`[RoleCardController] ✓ 核心层生成完成`);

      // 2. 生成关系层
      logger.info(`[RoleCardController] 步骤 2/7: 生成关系层 (从B/C套问答提取关系信息)`);
      const relationResults = await this.relationGenerator.generateAll(userId);
      logger.info(`[RoleCardController] ✓ 关系层生成完成 - 成功: ${relationResults.success.length}, 跳过: ${relationResults.skipped.length}, 失败: ${relationResults.failed.length}`);
      if (relationResults.skipped.length > 0) {
        logger.info(`[RoleCardController] 跳过的关系层: ${JSON.stringify(relationResults.skipped)}`);
      }
      if (relationResults.failed.length > 0) {
        logger.warn(`[RoleCardController] 关系层失败详情: ${JSON.stringify(relationResults.failed)}`);
      }

      // 3. 获取安全护栏
      logger.info(`[RoleCardController] 步骤 3/7: 获取安全护栏规则`);
      const guardrails = await SafetyGuardrailsManager.getGuardrails(userId);
      logger.info(`[RoleCardController] ✓ 安全护栏规则获取完成 - 规则数: ${guardrails.rules.length}`);

      // 4. 创建校准层
      logger.info(`[RoleCardController] 步骤 4/7: 创建校准层`);
      const calibration = CalibrationLayerManager.createInitialCalibrationLayer(coreLayer);
      logger.info(`[RoleCardController] ✓ 校准层创建完成`);

      // 5. 组装完整角色卡
      logger.info(`[RoleCardController] 步骤 5/7: 组装完整角色卡`);
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
      logger.info(`[RoleCardController] ✓ 角色卡组装完成`);

      // 6. 保存到文件系统（分层独立存储）
      logger.info(`[RoleCardController] 步骤 6/7: 保存到文件系统`);
      // 6.1 保存核心层
      await this.dualStorage.saveCoreLayer(userId, coreLayer);
      // 6.2 保存关系层（每个协助者独立文件）
      for (const layer of relationResults.success) {
        await this.dualStorage.saveRelationLayer(userId, layer.relationId, layer);
      }
      // 6.3 保存完整角色卡（作为备份/兼容）
      await this.dualStorage.saveRoleCardV2(userId, roleCardV2);
      logger.info(`[RoleCardController] ✓ 文件系统保存完成 - 核心层 + ${relationResults.success.length}个关系层`);

      // 7. 更新 MongoDB（兼容旧版）
      logger.info(`[RoleCardController] 步骤 7/7: 同步更新 MongoDB`);
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            'companionChat.roleCardV2': roleCardV2,
            'companionChat.roleCard': {
              // V2 字段映射
              personality: coreLayer.personality?.summary || '',
              background: coreLayer.backgroundStory?.summary || coreLayer.selfPerception?.summary || '',
              interests: coreLayer.interests?.keyPoints || [],
              communicationStyle: coreLayer.communicationStyle?.summary || '',
              values: coreLayer.values?.keyPoints || [],
              emotionalNeeds: coreLayer.emotionalNeeds?.keyPoints || [],
              lifeMilestones: coreLayer.lifeMilestones?.keyPoints || [],
              preferences: coreLayer.preferences?.keyPoints || [],
              strangerInitialSentiment: 50,
              generatedAt: new Date(),
              updatedAt: new Date()
            }
          }
        }
      );
      logger.info(`[RoleCardController] ✓ MongoDB 更新完成`);

      // 8. Process pending memories in background (non-blocking)
      logger.info(`[RoleCardController] 步骤 8: 启动待处理记忆的后台处理`);
      this.processPendingMemoriesBackground(userId, roleCardV2);

      logger.info(`[RoleCardController] ========== V2角色卡生成成功 ==========`);
      logger.info(`[RoleCardController] 总结: 核心层✓, 关系层${relationResults.success.length}个✓(跳过${relationResults.skipped.length}个), 安全护栏✓, 校准层✓, 存储✓`);

      res.json({
        success: true,
        data: {
          roleCard: roleCardV2,
          relationStats: {
            success: relationResults.success.length,
            skipped: relationResults.skipped.length,
            skippedDetails: relationResults.skipped,
            failed: relationResults.failed.length,
            failures: relationResults.failed
          }
        }
      });

    } catch (error) {
      logger.error(`[RoleCardController] ========== 角色卡生成失败 ==========`);
      logger.error(`[RoleCardController] 错误类型: ${error.constructor.name}`);
      logger.error(`[RoleCardController] 错误信息: ${error.message}`);
      logger.error(`[RoleCardController] 错误堆栈: ${error.stack}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 生成角色卡 V2（带 SSE 进度推送）
   */
  async generateRoleCardWithProgress(req, res) {
    const userId = req.user.id;

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 进度回调函数
    const sendProgress = (data) => {
      try {
        res.write(`event: progress\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        logger.error('[RoleCardController] SSE 写入失败:', error);
      }
    };

    try {
      logger.info(`[RoleCardController] ========== 开始生成V2角色卡 (SSE) ==========`);
      logger.info(`[RoleCardController] User: ${userId}`);

      // 发送开始事件
      sendProgress({
        step: 0,
        total: 7,
        stage: 'init',
        message: '开始生成角色卡',
        percentage: 0
      });

      // 1. 生成核心层
      sendProgress({
        step: 1,
        total: 7,
        stage: 'core_layer',
        message: '正在生成核心层（从A套问答提取人格特质）',
        percentage: 14
      });

      const coreLayer = await this.coreGenerator.generate(userId, (progress) => {
        sendProgress({
          step: 1,
          total: 7,
          stage: 'core_layer_extraction',
          message: `核心层提取中: ${progress.current}/${progress.total}`,
          percentage: 14 + Math.round(progress.current / progress.total * 14),
          detail: progress
        });
      });

      sendProgress({
        step: 1,
        total: 7,
        stage: 'core_layer_done',
        message: '核心层生成完成',
        percentage: 28
      });

      // 2. 生成关系层
      sendProgress({
        step: 2,
        total: 7,
        stage: 'relation_layer',
        message: '正在生成关系层（从B/C套问答提取关系信息）',
        percentage: 28
      });

      const relationResults = await this.relationGenerator.generateAll(userId, (progress) => {
        sendProgress({
          step: 2,
          total: 7,
          stage: 'relation_layer_generation',
          message: `关系层生成中: ${progress.current}/${progress.total}`,
          percentage: 28 + Math.round(progress.current / progress.total * 28),
          detail: progress
        });
      });

      sendProgress({
        step: 2,
        total: 7,
        stage: 'relation_layer_done',
        message: `关系层生成完成 - 成功: ${relationResults.success.length}`,
        percentage: 56,
        stats: {
          success: relationResults.success.length,
          skipped: relationResults.skipped.length,
          failed: relationResults.failed.length
        }
      });

      // 3. 获取安全护栏
      sendProgress({
        step: 3,
        total: 7,
        stage: 'safety_guardrails',
        message: '正在获取安全护栏规则',
        percentage: 56
      });

      const guardrails = await SafetyGuardrailsManager.getGuardrails(userId);

      sendProgress({
        step: 3,
        total: 7,
        stage: 'safety_guardrails_done',
        message: `安全护栏规则获取完成`,
        percentage: 64
      });

      // 4. 创建校准层
      sendProgress({
        step: 4,
        total: 7,
        stage: 'calibration_layer',
        message: '正在创建校准层',
        percentage: 64
      });

      const calibration = CalibrationLayerManager.createInitialCalibrationLayer(coreLayer);

      sendProgress({
        step: 4,
        total: 7,
        stage: 'calibration_layer_done',
        message: '校准层创建完成',
        percentage: 72
      });

      // 5. 组装完整角色卡
      sendProgress({
        step: 5,
        total: 7,
        stage: 'assembling',
        message: '正在组装完整角色卡',
        percentage: 72
      });

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

      sendProgress({
        step: 5,
        total: 7,
        stage: 'assembling_done',
        message: '角色卡组装完成',
        percentage: 80
      });

      // 6. 保存到文件系统
      sendProgress({
        step: 6,
        total: 7,
        stage: 'saving',
        message: '正在保存到文件系统',
        percentage: 80
      });

      await this.dualStorage.saveCoreLayer(userId, coreLayer);
      for (const layer of relationResults.success) {
        await this.dualStorage.saveRelationLayer(userId, layer.relationId, layer);
      }
      await this.dualStorage.saveRoleCardV2(userId, roleCardV2);

      sendProgress({
        step: 6,
        total: 7,
        stage: 'saving_done',
        message: `文件系统保存完成 - 核心层 + ${relationResults.success.length}个关系层`,
        percentage: 90
      });

      // 7. 更新 MongoDB
      sendProgress({
        step: 7,
        total: 7,
        stage: 'mongodb_sync',
        message: '正在同步更新 MongoDB',
        percentage: 90
      });

      await User.updateOne(
        { _id: userId },
        {
          $set: {
            'companionChat.roleCardV2': roleCardV2,
            'companionChat.roleCard': {
              personality: coreLayer.personality?.summary || '',
              background: coreLayer.backgroundStory?.summary || coreLayer.selfPerception?.summary || '',
              interests: coreLayer.interests?.keyPoints || [],
              communicationStyle: coreLayer.communicationStyle?.summary || '',
              values: coreLayer.values?.keyPoints || [],
              emotionalNeeds: coreLayer.emotionalNeeds?.keyPoints || [],
              lifeMilestones: coreLayer.lifeMilestones?.keyPoints || [],
              preferences: coreLayer.preferences?.keyPoints || [],
              strangerInitialSentiment: 50,
              generatedAt: new Date(),
              updatedAt: new Date()
            }
          }
        }
      );

      sendProgress({
        step: 7,
        total: 7,
        stage: 'mongodb_sync_done',
        message: 'MongoDB 更新完成',
        percentage: 100
      });

      // Process pending memories in background (non-blocking)
      this.processPendingMemoriesBackground(userId, roleCardV2);

      // 发送完成事件
      res.write(`event: done\n`);
      res.write(`data: ${JSON.stringify({
        success: true,
        message: '角色卡生成完成',
        data: {
          roleCard: roleCardV2,
          relationStats: {
            success: relationResults.success.length,
            skipped: relationResults.skipped.length,
            skippedDetails: relationResults.skipped,
            failed: relationResults.failed.length,
            failures: relationResults.failed
          }
        }
      })}\n\n`);

      logger.info(`[RoleCardController] ========== V2角色卡生成成功 (SSE) ==========`);

    } catch (error) {
      logger.error(`[RoleCardController] ========== 角色卡生成失败 (SSE) ==========`);
      logger.error(`[RoleCardController] 错误: ${error.message}`);

      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({
        success: false,
        error: error.message,
        stage: 'unknown'
      })}\n\n`);
    } finally {
      res.end();
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
        // 从 User 模型获取 memoryTokenCount 并合并到 calibration 数据
        const user = await User.findById(userId).select('companionChat.roleCard.memoryTokenCount');

        logger.info('[RoleCardController] 获取角色卡 - User data:', {
          userId,
          hasUser: !!user,
          hasCompanionChat: !!user?.companionChat,
          hasRoleCard: !!user?.companionChat?.roleCard,
          memoryTokenCount: user?.companionChat?.roleCard?.memoryTokenCount
        });

        if (user?.companionChat?.roleCard?.memoryTokenCount) {
          if (!roleCardV2.calibration) {
            roleCardV2.calibration = { currentState: {} };
          }
          if (!roleCardV2.calibration.currentState) {
            roleCardV2.calibration.currentState = {};
          }
          roleCardV2.calibration.currentState.totalTokens = user.companionChat.roleCard.memoryTokenCount;
          logger.info('[RoleCardController] 已合并 memoryTokenCount:', roleCardV2.calibration.currentState.totalTokens);
        }

        // 禁用缓存，确保总是返回最新数据
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

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

  /**
   * 获取各层生成状态
   */
  async getLayersStatus(req, res) {
    const userId = req.user.id;

    try {
      // 获取核心层状态
      const coreLayer = await this.dualStorage.loadCoreLayer(userId);

      // 获取关系层状态
      const relationLayers = await this.dualStorage.loadAllRelationLayers(userId);

      // 获取所有协助关系
      const relations = await AssistRelation.find({ targetId: userId })
        .populate('assistantId', 'name');

      // 获取每个协助者的答案数量
      const relationsWithStatus = await Promise.all(relations.map(async (relation) => {
        const relationId = relation._id.toString();
        const assistantId = relation.assistantId?._id?.toString();

        // 统计答案数量
        const answerCount = await Answer.countDocuments({
          userId: assistantId,
          targetUserId: userId,
          isSelfAnswer: false
        });

        const existingLayer = relationLayers[relationId];

        let status;
        if (existingLayer) {
          status = 'generated';
        } else if (answerCount < 3) {
          status = 'insufficient_answers';
        } else {
          status = 'not_generated';
        }

        return {
          relationId,
          assistantId,
          assistantName: relation.assistantId?.name || '协助者',
          specificRelation: relation.specificRelation || '',
          relationshipType: relation.relationshipType,
          status,
          answerCount,
          generatedAt: existingLayer?.generatedAt
        };
      }));

      res.json({
        success: true,
        data: {
          coreLayer: {
            exists: !!coreLayer,
            generatedAt: coreLayer?.generatedAt
          },
          calibrationLayer: {
            exists: !!coreLayer // 校准层跟随核心层
          },
          safetyGuardrails: {
            loaded: true // 全局配置始终加载
          },
          relations: relationsWithStatus
        }
      });
    } catch (error) {
      logger.error('[RoleCardController] 获取层状态失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 单独生成核心层（SSE）
   */
  async generateCoreLayerStream(req, res) {
    const userId = req.user.id;

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendProgress = (data) => {
      try {
        res.write(`event: progress\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        logger.error('[RoleCardController] SSE 写入失败:', error);
      }
    };

    try {
      sendProgress({ stage: 'start', message: '开始生成核心层', percentage: 0 });

      const coreLayer = await this.coreGenerator.generate(userId, (progress) => {
        sendProgress({
          stage: 'extracting',
          message: `提取答案 ${progress.current}/${progress.total}`,
          percentage: Math.round(progress.current / progress.total * 80),
          detail: progress
        });
      });

      // 保存核心层
      await this.dualStorage.saveCoreLayer(userId, coreLayer);

      // 创建校准层（校准层随核心层一起存储，无需单独保存）
      const calibration = CalibrationLayerManager.createInitialCalibrationLayer(coreLayer);

      sendProgress({ stage: 'complete', message: '核心层生成完成', percentage: 100 });

      res.write(`event: done\n`);
      res.write(`data: ${JSON.stringify({ success: true })}\n\n`);
      res.end();
    } catch (error) {
      logger.error('[RoleCardController] 核心层生成失败:', error);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({
        success: false,
        error: error.message,
        stage: 'core_layer'
      })}\n\n`);
      res.end();
    }
  }

  /**
   * 单独生成某个关系层（SSE）
   */
  async generateRelationLayerStream(req, res) {
    const userId = req.user.id;
    const { relationId } = req.params;

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendProgress = (data) => {
      try {
        res.write(`event: progress\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        logger.error('[RoleCardController] SSE 写入失败:', error);
      }
    };

    try {
      // 获取协助关系
      const relation = await AssistRelation.findOne({
        _id: relationId,
        targetId: userId
      }).populate('assistantId');

      if (!relation) {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({
          success: false,
          error: '协助关系不存在',
          stage: 'validation'
        })}\n\n`);
        res.end();
        return;
      }

      sendProgress({
        stage: 'start',
        message: `开始生成 ${relation.assistantId?.name} 的关系层`,
        percentage: 0
      });

      const layer = await this.relationGenerator.generateOne(userId, relation, (progress) => {
        sendProgress({
          stage: 'extracting',
          message: `处理答案 ${progress.current}/${progress.total}`,
          percentage: Math.round(progress.current / progress.total * 80),
          detail: progress
        });
      });

      if (!layer) {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({
          success: false,
          error: 'insufficient_answers',
          stage: 'generation'
        })}\n\n`);
        res.end();
        return;
      }

      // 保存关系层
      await this.dualStorage.saveRelationLayer(userId, relationId, layer);

      sendProgress({ stage: 'complete', message: '关系层生成完成', percentage: 100 });

      res.write(`event: done\n`);
      res.write(`data: ${JSON.stringify({ success: true })}\n\n`);
      res.end();
    } catch (error) {
      logger.error('[RoleCardController] 关系层生成失败:', error);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({
        success: false,
        error: error.message,
        stage: 'relation_layer'
      })}\n\n`);
      res.end();
    }
  }

  /**
   * 批量生成未生成的层（SSE）
   */
  async generateBatchStream(req, res) {
    const userId = req.user.id;
    const { layers } = req.body; // ['relation:xxx', 'relation:yyy']

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendProgress = (data) => {
      try {
        res.write(`event: progress\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        logger.error('[RoleCardController] SSE 写入失败:', error);
      }
    };

    try {
      // 验证 layers 参数
      if (!layers || !Array.isArray(layers) || layers.length === 0) {
        sendProgress({
          stage: 'error',
          message: '无效的层列表参数',
          percentage: 0,
          current: 0,
          total: 0
        });
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({
          success: false,
          error: 'layers 参数必须是非空数组',
          stage: 'validation'
        })}\n\n`);
        res.end();
        return;
      }

      const total = layers.length;
      let completed = 0;

      sendProgress({
        stage: 'start',
        message: `开始批量生成 ${total} 个层`,
        percentage: 0,
        current: 0,
        total
      });

      for (const layerSpec of layers) {
        const [type, id] = layerSpec.split(':');

        if (type === 'relation') {
          const relation = await AssistRelation.findOne({
            _id: id,
            targetId: userId
          }).populate('assistantId');

          if (relation) {
            sendProgress({
              stage: 'generating',
              message: `正在生成 ${relation.assistantId?.name || '协助者'} 的关系层`,
              percentage: Math.round(completed / total * 100),
              current: completed,
              total
            });

            const layer = await this.relationGenerator.generateOne(userId, relation);
            if (layer) {
              await this.dualStorage.saveRelationLayer(userId, id, layer);
            }
          }
        }

        completed++;
        sendProgress({
          stage: 'progress',
          message: `完成 ${completed}/${total}`,
          percentage: Math.round(completed / total * 100),
          current: completed,
          total
        });
      }

      sendProgress({
        stage: 'complete',
        message: '批量生成完成',
        percentage: 100,
        current: total,
        total
      });

      res.write(`event: done\n`);
      res.write(`data: ${JSON.stringify({ success: true })}\n\n`);
      res.end();
    } catch (error) {
      logger.error('[RoleCardController] 批量生成失败:', error);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({
        success: false,
        error: error.message,
        stage: 'batch_generation'
      })}\n\n`);
      res.end();
    }
  }
}

export default new RoleCardController();
