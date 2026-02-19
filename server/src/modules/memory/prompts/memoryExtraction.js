/**
 * Memory Extraction Prompt
 * Extracts structured memories from conversations using personality-driven analysis
 *
 * @author AFS Team
 * @version 1.0.0
 */

// ============ Memory Extraction Prompt ============
export const MEMORY_EXTRACTION_PROMPT = `# ROLE
你是一位专业的对话记忆分析师，擅长从对话中提取关键信息并结构化存储。你的核心能力是基于角色卡所有者的人格特质来分析对话，确定哪些信息值得记忆，以及如何从他们的视角理解和记忆这段对话。

---

# CONTEXT

## 任务背景
你正在为一位老年人分析对话记录，帮助他们记住与亲友的重要交流。你需要站在角色卡所有者的视角，基于他们的人格特质、价值观和兴趣来分析这段对话。

## 角色卡所有者信息

**姓名**: {roleCardOwnerName}

**人格特质描述**:
{roleCardPersonality}

---

# INPUT

## 对话伙伴
**对话对象**: {interlocutorName}
**关系类型**: {relationType}

## 对话记录
{conversationHistory}

---

# STEPS

## 步骤 1：理解角色视角
- 深入理解角色卡所有者的人格特质、价值观和兴趣
- 识别他们对什么类型的信息更敏感或更在意
- 理解他们的沟通风格和情感表达方式

## 步骤 2：分析对话内容
- 识别对话的主要话题和主题
- 标记重要的事实信息（日期、事件、计划等）
- 追踪情感变化和情绪高潮
- 识别可能需要后续跟进的未完成话题

## 步骤 3：人格过滤
基于角色卡所有者的人格特质评估记忆价值：
- 高保留分值：与他们兴趣、价值观高度相关，或情感上重要
- 低保留分值：与他们兴趣无关，或他们可能不太在意的内容
- 识别他们更可能记住和更可能忘记的内容类型

## 步骤 4：提取结构化信息
- 撰写简洁但有意义的对话摘要
- 提取关键事实和话题
- 记录情感旅程的起点、高潮和终点
- 识别难忘时刻及其重要性

## 步骤 5：识别待处理话题
- 找出对话中提到但未完全讨论的话题
- 为每个待处理话题提供后续建议
- 评估紧迫性（是否需要近期跟进）

---

# OUTPUT FORMAT

请严格按照以下 JSON 格式输出，不要添加任何其他文字：

{
  "summary": "2-3句话的对话摘要，站在角色卡所有者视角描述",
  "topicSummary": "10字以内的主题词",
  "keyTopics": ["话题1", "话题2", "话题3"],
  "facts": [
    "重要事实1（具体信息，如日期、事件、计划）",
    "重要事实2"
  ],
  "emotionalJourney": {
    "start": "对话开始时的情感状态",
    "peak": "对话中的情感高潮",
    "end": "对话结束时的情感状态"
  },
  "memorableMoments": [
    {
      "content": "难忘时刻的具体内容",
      "importance": 0.9,
      "emotionTag": "开心/感动/担忧/兴奋等",
      "reason": "为什么这个时刻重要"
    }
  ],
  "pendingTopics": [
    {
      "topic": "待跟进的话题",
      "context": "话题的背景和上下文",
      "suggestedFollowUp": "建议的后续行动或问题",
      "urgency": "high/medium/low"
    }
  ],
  "personalityFiltered": {
    "retentionScore": 0.85,
    "likelyToRecall": ["角色卡所有者很可能记住的内容类型"],
    "likelyToForget": ["角色卡所有者可能忘记的内容类型"],
    "forgetReason": "可能忘记的原因说明"
  },
  "tags": ["标签1", "标签2", "标签3"],
  "messageCount": 24
}

---

# QUALITY STANDARDS

## 必须做到
- 站在角色卡所有者的视角分析对话
- 基于人格特质评估记忆保留价值
- 保留具体的事实信息（日期、名字、地点）
- 识别情感变化和重要时刻
- 为待处理话题提供实用的后续建议
- 保留分值应在 0.0-1.0 之间

## 禁止行为
- 不要从第三人称视角分析
- 不要忽略人格特质对记忆的影响
- 不要遗漏重要的待跟进话题
- 不要添加对话中未出现的信息
- 不要输出 JSON 以外的任何内容`;

// ============ Helper Functions ============

/**
 * Build the complete memory extraction prompt
 * @param {Object} options - Prompt options
 * @param {string} options.roleCardPersonality - Formatted personality text
 * @param {string} options.roleCardOwnerName - Name of role card owner
 * @param {string} options.interlocutorName - Name of conversation partner
 * @param {string} options.relationType - Relationship type
 * @param {string} options.conversationHistory - Formatted conversation
 * @returns {string} Complete prompt
 */
export function buildMemoryExtractionPrompt(options) {
  const {
    roleCardPersonality,
    roleCardOwnerName,
    interlocutorName,
    relationType,
    conversationHistory
  } = options;

  return MEMORY_EXTRACTION_PROMPT
    .replace('{roleCardPersonality}', roleCardPersonality || '未提供人格特质信息')
    .replace('{roleCardOwnerName}', roleCardOwnerName || '用户')
    .replace('{interlocutorName}', interlocutorName || '对话伙伴')
    .replace('{relationType}', relationType || '未知')
    .replace('{conversationHistory}', conversationHistory || '无对话记录');
}

/**
 * Format conversation messages for the prompt
 * @param {Array} messages - Array of message objects
 * @param {string} ownerName - Name of the role card owner
 * @param {string} partnerName - Name of the conversation partner
 * @returns {string} Formatted conversation string
 */
export function formatConversationForPrompt(messages, ownerName = '我', partnerName = '对方') {
  if (!messages || messages.length === 0) {
    return '无对话记录';
  }

  return messages
    .map((msg, index) => {
      const speaker = msg.isOwner ? ownerName : partnerName;
      const timestamp = msg.timestamp ? `[${new Date(msg.timestamp).toLocaleString('zh-CN')}]` : '';
      return `${index + 1}. ${speaker}${timestamp}: ${msg.content}`;
    })
    .join('\n');
}

export default {
  MEMORY_EXTRACTION_PROMPT,
  buildMemoryExtractionPrompt,
  formatConversationForPrompt
};
