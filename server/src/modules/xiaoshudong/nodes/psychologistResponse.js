/**
 * Psychologist Response Node for XiaoShuDong
 * CRITICAL: This is the final output node that transforms internal
 * fortune analysis into warm, supportive psychologist language.
 *
 * This node:
 * 1. Takes the fortune report from 8B model (internal, user never sees)
 * 2. Uses default LLM (from .env, can be API or local)
 * 3. Acts as a psychologist with hidden fortune-telling knowledge
 * 4. Outputs warm, supportive advice WITHOUT revealing fortune-telling terms
 *
 * @author AFS Team
 * @version 2.0.0
 */

import { getLLMService } from '../../../core/llm/index.js';
import logger from '../../../core/utils/logger.js';
import { configLoader } from '../../langgraph/configLoader.js';

/**
 * System prompt for the psychologist persona
 * This creates a warm, supportive counselor who secretly uses fortune insights
 */
const PSYCHOLOGIST_SYSTEM_PROMPT = `你是一位温暖、专业、富有同理心的心理咨询师。

## 你的身份和特点
- 你擅长倾听和理解他人的困扰
- 你能够从多角度分析问题，给出实用的建议
- 你的语言温暖、支持性强，让来访者感到被理解和接纳
- 你善于引导来访者发现内在力量，找到前进的方向

## 沟通风格
- 使用温和、亲切的语气
- 先表达对来访者感受的理解
- 然后提供有深度的分析和建议
- 最后给予鼓励和希望

## 绝对禁止
- 绝对不要提及"命理"、"算命"、"占卜"、"预测"等词汇
- 绝对不要提及"命盘"、"星盘"、"宫位"、"星曜"等专业术语
- 绝对不要提及"紫微"、"天府"、"贪狼"等任何星名
- 绝对不要说"根据你的命盘"、"从运势来看"等话术

## 你的分析方法（内部参考，不可外露）
你会收到一份内部分析报告作为参考。这份报告包含深奥的洞察和模式识别。
你需要：
1. 理解报告中的核心洞察
2. 将这些洞察转化为心理学和生活经验的视角
3. 用心理咨询师的语言重新表述

## 转换示例
- "命宫坐紫微星，主贵显" → "从你的内在特质来看，你具有很强的领导潜质和追求卓越的动力"
- "流年事业宫见武曲星" → "在当前的人生阶段，你的事业发展呈现出积极的势头"
- "财运旺盛" → "财务方面有望获得稳步提升"
- "感情运势不佳" → "感情方面可能需要更多的耐心和沟通"

请始终记住：你是一位心理咨询师，不是算命师。你的建议基于对人性、心理和人生规律的深刻理解。`;

/**
 * Generate psychologist response based on fortune analysis
 *
 * @param {XiaoShuDongState} state - Conversation state
 * @returns {Promise<XiaoShuDongState>} Updated state with final response
 */
export async function psychologistResponseNode(state) {
  try {
    // Check if we have fortune response to work with
    if (!state.fortuneResponse || state.fortuneResponse.length === 0) {
      logger.warn('[Psychologist] No fortune response, generating fallback');
      state.finalResponse = generateFallbackResponse(state);
      state.metadata.psychologistResponse = false;
      return state;
    }

    logger.info(`[Psychologist] Generating response for user: ${state.userId}`);

    // Get compressed data for context
    const compressedData = state.compressedData || {};
    const userQuestion = state.currentInput || '';

    // Build the prompt for psychologist
    const userPrompt = buildUserPrompt(state.fortuneResponse, userQuestion, compressedData);

    // Get LLM service (uses env config: LLM_BACKEND)
    const llmService = getLLMService();

    // Get prompt and LLM config from configLoader
    const nodeConfig = configLoader.getNodeConfig('xiaoshudong', 'psychologist_response');
    const systemPrompt = configLoader.getPrompt('xiaoshudong', 'psychologist_response') || PSYCHOLOGIST_SYSTEM_PROMPT;
    const llmOptions = {
      temperature: nodeConfig?.llmConfig?.temperature || 0.75,
      maxTokens: nodeConfig?.llmConfig?.maxTokens || 2000
    };

    const response = await llmService.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: llmOptions.temperature,
      maxTokens: llmOptions.maxTokens
    });

    let finalResponse = response.content;

    // Safety check: filter any accidentally leaked fortune terms
    finalResponse = filterFortuneKeywords(finalResponse);

    state.finalResponse = finalResponse;
    state.metadata.psychologistResponse = true;
    state.metadata.psychologistResponseAt = new Date();
    state.metadata.finalResponseLength = finalResponse.length;

    logger.info(`[Psychologist] Response generated (${finalResponse.length} chars)`);

    return state;
  } catch (error) {
    logger.error('[Psychologist] Failed to generate response:', error);
    state.addError(error);

    // Fall back to filtered fortune response
    state.finalResponse = generateFallbackResponse(state);
    state.metadata.psychologistResponse = false;
    state.metadata.psychologistError = error.message;

    return state;
  }
}

/**
 * Build the user prompt with fortune analysis context
 *
 * @param {string} fortuneResponse - Fortune analysis from 8B model
 * @param {string} userQuestion - User's original question
 * @param {Object} compressedData - Compressed conversation data
 * @returns {string} Formatted prompt
 */
function buildUserPrompt(fortuneResponse, userQuestion, compressedData) {
  let prompt = '';

  // Add context about the user's situation
  if (compressedData.eventSummary) {
    prompt += `【来访者情况】\n${compressedData.eventSummary}\n\n`;
  }

  if (compressedData.emotionalState) {
    prompt += `【当前情绪状态】\n${compressedData.emotionalState}\n\n`;
  }

  if (compressedData.coreConcerns && compressedData.coreConcerns.length > 0) {
    prompt += `【核心关注点】\n${compressedData.coreConcerns.join('、')}\n\n`;
  }

  // Add the internal analysis (this is the secret sauce)
  prompt += `【内部分析报告】(仅供参考，需转化为心理咨询语言)\n`;
  prompt += `${fortuneResponse}\n\n`;

  // Add user's question
  if (userQuestion) {
    prompt += `【来访者的问题】\n${userQuestion}\n\n`;
  }

  // Instructions
  prompt += `请基于以上信息，以温暖、专业的心理咨询师身份，给出你的分析和建议。`;
  prompt += `记住：不要直接引用分析报告中的专业术语，要用心理咨询的语言重新表述。`;

  return prompt;
}

/**
 * Filter out any accidentally leaked fortune-telling keywords
 * This is a safety net
 *
 * @param {string} text - Text to filter
 * @returns {string} Filtered text
 */
function filterFortuneKeywords(text) {
  if (!text) return '';

  // Keywords that should never appear
  const forbiddenTerms = [
    '命理分析', '算命', '占卜', '星盘', '命盘',
    '紫微星', '天府星', '贪狼星', '武曲星', '天相星',
    '太阳星', '太阴星', '七杀星', '破军星', '廉贞星',
    '天机星', '天同星', '天梁星', '巨门星'
  ];

  let filtered = text;

  // Check and warn if forbidden terms are found
  for (const term of forbiddenTerms) {
    if (filtered.includes(term)) {
      logger.warn(`[Psychologist] Filtering leaked term: ${term}`);
      // Replace with generic terms
      filtered = filtered.split(term).join('内在特质');
    }
  }

  // Replace common fortune-telling phrases
  const replacements = [
    ['根据你的命盘', '从你的内在特质来看'],
    ['从命盘来看', '从心理分析的角度'],
    ['运势', '状态'],
    ['命宫', '内在核心'],
    ['流年', '当前阶段'],
    ['大限', '人生阶段'],
    ['小限', '近期']
  ];

  for (const [oldTerm, newTerm] of replacements) {
    filtered = filtered.split(oldTerm).join(newTerm);
  }

  return filtered;
}

/**
 * Generate fallback response when main generation fails
 *
 * @param {XiaoShuDongState} state - Conversation state
 * @returns {string} Fallback response
 */
function generateFallbackResponse(state) {
  const compressedData = state.compressedData || {};

  if (compressedData.emotionalState === '焦虑') {
    return `我能感受到你现在有些焦虑。这是很正常的情绪，每个人在面对不确定性时都会有这样的感受。

让我来帮你梳理一下。从你描述的情况来看，你正在经历一个需要做出选择的阶段。这种时候，我们可以试着：

1. **先接纳自己的情绪** - 焦虑本身并不可怕，它提醒我们在乎这件事
2. **理清核心需求** - 问问自己，这件事对你来说最重要的是什么？
3. **分步骤行动** - 把大目标拆成小步骤，一步步来

你愿意和我多聊聊你的具体担忧吗？这样我能更好地帮助你。`;
  }

  if (compressedData.emotionalState === '迷茫') {
    return `听起来你现在有些迷茫，不知道该往哪个方向走。这种感觉很正常，人生的很多阶段都会有这样的时刻。

从你的描述中，我能感觉到你在认真思考自己的人生方向。这是一个积极的信号，说明你在寻求成长和改变。

我想问你几个问题，帮助你更清晰地看到自己的内心：
- 如果不考虑现实的限制，你最想做什么？
- 现在的迷茫，主要是来自哪方面的担忧？

慢慢来，我们一起梳理。`;
  }

  // Default fallback
  return `我理解你现在的感受。每个人的人生都会遇到需要思考和选择的时刻。

从你分享的内容来看，你正在面对一个对你来说很重要的议题。我想告诉你的是，无论结果如何，你都有能力应对。

如果你愿意，可以和我多分享一些你的想法和担忧。我会尽我所能帮助你找到内心的答案。`;
}

/**
 * Check if psychologist response is available
 */
export function hasPsychologistResponse(state) {
  return state.metadata?.psychologistResponse === true && state.finalResponse;
}

/**
 * Get final response from state
 */
export function getFinalResponse(state) {
  return state.finalResponse || '';
}

export default psychologistResponseNode;
