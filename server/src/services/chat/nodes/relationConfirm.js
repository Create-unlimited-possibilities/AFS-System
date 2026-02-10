/**
 * 关系确认节点
 * 确认对话者关系（家人/朋友/陌生人）
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import User from '../../../models/User.js';
import AssistRelation from '../../../models/AssistRelation.js';
import logger from '../../../utils/logger.js';

/**
 * 关系确认节点函数
 * @param {Object} state - 当前对话状态
 * @returns {Promise<Object>} 更新后的状态
 */
export async function relationConfirmNode(state) {
  try {
    logger.info('[RelationConfirm] 确认对话者关系');

    const { userId, interlocutor } = state;
    const targetUserId = userId;
    const interlocutorUserId = interlocutor.id;

    if (!targetUserId || !interlocutorUserId) {
      throw new Error('用户ID或对话者ID为空');
    }

    let relationType = 'stranger';
    let assistRelationId = null;
    let specificRelation = '';
    let assistantName = '';

    const assistRelation = await AssistRelation.findOne({
      targetUserId: targetUserId,
      assistantUserId: interlocutorUserId
    });

    if (assistRelation) {
      relationType = assistRelation.relationType;
      assistRelationId = assistRelation._id;
      specificRelation = assistRelation.specificRelation;

      const assistantUser = await User.findById(interlocutorUserId);
      if (assistantUser) {
        assistantName = assistantUser.name;
      }

      logger.info(`[RelationConfirm] 找到协助关系 - 类型: ${relationType}, 具体关系: ${specificRelation}`);
    } else {
      logger.info('[RelationConfirm] 未找到协助关系，确认为陌生人');
    }

    if (state.roleCardMode === 'static' && (!assistRelation || (relationType === 'stranger'))) {
      throw new Error('方法B模式仅支持协助者关系，当前为陌生人或未建立协助关系');
    }

    state.interlocutor.relationType = relationType;
    state.interlocutor.specificId = assistRelationId?.toString();
    state.interlocutor.specificRelation = specificRelation;
    state.interlocutor.assistantName = assistantName;

    logger.info(`[RelationConfirm] 关系确认完成 - ${relationType}`);

    return state;
  } catch (error) {
    logger.error('[RelationConfirm] 处理失败:', error);
    state.addError(error);
    return state;
  }
}
