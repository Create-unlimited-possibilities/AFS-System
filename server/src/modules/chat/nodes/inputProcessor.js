/**
 * 输入处理节点
 * 处理用户输入，提取关键信息
 *
 * @author AFS Team
 * @version 2.0.0
 */

import logger from '../../../core/utils/logger.js';
import { createDefaultLLMClient } from '../../../core/llm/client.js';

const inputLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'INPUT_PROCESSOR' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'INPUT_PROCESSOR' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'INPUT_PROCESSOR' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'INPUT_PROCESSOR' }),
};

/**
 * 使用 LLM 语义判断用户是否想要结束对话
 * @param {string} message - 用户消息
 * @returns {Promise<Object>} 判断结果 { isEndIntent, confidence, reason }
 */
async function detectEndIntentWithLLM(message) {
  try {
    const llmClient = createDefaultLLMClient();

    const prompt = `判断用户消息是否表示想要结束当前对话。只输出"是"或"否"。

需要判定为结束意图的情况：
1. 明确说再见/告别（如：再见、拜拜、下次聊、bye）
2. 表示要离开/有事（如：我先走了、要去忙了、有点事、领导叫我）
3. 表示对话该结束了（如：今天就到这里、不聊了、先这样）
4. 表示时间晚了（如：太晚了、该睡了、时间不早了）

不是结束意图的情况：
1. 普通问候/关心（如：你好、身体怎么样、最近好吗）
2. 继续话题（如：然后呢、还有吗、说说看）
3. 表达情感（如：想你、爱你、担心你）
4. 询问信息（如：你是谁、在干嘛）

消息："${message}"
判断：`;

    const response = await llmClient.generate(prompt, {
      temperature: 0.1,
      maxTokens: 10
    });

    const answer = response?.trim();
    const isEndIntent = answer?.includes('是') && !answer?.includes('不是');

    inputLogger.info(`[InputProcessor] LLM结束意图判断: ${isEndIntent ? '是' : '否'} - 消息: "${message}"`);

    return {
      isEndIntent,
      confidence: isEndIntent ? 0.9 : 0.1,
      reason: isEndIntent ? 'llm_detected' : 'llm_not_detected'
    };

  } catch (error) {
    inputLogger.warn(`[InputProcessor] LLM判断失败，使用默认值: ${error.message}`);
    return { isEndIntent: false, confidence: 0, reason: 'llm_error' };
  }
}

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

    // 使用 LLM 语义判断结束意图
    const endIntentResult = await detectEndIntentWithLLM(processedInput);

    if (endIntentResult.isEndIntent) {
      inputLogger.info('[InputProcessor] LLM检测到结束意图', {
        confidence: endIntentResult.confidence,
        reason: endIntentResult.reason
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
      endIntent: endIntentResult.isEndIntent ? {
        detected: true,
        confidence: endIntentResult.confidence,
        reason: endIntentResult.reason
      } : {
        detected: false
      }
    };

    inputLogger.info(`[InputProcessor] 输入处理完成 - 长度: ${inputProcessor.inputLength}, 词数: ${inputProcessor.inputWords}`);

    // Update state with processed input and end intent detection
    const metadataUpdate = {
      ...state.metadata,
      inputProcessor,
      endIntentDetected: endIntentResult.isEndIntent,
      endIntentConfidence: endIntentResult.confidence
    };

    // If high confidence end intent, set shouldEndSession flag
    if (endIntentResult.isEndIntent && endIntentResult.confidence >= 0.7) {
      metadataUpdate.shouldEndSession = true;
      metadataUpdate.endSessionReason = 'user_intent';
      inputLogger.info('[InputProcessor] 设置 shouldEndSession 标志');
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
