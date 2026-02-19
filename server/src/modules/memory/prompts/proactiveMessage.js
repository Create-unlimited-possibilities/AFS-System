/**
 * Proactive Message Prompts
 * Prompts for generating personality-driven proactive messages
 *
 * @author AFS Team
 * @version 1.0.0
 */

/**
 * Prompt for generating a proactive message based on pending topic
 * Input: roleCardPersonality, pendingTopic, daysSinceLastChat
 */
export const PROACTIVE_MESSAGE_PROMPT = `你是一个角色卡的对话助手。根据角色卡的性格特点和待跟进话题，生成一条自然的主动问候消息。

## 输入信息

### 角色卡性格
{roleCardPersonality}

### 待跟进话题
话题: {topic}
背景: {context}
建议跟进: {suggestedFollowUp}

### 距上次聊天
{daysSinceLastChat} 天

## 任务

1. 分析角色卡性格，确定说话风格（随意/正式/活泼/温暖）
2. 判断现在是否是提及此话题的好时机
3. 生成一条20-50个中文字符的自然消息
4. 消息应该符合角色性格，不过于突兀

## 输出格式

请以JSON格式输出，包含以下字段：
{
  "message": "生成的消息文本（20-50个中文字符）",
  "style": "消息风格（casual/formal/playful/warm）",
  "reasoning": "简短解释为什么选择这种风格和消息内容",
  "topicIntroduced": true/false,
  "alternativeMessages": ["备选消息1", "备选消息2"]
}

注意：
- 消息要自然，像真实聊天
- 符合角色性格特点
- 不要太长，简洁有力
- 如果距上次聊天较久，可以先寒暄再引入话题`;

/**
 * Prompt for deciding whether to send a proactive message now
 * Input: roleCardPersonality, daysSinceLastChat, pendingTopicCount, urgency
 */
export const TIMING_DECISION_PROMPT = `你是一个消息发送时机决策助手。根据角色卡性格和当前情况，决定是否应该发送主动消息。

## 输入信息

### 角色卡性格
{roleCardPersonality}

### 当前情况
- 距上次聊天: {daysSinceLastChat} 天
- 待跟进话题数量: {pendingTopicCount}
- 最高优先级: {urgency}

## 决策规则

1. 如果距上次聊天少于1天，通常不发送（除非高优先级话题）
2. 如果距上次聊天1-3天，中高优先级话题可以考虑发送
3. 如果距上次聊天超过3天，适合发送问候
4. 角色性格会影响决策：
   - 热情外向的性格更可能主动联系
   - 内向矜持的性格会更谨慎
   - 关系亲密程度也会影响

## 输出格式

请以JSON格式输出：
{
  "shouldSend": true/false,
  "reasoning": "简短解释决策理由",
  "bestTiming": "如果现在不发送，建议的最佳时机",
  "confidence": 0.0-1.0
}

注意：confidence表示对决策的确定程度`;

/**
 * Build the proactive message prompt with variables
 * @param {Object} params - Prompt parameters
 * @param {string} params.roleCardPersonality - Role card personality description
 * @param {Object} params.pendingTopic - Pending topic object
 * @param {number} params.daysSinceLastChat - Days since last chat
 * @returns {string} Formatted prompt
 */
export function buildProactiveMessagePrompt(params) {
  const { roleCardPersonality, pendingTopic, daysSinceLastChat } = params;

  return PROACTIVE_MESSAGE_PROMPT
    .replace('{roleCardPersonality}', roleCardPersonality || '未提供')
    .replace('{topic}', pendingTopic?.topic || '未提供')
    .replace('{context}', pendingTopic?.context || '无')
    .replace('{suggestedFollowUp}', pendingTopic?.suggestedFollowUp || '无')
    .replace('{daysSinceLastChat}', String(daysSinceLastChat ?? 0));
}

/**
 * Build the timing decision prompt with variables
 * @param {Object} params - Prompt parameters
 * @param {string} params.roleCardPersonality - Role card personality description
 * @param {number} params.daysSinceLastChat - Days since last chat
 * @param {number} params.pendingTopicCount - Number of pending topics
 * @param {string} params.urgency - Highest urgency level
 * @returns {string} Formatted prompt
 */
export function buildTimingDecisionPrompt(params) {
  const { roleCardPersonality, daysSinceLastChat, pendingTopicCount, urgency } = params;

  return TIMING_DECISION_PROMPT
    .replace('{roleCardPersonality}', roleCardPersonality || '未提供')
    .replace('{daysSinceLastChat}', String(daysSinceLastChat ?? 0))
    .replace('{pendingTopicCount}', String(pendingTopicCount ?? 0))
    .replace('{urgency}', urgency || 'medium');
}

/**
 * Style mapping for Chinese descriptions
 */
export const STYLE_DESCRIPTIONS = {
  casual: '随意轻松',
  formal: '正式礼貌',
  playful: '活泼俏皮',
  warm: '温暖关怀'
};

/**
 * Urgency level mapping
 */
export const URGENCY_LEVELS = {
  high: '高优先级',
  medium: '中等优先级',
  low: '低优先级'
};

export default {
  PROACTIVE_MESSAGE_PROMPT,
  TIMING_DECISION_PROMPT,
  buildProactiveMessagePrompt,
  buildTimingDecisionPrompt,
  STYLE_DESCRIPTIONS,
  URGENCY_LEVELS
};
