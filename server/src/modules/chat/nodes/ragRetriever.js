/**
 * RAG检索节点
 * 根据关系和上下文检索相关记忆
 *
 * 记忆类别说明：
 * - self: 角色卡主人自己的经历（求学、工作、童年等自述）
 * - family: 与家人的共同回忆
 * - friend: 与朋友的共同回忆
 *
 * @author AFS Team
 * @version 2.0.0
 */

import logger from '../../../core/utils/logger.js';

/**
 * RAG检索节点函数
 * @param {Object} state - 当前对话状态
 * @returns {Promise<Object>} 更新后的状态
 */
export async function ragRetrieverNode(state) {
  try {
    logger.info('[RAGRetriever] 检索相关记忆');

    const { currentInput, interlocutor, userId } = state;
    const relationType = interlocutor.relationType;

    // 详细日志
    logger.info(`[RAGRetriever] 状态信息 - userId: ${userId}`);
    logger.info(`[RAGRetriever] 状态信息 - interlocutor: ${JSON.stringify(interlocutor)}`);
    logger.info(`[RAGRetriever] 状态信息 - relationType: ${relationType}`);

    let retrievedMemories = [];

    if (relationType === 'stranger') {
      logger.info('[RAGRetriever] 陌生人模式，不进行记忆检索');
    } else {
      // 检索策略：
      // 1. 始终搜索 self 类别（角色卡自己的经历，如求学、工作等）
      // 2. 如果是 family/friend 关系，额外搜索对应类别的共同记忆
      // 3. 合并结果，按相关性排序

      logger.info(`[RAGRetriever] ${relationType}模式，多类别检索`);

      // 搜索 self 类别（角色卡自己的记忆）
      const selfMemories = await retrieveMemories(currentInput, 'self', userId, null);
      logger.info(`[RAGRetriever] self类别检索到 ${selfMemories.length} 条记忆`);

      // 搜索关系对应类别的共同记忆
      let relationMemories = [];
      if (relationType === 'family' || relationType === 'friend') {
        relationMemories = await retrieveMemories(currentInput, relationType, userId, interlocutor.specificId);
        logger.info(`[RAGRetriever] ${relationType}类别检索到 ${relationMemories.length} 条记忆`);
      }

      // 合并并去重（按内容去重）
      const memoryMap = new Map();
      for (const mem of [...selfMemories, ...relationMemories]) {
        const key = mem.content.substring(0, 100); // 用前100字符作为去重key
        if (!memoryMap.has(key)) {
          memoryMap.set(key, mem);
        }
      }

      // 按相关性排序（距离越小越相关）
      retrievedMemories = Array.from(memoryMap.values())
        .sort((a, b) => a.relevanceScore - b.relevanceScore)
        .slice(0, 5); // 最多返回5条
    }

    state.retrievedMemories = retrievedMemories;

    logger.info(`[RAGRetriever] 检索完成 - 找到${retrievedMemories.length}条相关记忆`);
    if (retrievedMemories.length > 0) {
      logger.info(`[RAGRetriever] 记忆预览: ${retrievedMemories.map(m => m.content.substring(0, 50) + '...').join(' | ')}`);
    }

    return state;
  } catch (error) {
    logger.error('[RAGRetriever] 处理失败:', error);
    state.addError(error);
    return state;
  }
}

/**
 * 从向量数据库检索记忆
 * @param {string} query - 搜索查询
 * @param {string} category - 记忆类别 (self/family/friend)
 * @param {string} userId - 用户ID
 * @param {string|null} relationSpecificId - 关系特定ID（用于过滤特定协助者的记忆）
 * @returns {Promise<Array>} 记忆数组
 */
async function retrieveMemories(query, category, userId, relationSpecificId = null) {
  try {
    const VectorIndexService = (await import('../../../core/storage/vector.js')).default;
    const vectorService = new VectorIndexService();

    const exists = await vectorService.indexExists(userId);
    if (!exists) {
      logger.warn(`[RAGRetriever] 用户 ${userId} 的向量索引不存在`);
      return [];
    }

    const memories = await vectorService.search(
      userId,
      query,
      5,
      category,
      relationSpecificId
    );

    return memories;
  } catch (error) {
    logger.error('[RAGRetriever] 向量搜索失败:', error);
    return [];
  }
}
