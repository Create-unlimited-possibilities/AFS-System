/**
 * 输出格式化节点
 * 格式化输出给前端
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import logger from '../../../core/utils/logger.js';

/**
 * 输出格式化节点函数
 * @param {Object} state - 当前对话状态
 * @returns {Promise<Object>} 格式化的输出
 */
export async function outputFormatterNode(state) {
  try {
    logger.info('[OutputFormatter] 格式化输出');

    const { generatedResponse, interlocutor, metadata, retrievedMemories } = state;

    const formattedOutput = {
      success: true,
      message: generatedResponse,
      metadata: {
        relationType: interlocutor.relationType,
        sentimentScore: interlocutor.sentimentScore,
        retrievedMemoriesCount: retrievedMemories?.length || 0,
        modelUsed: metadata.modelUsed || '',
        ragUsed: metadata.inputProcessor?.ragUsed || false,
        memoryUpdated: metadata.memoryUpdated || false,
        timestamp: new Date()
      }
    };

    if (state.errors.length > 0) {
      formattedOutput.success = false;
      formattedOutput.errors = state.errors.map(e => e.message);
    }

    logger.info('[OutputFormatter] 输出格式化完成');

    return formattedOutput;
  } catch (error) {
    logger.error('[OutputFormatter] 处理失败:', error);
    return {
      success: false,
      error: error.message,
      metadata: {
        timestamp: new Date()
      }
    };
  }
}
