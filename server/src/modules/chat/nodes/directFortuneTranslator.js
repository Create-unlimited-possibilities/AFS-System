/**
 * Direct Fortune Translator Node for Fortune Telling Branch
 * Transforms fortune analysis into role character's voice while KEEPING terminology
 *
 * This node:
 * 1. Takes the fortune report from directFortuneAnalyzer
 * 2. Transforms it into the role character's natural speaking style
 * 3. KEEPS fortune-telling terminology visible (unlike venting branch)
 * 4. Briefly explains terms in simple language
 * 5. Outputs warm, knowledgeable advice in character
 *
 * Design: 70% character personality + 30% fortune terminology
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { getLLMService } from '../../../core/llm/index.js';
import logger from '../../../core/utils/logger.js';
import { configLoader } from '../../langgraph/configLoader.js';

const fortuneTranslatorLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, module: 'DIRECT_FORTUNE_TRANSLATOR' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, module: 'DIRECT_FORTUNE_TRANSLATOR' }),
  warn: (msg, meta = {}) => logger.warn(msg, { ...meta, module: 'DIRECT_FORTUNE_TRANSLATOR' }),
  debug: (msg, meta = {}) => logger.debug(msg, { ...meta, module: 'DIRECT_FORTUNE_TRANSLATOR' }),
};

/**
 * System prompt for direct fortune translator
 * Designed for fortune telling branch - KEEPS terminology visible
 * Balance: 70% character personality + 30% fortune terminology
 */
const DIRECT_FORTUNE_TRANSLATOR_SYSTEM_PROMPT = `你是一位精通紫微斗数的朋友，同时也是用户熟悉的那个人（角色）。你的任务是将内部分析报告转化为你的说话风格，同时保留命理术语让用户能学到东西。

## 你的任务步骤
1. 首先理解分析报告中的核心命理信息（命宫、主星、宫位含义）
2. 用你自己的说话方式重新组织这些内容
3. 在提及命理术语时，用一句简单的话解释它的含义
4. 保持你一贯的性格和说话节奏，不要变成"算命先生"

## 必须做到 (DO)
- 保留命理术语：命宫、主星名称（紫微、天府、贪狼、七杀、破军、武曲、天相、天机、天同、天梁、廉贞、太阴、太阳、巨门）、十二宫位名、四化（禄、权、科、忌）
- 简要解释术语："紫微星是帝星，代表领导力"、"命宫就是你的核心性格"
- 用角色的口头禅、语气词、说话节奏
- 像聊天一样自然："诶我跟你说"、"你知道吗"、"其实呢"
- 结合角色经历或观点来解读："就像我之前跟你说的那样..."
- 适当互动："你觉得呢？"、"是不是有点道理？"

## 绝对不要 (DON'T)
- 不要完全隐藏术语（这是倾诉模式的做法，算命模式要显示）
- 不要变成教科书式讲解（"紫微斗数是中国传统命理学..."）
- 不要使用神秘兮兮的语气（"天机不可泄露"、"让我看看你的命盘..."）
- 不要过于正式或专业（"根据命盘分析，您的命宫..."）
- 不要忽略角色的个性（如果角色是活泼的，就要保持活泼）

## 示例

### 好的例子 (角色为主，术语点缀)
"诶，我看了下你的命盘，挺有意思的！你的命宫有紫微星诶，这个星叫帝星，就是那种天生有领导范儿的感觉。而且你的财帛宫有武曲星，这个星管钱的，所以你对理财这块应该还挺有想法的吧？"

### 好的例子 (简洁解释术语)
"你知道吗，你的夫妻宫有天同星，这个星比较温和，代表感情里你可能会比较包容对方。不过天梁星也在旁边，这个星有点像长辈的感觉，所以你找对象可能会偏向成熟稳重的类型？"

### 要避免的例子 (太正式)
"根据紫微斗数命盘分析，您的命宫坐紫微星，此星为十四主星之首，代表尊贵与领导..."  ← 太像算命先生了

### 要避免的例子 (完全隐藏术语)
"我看你这个人挺有领导能力的，而且理财方面也不错..."  ← 这是倾诉模式的风格，算命模式要显示术语

## 角色信息
{rolePersona}

请以你的角色口吻，结合命理分析，给用户一个温暖、有料、又像朋友聊天的回复。`;

/**
 * Build the user prompt for direct fortune translation
 * @param {string} fortuneResponse - Fortune analysis from directFortuneAnalyzer
 * @param {string} userQuestion - User's original question
 * @param {Object} state - Full state for context
 * @returns {string} Formatted prompt
 */
function buildDirectFortunePrompt(fortuneResponse, userQuestion, state) {
  let prompt = '';

  // Add user's question
  if (userQuestion) {
    prompt += `【用户的问题】\n${userQuestion}\n\n`;
  }

  // Add the fortune analysis
  prompt += `【命理分析报告】\n`;
  prompt += `${fortuneResponse}\n\n`;

  // Instructions
  prompt += `请以你的角色口吻，结合上面的命理分析来回答用户的问题。`;
  prompt += `记住：要保留命理术语并简单解释，用你平时说话的方式，像朋友聊天一样。`;

  return prompt;
}

/**
 * Format role persona for prompt
 * @param {Object} roleCard - Role card data
 * @returns {string} Formatted role persona
 */
function formatRolePersona(roleCard) {
  if (!roleCard) {
    return '你是一个温暖、善解人意的朋友。';
  }

  let persona = `你是${roleCard.personality || '一个温暖的朋友'}。\n`;

  if (roleCard.background) {
    persona += `\n背景: ${roleCard.background}\n`;
  }

  if (roleCard.communicationStyle) {
    persona += `\n说话风格: ${roleCard.communicationStyle}\n`;
  }

  if (roleCard.interests && roleCard.interests.length > 0) {
    persona += `\n兴趣: ${roleCard.interests.join('、')}\n`;
  }

  // Add relationship context if available
  if (roleCard.relationshipToUser) {
    persona += `\n与用户的关系: ${roleCard.relationshipToUser}\n`;
  }

  return persona;
}

/**
 * Generate fallback response when main translation fails
 * @param {Object} state - Conversation state
 * @returns {string} Fallback response
 */
function generateFallbackResponse(state) {
  const userQuestion = state.currentInput || '';

  return `关于你问的"${userQuestion}"这个问题，我看了看你的命盘，感觉还是挺有说法的。

不过刚才分析的时候出了点小问题，要不你换个方式再问问？或者跟我说说你想了解的具体方面？

反正你的命盘我看着挺有意思的，肯定能聊出点东西来！`;
}

/**
 * Direct Fortune Translator Node
 * Transforms fortune analysis into role character's voice while KEEPING terminology
 *
 * @param {ConversationState} state - Conversation state
 * @param {Object} config - Configuration options
 * @returns {Promise<ConversationState>} Updated state with translated response
 */
export async function directFortuneTranslatorNode(state, config = {}) {
  try {
    // Check if we have fortune response to work with
    if (!state.fortuneResponse || state.fortuneResponse.length === 0) {
      fortuneTranslatorLogger.warn('[DirectFortuneTranslator] 没有命理分析，生成备用回复');
      state.translatedResponse = generateFallbackResponse(state);
      state.metadata.fortuneTranslation = false;
      state.metadata.fortuneTranslationError = 'No fortune response available';
      return state;
    }

    fortuneTranslatorLogger.info(
      `[DirectFortuneTranslator] 开始算命口吻转换: ${state.userId}`
    );

    const userQuestion = state.currentInput || '';
    const roleCard = state.roleCard || {};

    // Build system prompt with role persona
    const rolePersona = formatRolePersona(roleCard);
    const systemPrompt = DIRECT_FORTUNE_TRANSLATOR_SYSTEM_PROMPT.replace('{rolePersona}', rolePersona);

    // Get system prompt from config if available
    const configSystemPrompt = configLoader.getPrompt('rolecard', 'direct_fortune_translator');
    const finalSystemPrompt = configSystemPrompt
      ? configSystemPrompt.replace('{rolePersona}', rolePersona)
      : systemPrompt;

    // Build user prompt
    const userPrompt = buildDirectFortunePrompt(state.fortuneResponse, userQuestion, state);

    // Get LLM service
    const llmService = getLLMService();

    // Get LLM config from configLoader
    const nodeConfig = configLoader.getNodeConfig('rolecard', 'direct_fortune_translator');
    const llmOptions = {
      temperature: nodeConfig?.llmConfig?.temperature || 0.8,
      maxTokens: nodeConfig?.llmConfig?.maxTokens || 2000
    };

    const response = await llmService.chat({
      messages: [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: llmOptions.temperature,
      maxTokens: llmOptions.maxTokens
    });

    const translatedResponse = response.content;

    state.translatedResponse = translatedResponse;
    state.metadata.fortuneTranslation = true;
    state.metadata.fortuneTranslationAt = new Date();
    state.metadata.translatedResponseLength = translatedResponse.length;
    state.metadata.hideFortuneTerms = false; // This branch shows terms

    fortuneTranslatorLogger.info(
      `[DirectFortuneTranslator] 算命口吻转换完成 (${translatedResponse.length} 字符)`
    );

    return state;
  } catch (error) {
    fortuneTranslatorLogger.error('[DirectFortuneTranslator] 转换失败:', error);
    state.translatedResponse = generateFallbackResponse(state);
    state.metadata.fortuneTranslation = false;
    state.metadata.fortuneTranslationError = error.message;

    if (state.addError) {
      state.addError(error);
    }

    return state;
  }
}

/**
 * Get translated response from state
 * @param {ConversationState} state - Conversation state
 * @returns {string} Translated response
 */
export function getDirectFortuneResponse(state) {
  return state.translatedResponse || '';
}

/**
 * Check if direct fortune translation was successful
 * @param {ConversationState} state - Conversation state
 * @returns {boolean}
 */
export function hasDirectFortuneResponse(state) {
  return state.metadata?.fortuneTranslation === true && state.translatedResponse;
}

export default directFortuneTranslatorNode;
