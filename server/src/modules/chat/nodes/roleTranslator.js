/**
 * Role Translator Node for Rolecard Venting Upgrade
 * Transforms internal fortune analysis into role character's voice
 *
 * This node:
 * 1. Takes the fortune report from fortuneGenerator (internal, user never sees)
 * 2. Transforms it into the role character's natural speaking style
 * 3. Hides all fortune-telling terminology
 * 4. Outputs warm, supportive advice in character
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { getLLMService } from '../../../core/llm/index.js';
import logger from '../../../core/utils/logger.js';
import { configLoader } from '../../langgraph/configLoader.js';

const roleTranslatorLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, module: 'ROLE_TRANSLATOR' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, module: 'ROLE_TRANSLATOR' }),
  warn: (msg, meta = {}) => logger.warn(msg, { ...meta, module: 'ROLE_TRANSLATOR' }),
  debug: (msg, meta = {}) => logger.debug(msg, { ...meta, module: 'ROLE_TRANSLATOR' }),
};

/**
 * System prompt for role translator
 * This creates a transformation layer that converts fortune insights to role voice
 */
const ROLE_TRANSLATOR_SYSTEM_PROMPT = `你是一位语言转换专家，擅长将专业的分析内容转化为自然、亲切的对话风格。

## 你的任务
你会收到一份内部分析报告（包含深奥的人生洞察）。你的任务是将这份报告转化为特定角色口吻的自然对话。

## 绝对禁止（重要！）
- 绝对不要提及"命理"、"算命"、"占卜"、"预测"等词汇
- 绝对不要提及"命盘"、"星盘"、"宫位"、"星曜"、"天干地支"等专业术语
- 绝对不要提及"紫微"、"天府"、"贪狼"、"七杀"等任何星名
- 绝对不要说"根据命盘"、"从运势来看"、"你的命宫坐"等话术

## 转换原则
1. **理解核心洞察** - 提取分析报告中的核心观点
2. **用生活语言重述** - 将专业术语转化为日常表达
3. **保持角色口吻** - 用角色的说话风格和语气
4. **自然亲切** - 让听者感觉是在和朋友聊天，而不是听专家讲座

## 转换示例
- "命宫坐紫微星，主贵显" → "我看你这个人很有领导范儿，天生就有一股不服输的劲头"
- "流年事业宫见武曲星" → "最近事业上感觉挺顺的吧，机会挺多的"
- "财运旺盛" → "钱这方面应该不用太担心，慢慢积累就会有收获"
- "感情运势不佳" → "感情这事儿可能需要多一点耐心，急不来的"

## 角色信息
{rolePersona}

请基于以上原则，将收到的内部分析报告转换为角色的自然对话。`;

/**
 * Default role translator prompt when hideFortuneTerms is true
 */
const DEFAULT_HIDE_TERMS_CONFIG = {
  hideFortuneTerms: true,
  preserveCoreInsights: true,
  naturalLanguageOnly: true
};

/**
 * Fortune-telling terms to filter out
 */
const FORBIDDEN_FORTUNE_TERMS = [
  '命理分析', '算命', '占卜', '星盘', '命盘',
  '紫微星', '天府星', '贪狼星', '武曲星', '天相星',
  '太阳星', '太阴星', '七杀星', '破军星', '廉贞星',
  '天机星', '天同星', '天梁星', '巨门星',
  '命宫', '身宫', '流年', '大限', '小限',
  '宫位', '星曜', '天干', '地支', '四化',
  '禄存', '擎羊', '陀罗', '火星', '铃星',
  '地空', '地劫', '左辅', '右弼', '天魁', '天钺'
];

/**
 * Build the user prompt for role translation
 * @param {string} fortuneResponse - Fortune analysis from fortuneGenerator
 * @param {string} userQuestion - User's original question
 * @param {Object} state - Full state for context
 * @returns {string} Formatted prompt
 */
function buildTranslationPrompt(fortuneResponse, userQuestion, state) {
  let prompt = '';

  // Add context about user's situation
  if (state.listeningAssessment?.coreConcern) {
    prompt += `【用户关注点】\n${state.listeningAssessment.coreConcern}\n\n`;
  }

  if (state.listeningAssessment?.emotionalState) {
    prompt += `【用户情绪状态】\n${state.listeningAssessment.emotionalState}\n\n`;
  }

  // Add the internal analysis (this is the secret sauce)
  prompt += `【内部分析报告】(仅供参考，需转化为角色语言)\n`;
  prompt += `${fortuneResponse}\n\n`;

  // Add user's question
  if (userQuestion) {
    prompt += `【用户的问题】\n${userQuestion}\n\n`;
  }

  // Instructions
  prompt += `请基于以上信息，以角色的口吻给出分析和建议。`;
  prompt += `记住：不要直接引用分析报告中的专业术语，要用自然的日常语言重新表述。`;
  prompt += `让用户感觉像是你在和他聊天，而不是在做咨询。`;

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

  return persona;
}

/**
 * Filter out any accidentally leaked fortune-telling keywords
 * This is a safety net
 * @param {string} text - Text to filter
 * @returns {string} Filtered text
 */
function filterFortuneKeywords(text) {
  if (!text) return '';

  let filtered = text;

  // Check and warn if forbidden terms are found
  for (const term of FORBIDDEN_FORTUNE_TERMS) {
    if (filtered.includes(term)) {
      roleTranslatorLogger.warn(`[RoleTranslator] Filtering leaked term: ${term}`);
      // Replace with generic terms
      filtered = filtered.split(term).join('特质');
    }
  }

  // Replace common fortune-telling phrases
  const replacements = [
    ['根据你的命盘', '从你的性格来看'],
    ['从命盘来看', '我觉得'],
    ['从运势来看', '从现在的情况看'],
    ['运势', '状态'],
    ['命宫', '内在核心'],
    ['流年', '这一年'],
    ['大限', '这个阶段'],
    ['小限', '最近']
  ];

  for (const [oldTerm, newTerm] of replacements) {
    filtered = filtered.split(oldTerm).join(newTerm);
  }

  return filtered;
}

/**
 * Generate fallback response when main translation fails
 * @param {Object} state - Conversation state
 * @returns {string} Fallback response
 */
function generateFallbackResponse(state) {
  const emotionalState = state.listeningAssessment?.emotionalState || '未知';
  const coreConcern = state.listeningAssessment?.coreConcern || '';

  if (emotionalState === '焦虑' || emotionalState === 'high') {
    return `我能感受到你现在有些焦虑。别担心，每个人都会有这样的时候。

从你说的${coreConcern}来看，我觉得你其实很有想法，只是现在可能有点不确定。慢慢来，不用着急做决定。

有什么具体想聊的吗？我一直都在。`;
  }

  if (emotionalState === '迷茫' || emotionalState === 'medium') {
    return `听起来你现在有些迷茫，不知道该往哪个方向走。这种感觉很正常，我也有过这样的时刻。

从你描述的情况看，你在认真思考自己的人生，这其实是件好事。说明你想要变得更好。

要不你多跟我说说你的想法？我们一起梳理一下。`;
  }

  // Default fallback
  return `我理解你现在的感受。每个人的人生都会遇到需要思考和选择的时刻。

从你分享的内容来看，你正在面对一个对你来说很重要的事。我想告诉你的是，无论结果如何，你都有能力应对。

如果你愿意，可以和我多分享一些你的想法。我会陪着你的。`;
}

/**
 * Role Translator Node
 * Transforms fortune analysis into role character's voice
 *
 * @param {ConversationState} state - Conversation state
 * @param {Object} config - Configuration options
 * @param {boolean} config.hideFortuneTerms - Whether to hide fortune terms (default: true)
 * @returns {Promise<ConversationState>} Updated state with translated response
 */
export async function roleTranslatorNode(state, config = DEFAULT_HIDE_TERMS_CONFIG) {
  try {
    // Check if we have fortune response to work with
    if (!state.fortuneResponse || state.fortuneResponse.length === 0) {
      roleTranslatorLogger.warn('[RoleTranslator] 没有命理分析，生成备用回复');
      state.translatedResponse = generateFallbackResponse(state);
      state.metadata.roleTranslation = false;
      state.metadata.roleTranslationError = 'No fortune response available';
      return state;
    }

    // 算命预测分支：不隐藏命理术语，以角色口吻直接输出
    // 倾诉-倾听分支：隐藏命理术语
    const isFortuneTellingBranch = state.metadata?.intent === 'fortune_telling';
    const hideFortuneTerms = isFortuneTellingBranch
      ? false
      : (config.hideFortuneTerms !== false);

    roleTranslatorLogger.info(
      `[RoleTranslator] 开始角色转换: ${state.userId}, ` +
      `分支: ${isFortuneTellingBranch ? '算命预测' : '倾诉倾听'}, ` +
      `隐藏术语: ${hideFortuneTerms}`
    );

    const userQuestion = state.currentInput || '';
    const roleCard = state.roleCard || {};

    // Build system prompt with role persona
    const rolePersona = formatRolePersona(roleCard);
    const systemPrompt = ROLE_TRANSLATOR_SYSTEM_PROMPT.replace('{rolePersona}', rolePersona);

    // Get system prompt from config if available
    const configSystemPrompt = configLoader.getPrompt('rolecard', 'role_translator');
    const finalSystemPrompt = configSystemPrompt
      ? `${configSystemPrompt}\n\n${rolePersona}`
      : systemPrompt;

    // Build user prompt
    const userPrompt = buildTranslationPrompt(state.fortuneResponse, userQuestion, state);

    // Get LLM service (uses env config: LLM_BACKEND)
    const llmService = getLLMService();

    // Get LLM config from configLoader
    const nodeConfig = configLoader.getNodeConfig('rolecard', 'role_translator');
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

    let translatedResponse = response.content;

    // Safety check: filter fortune terms if configured
    if (hideFortuneTerms) {
      translatedResponse = filterFortuneKeywords(translatedResponse);
    }

    state.translatedResponse = translatedResponse;
    state.metadata.roleTranslation = true;
    state.metadata.roleTranslationAt = new Date();
    state.metadata.translatedResponseLength = translatedResponse.length;
    state.metadata.hideFortuneTerms = hideFortuneTerms;

    roleTranslatorLogger.info(
      `[RoleTranslator] 角色转换完成 (${translatedResponse.length} 字符)`
    );

    return state;
  } catch (error) {
    roleTranslatorLogger.error('[RoleTranslator] 转换失败:', error);
    state.translatedResponse = generateFallbackResponse(state);
    state.metadata.roleTranslation = false;
    state.metadata.roleTranslationError = error.message;

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
export function getTranslatedResponse(state) {
  return state.translatedResponse || '';
}

/**
 * Check if role translation was successful
 * @param {ConversationState} state - Conversation state
 * @returns {boolean}
 */
export function hasTranslatedResponse(state) {
  return state.metadata?.roleTranslation === true && state.translatedResponse;
}

/**
 * Check if fortune terms are hidden
 * @param {ConversationState} state - Conversation state
 * @returns {boolean}
 */
export function isHidingFortuneTerms(state) {
  return state.metadata?.hideFortuneTerms !== false;
}

export default roleTranslatorNode;
