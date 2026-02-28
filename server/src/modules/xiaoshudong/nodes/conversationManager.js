/**
 * Conversation Manager for XiaoShuDong
 * 管理对话进程，决定何时从倾听阶段进入深度分析阶段
 *
 * 设计理念：
 * - 像真正的心理咨询师一样，先倾听和引导
 * - 通过多轮对话收集足够的信息
 * - 当用户准备好时，才进入深度分析阶段
 *
 * @author AFS Team
 * @version 2.0.0
 */

import logger from '../../../core/utils/logger.js';
import { createDefaultLLMClient } from '../../../core/llm/client.js';

const conversationLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'CONVERSATION_MANAGER' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'CONVERSATION_MANAGER' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'CONVERSATION_MANAGER' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'CONVERSATION_MANAGER' }),
};

/**
 * 心理咨询师式倾听与引导的 System Prompt
 */
const LISTENING_SYSTEM_PROMPT = `你是一位温暖、专业、有同理心的心理咨询师（小树洞）。

你的角色是倾听用户的烦恼，通过温和的引导帮助他们理清思绪。

## 你的核心任务

1. **倾听与共情**：首先理解并回应用户的情绪
2. **温和引导**：通过开放式问题引导用户表达更多
3. **信息收集**：了解用户的情况、困扰的核心、持续时间等
4. **建立信任**：让用户感到被理解和接纳

## 回复原则

- 回复要简短（2-4句话），不要说教
- 用温暖、平实的语言
- 每次回复可以问一个引导性的问题，帮助用户展开
- 如果用户只是倾诉，给予情感支持和理解
- 如果用户开始询问建议或表示困惑，表示你已经准备好帮助他深入分析

## 引导问题示例

- "听起来你最近压力很大，能告诉我具体是什么让你感到困扰吗？"
- "这种情况持续多久了？"
- "你觉得最让你焦虑的是哪个方面？"
- "在面对这个问题时，你内心最担心的是什么？"
- "如果可以改变一件事，你最希望改变什么？"

## 重要提醒

- 不要急于给建议
- 不要使用任何命理、占卜、算命相关的词汇
- 不要过早进行深度分析
- 当用户充分表达后，如果他们看起来需要更深入的指导，你可以说类似：
  "我理解你的情况了。如果你愿意，我可以从更深层的角度帮你分析一下，看看有没有新的视角。你觉得呢？"

只输出你的回复，不要有任何其他内容。`;

/**
 * 评估是否准备好进入深度分析阶段
 */
const READINESS_ASSESSMENT_PROMPT = `你是一个对话分析助手。评估当前对话是否已经收集了足够的信息，可以进入深度分析阶段。

请分析对话历史和用户最新消息，判断：

1. 用户是否已经充分表达了自己的情况？
2. 用户是否表现出需要/期待更深层次的指导？
3. 用户的核心困扰领域是否清晰？（如：事业、感情、健康等）
4. 用户的情绪状态是否稳定到可以接受分析？

输出一个 JSON 对象：
{
  "readyForAnalysis": boolean,  // 是否准备好进入深度分析
  "confidence": number,          // 0-1 的置信度
  "reasoning": string,           // 简短说明理由
  "coreConcern": string,         // 用户核心关注点（如：事业发展、感情问题）
  "emotionalState": string,      // 用户当前情绪状态描述
  "informationGathered": {       // 已收集的信息
    "situation": string,         // 用户处境
    "duration": string,          // 问题持续时间（如果提到）
    "mainWorry": string          // 主要担忧
  },
  "suggestedTransition": string  // 如果准备进入分析，建议的过渡语
}

判断标准：

【readyForAnalysis = true 的情况】
- 用户明确询问建议/看法（如"你觉得我该怎么办"、"能帮我分析一下吗"）
- 用户表达了困惑并暗示需要方向（如"我不知道该怎么选择"）
- 用户已经充分倾诉，情绪相对平稳
- 对话已经进行了3轮以上，用户情况清晰

【readyForAnalysis = false 的情况】
- 用户刚开始倾诉，还在表达情绪
- 用户的问题还不清晰，需要更多信息
- 用户情绪很激动，需要更多倾听
- 对话刚开始（少于2轮）

只输出 JSON，不要有其他内容。`;

/**
 * 评估对话准备度
 * @param {Array} history - 对话历史
 * @param {string} currentInput - 当前用户输入
 * @returns {Promise<Object>} 评估结果
 */
async function assessReadiness(history, currentInput) {
  try {
    const llmClient = createDefaultLLMClient();

    // 构建对话历史
    const historyText = history.slice(-10).map(h =>
      `${h.role === 'user' ? '用户' : '咨询师'}：${h.content}`
    ).join('\n');

    const prompt = `${READINESS_ASSESSMENT_PROMPT}

【对话历史】
${historyText}

【用户最新消息】
${currentInput}

分析结果（只输出JSON）：`;

    const response = await llmClient.generate(prompt, {
      temperature: 0.1,
      maxTokens: 500
    });

    const responseText = response?.trim();

    // 解析 JSON
    let result;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = getDefaultAssessment();
      }
    } catch (parseError) {
      conversationLogger.warn(`[ConversationManager] 无法解析评估结果: ${responseText}`);
      result = getDefaultAssessment();
    }

    conversationLogger.info(`[ConversationManager] 准备度评估:`, {
      readyForAnalysis: result.readyForAnalysis,
      confidence: result.confidence,
      coreConcern: result.coreConcern
    });

    return result;

  } catch (error) {
    conversationLogger.error(`[ConversationManager] 评估失败: ${error.message}`);
    return getDefaultAssessment();
  }
}

/**
 * 获取默认评估结果
 */
function getDefaultAssessment() {
  return {
    readyForAnalysis: false,
    confidence: 0.3,
    reasoning: '评估失败，默认继续倾听',
    coreConcern: '',
    emotionalState: '未知',
    informationGathered: {
      situation: '',
      duration: '',
      mainWorry: ''
    },
    suggestedTransition: ''
  };
}

/**
 * 生成倾听与引导回复
 * @param {Array} history - 对话历史
 * @param {string} currentInput - 当前用户输入
 * @param {Object} assessment - 准备度评估结果
 * @returns {Promise<string>} 回复
 */
async function generateListeningResponse(history, currentInput, assessment) {
  try {
    const llmClient = createDefaultLLMClient();

    // 构建对话历史
    const historyText = history.slice(-6).map(h =>
      `${h.role === 'user' ? '用户' : '咨询师'}：${h.content}`
    ).join('\n');

    // 如果接近准备好，在 prompt 中提示
    let additionalGuidance = '';
    if (assessment.readyForAnalysis && assessment.confidence > 0.7) {
      additionalGuidance = `

【当前状态】用户似乎已经准备好接受更深入的帮助。你可以在回复末尾温和地提议：
"我理解你的情况了。如果你愿意，我可以从更深层的角度帮你分析一下，看看有没有新的视角。你觉得呢？"`;
    }

    const prompt = `${LISTENING_SYSTEM_PROMPT}${additionalGuidance}

【对话历史】
${historyText}

【用户最新消息】
${currentInput}

你的回复：`;

    const response = await llmClient.generate(prompt, {
      temperature: 0.7,
      maxTokens: 300
    });

    return response?.trim() || '我理解你的感受。能告诉我更多吗？';

  } catch (error) {
    conversationLogger.error(`[ConversationManager] 生成回复失败: ${error.message}`);
    return '我理解你的感受。能告诉我更多吗？';
  }
}

/**
 * Conversation Manager Node
 * 管理对话进程，决定使用倾听模式还是分析模式
 *
 * @param {Object} state - XiaoShuDongState
 * @returns {Promise<Object>} 更新后的状态
 */
export async function conversationManagerNode(state) {
  try {
    const currentInput = state.currentInput || '';
    const history = state.messages || [];

    conversationLogger.info(`[ConversationManager] 处理消息: "${currentInput.substring(0, 30)}..."`);

    // 评估对话准备度
    const assessment = await assessReadiness(history, currentInput);

    // 更新状态中的对话信息
    state.conversationAssessment = assessment;

    // 初始化对话阶段追踪
    if (!state.conversationPhase) {
      state.conversationPhase = {
        current: 'listening', // 'listening' | 'transition' | 'analysis'
        turnCount: 0,
        informationGathered: {}
      };
    }

    state.conversationPhase.turnCount += 1;

    // 更新收集的信息
    if (assessment.informationGathered) {
      state.conversationPhase.informationGathered = {
        ...state.conversationPhase.informationGathered,
        ...assessment.informationGathered
      };
    }

    // 决定对话阶段
    if (assessment.readyForAnalysis && assessment.confidence > 0.7) {
      // 准备进入分析阶段
      state.conversationPhase.current = 'transition';
      state.conversationPhase.coreConcern = assessment.coreConcern;
      state.conversationPhase.emotionalState = assessment.emotionalState;

      conversationLogger.info(`[ConversationManager] 进入过渡阶段，核心关注: ${assessment.coreConcern}`);

      // 设置标志，让 edges.js 路由到分析流程
      state.metadata.readyForAnalysis = true;
      state.metadata.analysisTransition = assessment.suggestedTransition;

    } else {
      // 继续倾听阶段
      state.conversationPhase.current = 'listening';
      state.metadata.readyForAnalysis = false;

      // 生成倾听回复
      const listeningResponse = await generateListeningResponse(history, currentInput, assessment);
      state.listeningResponse = listeningResponse;

      conversationLogger.info(`[ConversationManager] 继续倾听阶段，轮次: ${state.conversationPhase.turnCount}`);
    }

    // 记录元数据
    state.metadata.conversationManaged = true;
    state.metadata.conversationManagedAt = new Date();
    state.metadata.turnCount = state.conversationPhase.turnCount;

    return state;

  } catch (error) {
    conversationLogger.error('[ConversationManager] 处理失败:', error);

    // 设置默认状态
    state.metadata.readyForAnalysis = false;
    state.listeningResponse = '我理解你的感受。能告诉我更多吗？';

    if (state.addError) {
      state.addError(error);
    }

    return state;
  }
}

/**
 * 检查是否应该进入分析阶段
 * @param {Object} state - 对话状态
 * @returns {boolean}
 */
export function shouldEnterAnalysis(state) {
  return state.metadata?.readyForAnalysis === true;
}

/**
 * 获取当前对话阶段
 * @param {Object} state - 对话状态
 * @returns {string} 'listening' | 'transition' | 'analysis'
 */
export function getCurrentPhase(state) {
  return state.conversationPhase?.current || 'listening';
}

/**
 * 获取收集的信息摘要
 * @param {Object} state - 对话状态
 * @returns {Object}
 */
export function getGatheredInformation(state) {
  return state.conversationPhase?.informationGathered || {};
}

export default conversationManagerNode;
