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

    // 优先级: translatedResponse (命理分析) > listeningResponse (倾诉模式) > generatedResponse (普通聊天)
    const message = state.translatedResponse ||
                    state.listeningResponse ||
                    state.generatedResponse ||
                    '';

    // 确定响应来源，用于调试和日志
    const responseSource = state.translatedResponse ? 'fortune' :
                           state.listeningResponse ? 'listening' :
                           state.generatedResponse ? 'chat' : 'none';

    const { interlocutor, metadata, retrievedMemories } = state;

    const formattedOutput = {
      success: true,
      message: message,
      metadata: {
        relationType: interlocutor?.relationType || 'stranger',
        sentimentScore: interlocutor?.sentimentScore || 50,
        retrievedMemoriesCount: retrievedMemories?.length || 0,
        modelUsed: metadata?.modelUsed || '',
        ragUsed: metadata?.inputProcessor?.ragUsed || false,
        memoryUpdated: metadata?.memoryUpdated || false,
        responseSource: responseSource,
        timestamp: new Date()
      }
    };

    if (state.errors && state.errors.length > 0) {
      formattedOutput.success = false;
      formattedOutput.errors = state.errors.map(e => e.message);
    }

    logger.info(`[OutputFormatter] 输出格式化完成 - 来源: ${responseSource}, 长度: ${message.length}`);

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
