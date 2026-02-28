/**
 * Listening Response Node for XiaoShuDong
 * 倾听阶段回复生成器 - 像心理咨询师一样倾听和引导
 *
 * @author AFS Team
 * @version 2.0.0
 */

import logger from '../../../core/utils/logger.js';
import { createDefaultLLMClient } from '../../../core/llm/client.js';
import { configLoader } from '../../langgraph/configLoader.js';

const listeningLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'LISTENING_RESPONSE' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'LISTENING_RESPONSE' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'LISTENING_RESPONSE' }),
};

/**
 * 心理咨询师式倾听回复的 System Prompt
 */
const LISTENING_SYSTEM_PROMPT = `你是一位温暖、专业、有同理心的心理咨询师（小树洞）。

你的角色是倾听用户的烦恼，通过温和的引导帮助他们理清思绪。

## 回复原则

1. **简洁温暖**：回复2-4句话，用温暖平实的语言
2. **共情回应**：首先理解并回应用户的情绪
3. **温和引导**：每次可以问一个开放式问题帮助用户展开
4. **避免说教**：不要急于给建议，先倾听
5. **禁止命理词汇**：绝不使用命理、占卜、运势等词汇

## 引导技巧

- 询问具体情况："能跟我说说具体发生了什么吗？"
- 询问持续时间："这种情况持续多久了？"
- 询问核心担忧："你觉得最让你困扰的是什么？"
- 询问内心需求："你内心最希望改变的是什么？"
- 表达理解："我理解这种感觉确实很难受"

## 回复风格示例

用户: "今天好累"
回复: "听起来你今天过得很辛苦。愿意跟我分享一下是什么让你感到这么累吗？"

用户: "工作压力好大"
回复: "工作压力确实让人喘不过气。这种情况是最近才出现的，还是已经持续一段时间了？"

用户: "我不知道该怎么办"
回复: "面对不确定的时候确实会感到迷茫。能告诉我更多关于你现在的处境吗？这样我可以更好地理解你。"

只输出你的回复内容，不要有任何其他文字。`;

/**
 * 过渡到分析阶段的提示
 */
const TRANSITION_PROMPT_SUFFIX = `

【特别提示】根据对话分析，用户可能已经准备好接受更深入的指导。
请在回复末尾自然地加入类似这样的过渡语：
"我理解你的情况了。如果你愿意，我可以从更深层的角度帮你分析一下，看看有没有新的视角。你觉得呢？"
要自然地融入，不要生硬。`;

/**
 * 生成倾听阶段的回复
 *
 * @param {XiaoShuDongState} state - 对话状态
 * @returns {Promise<XiaoShuDongState>} 更新后的状态
 */
export async function listeningResponseNode(state) {
  try {
    const currentInput = state.currentInput || '';
    const history = state.messages || [];
    const assessment = state.conversationAssessment || {};

    listeningLogger.info(`[ListeningResponse] 生成倾听回复`);

    // 检查是否有预生成的回复
    if (state.listeningResponse) {
      state.finalResponse = state.listeningResponse;
      state.metadata.listeningGenerated = true;
      return state;
    }

    // 生成新回复
    const response = await generateListeningLLMResponse(history, currentInput, assessment);

    state.finalResponse = response;
    state.metadata.listeningGenerated = true;
    state.metadata.listeningGeneratedAt = new Date();

    listeningLogger.info(`[ListeningResponse] 回复生成完成: ${response.substring(0, 50)}...`);

    return state;

  } catch (error) {
    listeningLogger.error('[ListeningResponse] 生成失败:', error);

    // 使用备用回复
    state.finalResponse = getFallbackResponse(state);
    state.metadata.listeningGenerated = false;

    if (state.addError) {
      state.addError(error);
    }

    return state;
  }
}

/**
 * 使用 LLM 生成倾听回复
 */
async function generateListeningLLMResponse(history, currentInput, assessment) {
  try {
    const llmClient = createDefaultLLMClient();

    // 构建对话历史（最近3轮）
    const historyText = history.slice(-6).map(h =>
      `${h.role === 'user' ? '用户' : '咨询师'}：${h.content}`
    ).join('\n');

    // Get prompt and LLM config from configLoader
    const nodeConfig = configLoader.getNodeConfig('xiaoshudong', 'listening_response');
    let systemPrompt = configLoader.getPrompt('xiaoshudong', 'listening_response') || LISTENING_SYSTEM_PROMPT;
    if (assessment.readyForAnalysis && assessment.confidence > 0.6) {
      systemPrompt += TRANSITION_PROMPT_SUFFIX;
    }

    const llmOptions = {
      temperature: nodeConfig?.llmConfig?.temperature || 0.7,
      maxTokens: nodeConfig?.llmConfig?.maxTokens || 200
    };

    const prompt = `${systemPrompt}

【对话历史】
${historyText || '（无历史记录，这是对话开始）'}

【用户最新消息】
${currentInput}

你的回复：`;

    const response = await llmClient.generate(prompt, llmOptions);

    return response?.trim() || getFallbackResponse({ currentInput });

  } catch (error) {
    listeningLogger.error(`[ListeningResponse] LLM 调用失败: ${error.message}`);
    return getFallbackResponse({ currentInput });
  }
}

/**
 * 获取备用回复
 */
function getFallbackResponse(state) {
  const input = state.currentInput || '';

  // 基于输入长度的简单回复
  if (input.length < 5) {
    return '嗯，我在听。能多跟我说说吗？';
  }

  // 检查是否有明显的情感词
  const emotionalWords = ['累', '难过', '伤心', '焦虑', '压力', '烦', '孤独'];
  const hasEmotional = emotionalWords.some(word => input.includes(word));

  if (hasEmotional) {
    return '我理解你的感受。能跟我说说是什么让你有这样的感觉吗？';
  }

  return '我在听。能告诉我更多关于你的情况吗？';
}

export default listeningResponseNode;
