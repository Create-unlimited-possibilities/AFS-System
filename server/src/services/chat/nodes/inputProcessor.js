/**
 * 输入处理节点
 * 处理用户输入，提取关键信息
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import logger from '../../../utils/logger.js';

/**
 * 输入处理节点函数
 * @param {Object} state - 当前对话状态
 * @returns {Promise<Object>} 更新后的状态
 */
export async function inputProcessorNode(state) {
  try {
    logger.info('[InputProcessor] 处理用户输入');

    const { currentInput, userName } = state;

    if (!currentInput || currentInput.trim().length === 0) {
      throw new Error('输入内容为空');
    }

    const inputProcessor = {
      originalInput: currentInput,
      processedInput: currentInput.trim(),
      inputLength: currentInput.length,
      inputWords: currentInput.trim().split(/\s+/).length,
      processedAt: new Date(),
      metadata: {
        userName,
        timestamp: new Date()
      }
    };

    logger.info(`[InputProcessor] 输入处理完成 - 长度: ${inputProcessor.inputLength}, 词数: ${inputProcessor.inputWords}`);

    return state.setState({
      metadata: {
        ...state.metadata,
        inputProcessor
      }
    });
  } catch (error) {
    logger.error('[InputProcessor] 处理失败:', error);
    state.addError(error);
    return state;
  }
}
