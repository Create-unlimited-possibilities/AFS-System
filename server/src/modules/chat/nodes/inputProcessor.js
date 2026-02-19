/**
 * 输入处理节点
 * 处理用户输入，提取关键信息
 *
 * @author AFS Team
 * @version 1.0.0
 */

import logger from '../../../core/utils/logger.js';
import { detectEndIntent } from './tokenMonitor.js';

const inputLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'INPUT_PROCESSOR' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'INPUT_PROCESSOR' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'INPUT_PROCESSOR' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'INPUT_PROCESSOR' }),
};

/**
 * 输入处理节点函数
 * @param {Object} state - 当前对话状态
 * @returns {Promise<Object>} 更新后的状态
 */
export async function inputProcessorNode(state) {
  try {
    inputLogger.info('[InputProcessor] 处理用户输入');

    const { currentInput, userName } = state;

    if (!currentInput || currentInput.trim().length === 0) {
      throw new Error('输入内容为空');
    }

    const processedInput = currentInput.trim();

    // Detect end intent in user message
    const endIntentResult = detectEndIntent(processedInput);

    if (endIntentResult.isEndIntent) {
      inputLogger.info('[InputProcessor] End intent detected in user message', {
        confidence: endIntentResult.confidence,
        matchedPhrase: endIntentResult.matchedPhrase,
        matchType: endIntentResult.matchType
      });
    }

    const inputProcessor = {
      originalInput: currentInput,
      processedInput,
      inputLength: currentInput.length,
      inputWords: processedInput.split(/\s+/).length,
      processedAt: new Date(),
      metadata: {
        userName,
        timestamp: new Date()
      },
      // End intent detection results
      endIntent: endIntentResult.isEndIntent ? {
        detected: true,
        confidence: endIntentResult.confidence,
        matchedPhrase: endIntentResult.matchedPhrase,
        matchType: endIntentResult.matchType
      } : {
        detected: false
      }
    };

    inputLogger.info(`[InputProcessor] 输入处理完成 - 长度: ${inputProcessor.inputLength}, 词数: ${inputProcessor.inputWords}`);

    // Update state with processed input and end intent detection
    const metadataUpdate = {
      ...state.metadata,
      inputProcessor,
      // Set end intent flags for downstream nodes
      endIntentDetected: endIntentResult.isEndIntent,
      endIntentConfidence: endIntentResult.confidence
    };

    // If high confidence end intent, set shouldEndSession flag
    if (endIntentResult.isEndIntent && endIntentResult.confidence >= 0.7) {
      metadataUpdate.shouldEndSession = true;
      metadataUpdate.endSessionReason = 'user_intent';
      inputLogger.info('[InputProcessor] High confidence end intent - setting shouldEndSession flag');
    }

    return state.setState({
      metadata: metadataUpdate
    });

  } catch (error) {
    inputLogger.error('[InputProcessor] 处理失败:', error);
    state.addError(error);
    return state;
  }
}

/**
 * Check if the processed input contains end intent
 * @param {Object} state - Conversation state
 * @returns {boolean} Whether end intent was detected
 */
export function hasEndIntent(state) {
  return state.metadata?.endIntentDetected === true;
}

/**
 * Get end intent confidence from state
 * @param {Object} state - Conversation state
 * @returns {number} Confidence score (0-1)
 */
export function getEndIntentConfidence(state) {
  return state.metadata?.endIntentConfidence || 0;
}

export default inputProcessorNode;
