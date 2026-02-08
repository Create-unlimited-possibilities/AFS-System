/**
 * 角色卡组装节点
 * 动态组装角色卡（使用预处理结果）
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import DynamicRoleCardAssembler from '../DynamicRoleCardAssembler.js';
import logger from '../../../utils/logger.js';

/**
 * 角色卡组装节点函数
 * @param {Object} state - 当前对话状态
 * @returns {Promise<Object>} 更新后的状态
 */
export async function roleCardAssembleNode(state) {
  try {
    logger.info('[RoleCardAssemble] 组装动态角色卡');

    const assembler = new DynamicRoleCardAssembler();

    const { userId, interlocutor } = state;
    const sessionId = state.metadata?.sessionId || '';

    const dynamicRoleCard = await assembler.assembleDynamicRoleCard({
      targetUserId: userId,
      interlocutorUserId: interlocutor.id,
      sessionId: sessionId,
      assistantId: interlocutor.specificId
    });

    state.roleCard = dynamicRoleCard.personaProfile;
    state.systemPrompt = dynamicRoleCard.systemPrompt;
    state.conversationGuidelines = dynamicRoleCard.conversationGuidelines;
    state.sentimentGuidelines = dynamicRoleCard.sentimentGuidelines;

    logger.info('[RoleCardAssemble] 动态角色卡组装完成');

    return state;
  } catch (error) {
    logger.error('[RoleCardAssemble] 处理失败:', error);
    state.addError(error);
    return state;
  }
}
