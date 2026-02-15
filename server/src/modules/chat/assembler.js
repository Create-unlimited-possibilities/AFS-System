/**
 * 角色卡组装器 V2
 * 在每次对话时组装动态角色卡，整合核心层、关系层、安全护栏等信息
 *
 * @author AFS Team
 * @version 2.0.0
 */

import User from '../user/model.js';
import ChatSession from './model.js';
import DualStorage from '../../core/storage/dual.js';
import { PromptAssembler, DynamicDataFetcher, CalibrationLayerManager } from '../rolecard/v2/index.js';
import SentimentManager from '../sentiment/manager.js';
import logger from '../../core/utils/logger.js';

/**
 * 角色卡组装器 V2
 * 负责组装对话所需的动态角色卡信息
 */
class RoleCardAssemblerV2 {
  constructor() {
    this.dualStorage = new DualStorage();
    this.promptAssembler = new PromptAssembler();
    this.dataFetcher = new DynamicDataFetcher();
    this.sentimentManager = new SentimentManager();
    this.calibrationManager = CalibrationLayerManager;
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
    logger.info(`[RoleCardAssemblerV2] 开始组装 - Session: ${sessionId}`);

    try {
      // 1. 加载 V2 角色卡
      const roleCardV2 = await this.dualStorage.loadRoleCardV2(targetUserId);

      if (!roleCardV2) {
        throw new Error(`用户未生成V2角色卡: ${targetUserId}`);
      }

      // 2. 获取对话者信息
      const interlocutorUser = await User.findById(interlocutorUserId);

      // 3. 获取会话信息
      const session = await ChatSession.findOne({ sessionId });

      // 4. 获取动态数据
      const participantIds = assistantId ? [assistantId] : [interlocutorUserId];
      const dynamicData = await this.dataFetcher.fetchDynamicData(
        targetUserId,
        participantIds,
        roleCardV2
      );

      // 5. 获取好感度（陌生人场景）
      const sentiment = await this.sentimentManager.getStrangerSentiment(targetUserId, interlocutorUserId);

      // 6. 组装 System Prompt
      const { systemPrompt, metadata } = this.promptAssembler.assemble({
        coreLayer: roleCardV2.coreLayer,
        relationLayers: roleCardV2.relationLayers,
        guardrails: roleCardV2.safetyGuardrails,
        dynamicData,
        calibration: roleCardV2.calibration
      });

      // 7. 更新校准层统计
      if (roleCardV2.calibration) {
        this.calibrationManager.updateConversationStats(roleCardV2.calibration, 100);
        await this.dualStorage.saveRoleCardV2(targetUserId, roleCardV2);
      }

      logger.info(`[RoleCardAssemblerV2] 组装完成`);

      return {
        systemPrompt,
        dynamicData,
        session: {
          sessionId: session?.sessionId || sessionId,
          relation: session?.relation || 'unknown',
          sentimentScore: sentiment?.currentScore || 50
        },
        metadata
      };

    } catch (error) {
      logger.error(`[RoleCardAssemblerV2] 组装失败:`, error);
      throw error;
    }
  }
}

// 兼容旧版导出
export { RoleCardAssemblerV2 as default };
export { RoleCardAssemblerV2 as DynamicRoleCardAssembler };
