/**
 * RAG检索节点
 * 根据关系和上下文检索相关记忆
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import logger from '../../../utils/logger.js';

/**
 * RAG检索节点函数
 * @param {Object} state - 当前对话状态
 * @returns {Promise<Object>} 更新后的状态
 */
export async function ragRetrieverNode(state) {
  try {
    logger.info('[RAGRetriever] 检索相关记忆');

    const { currentInput, interlocutor, messages } = state;
    const relationType = interlocutor.relationType;

    let retrievedMemories = [];

    if (relationType === 'stranger') {
      logger.info('[RAGRetriever] 陌生人模式，不进行记忆检索');
    } else {
      logger.info(`[RAGRetriever] ${relationType}模式，检索${relationType}记忆`);
      
      const category = relationType;
      retrievedMemories = await retrieveMemories(currentInput, category);
    }

    state.retrievedMemories = retrievedMemories;

    logger.info(`[RAGRetriever] 检索完成 - 找到${retrievedMemories.length}条相关记忆`);

    return state;
  } catch (error) {
    logger.error('[RAGRetriever] 处理失败:', error);
    state.addError(error);
    return state;
  }
}

async function retrieveMemories(query, category) {
  try {
    const DualStorage = (await import('../../dualStorage.js')).default;
    const dualStorage = new DualStorage();
    
    const memories = await dualStorage.retrieveMemories(query, category);
    
    return memories.map(memory => ({
      content: memory.content,
      relevanceScore: memory.score || 0.5,
      category: memory.category || category,
      metadata: memory.metadata || {}
    }));
  } catch (error) {
    logger.error('[RAGRetriever] 记忆检索失败:', error);
    return [];
  }
}
