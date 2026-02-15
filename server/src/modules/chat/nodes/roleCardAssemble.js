/**
 * 角色卡组装节点 V2
 * 动态组装角色卡（使用新的V2组装器）
 *
 * @author AFS Team
 * @version 2.0.0
 */

import RoleCardAssemblerV2 from '../assembler.js';
import logger from '../../../core/utils/logger.js';

/**
 * 角色卡组装节点函数
 * @param {Object} state - 当前对话状态
 * @returns {Promise<Object>} 更新后的状态
 */
export async function roleCardAssembleNode(state) {
  try {
    logger.info('[RoleCardAssemble] 组装角色卡 V2');

    const { userId, interlocutor, metadata } = state;
    const sessionId = metadata?.sessionId || '';
    const assistantId = interlocutor.specificId;

    const assembler = new RoleCardAssemblerV2();
    const result = await assembler.assembleDynamicRoleCard({
      targetUserId: userId,
      interlocutorUserId: interlocutor.id,
      sessionId: sessionId,
      assistantId: assistantId
    });

    state.systemPrompt = result.systemPrompt;
    state.dynamicData = result.dynamicData;
    state.sessionMeta = result.session;

    logger.info('[RoleCardAssemble] V2角色卡组装完成');

    return state;

  } catch (error) {
    logger.error('[RoleCardAssemble] 处理失败:', error);
    state.addError(error);
    return state;
  }
}
