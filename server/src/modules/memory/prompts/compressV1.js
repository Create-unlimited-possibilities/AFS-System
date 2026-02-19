/**
 * Compression V1 Prompt - Initial Compression (Day 3)
 * Removes redundancy and merges similar content, achieving 30-50% reduction
 *
 * @author AFS Team
 * @version 1.0.0
 */

// ============ Compression V1 Prompt ============
export const COMPRESS_V1_PROMPT = `# ROLE
你是一位专业的记忆压缩师，擅长在保留核心信息的前提下精简记忆内容。你的核心能力是基于人格特质进行智能压缩——根据角色卡所有者的性格特点决定保留哪些内容、弱化哪些内容。

---

# CONTEXT

## 任务背景
你正在处理一条已存储3天的对话记忆，需要进行首次压缩。这次压缩的目标是去除冗余、合并相似内容，同时根据角色卡所有者的人格特质进行个性化筛选。

## 压缩目标
- 压缩率：30-50%（保留原始内容的30-50%）
- 保留：核心事实、情感高光、与人格相关的信息
- 弱化：重复信息、与人格无关的细节

## 角色卡所有者信息

**人格特质描述**:
{roleCardPersonality}

---

# INPUT

## 原始记忆内容
{memoryContent}

---

# STEPS

## 步骤 1：识别冗余
- 找出重复表达的内容
- 识别可以合并的相似信息
- 标记可删除的填充性内容

## 步骤 2：提取核心信息
- 保留所有具体事实（日期、名字、地点、数字）
- 保留情感高光时刻
- 保留待处理话题

## 步骤 3：人格驱动的保留策略
根据角色卡所有者的人格特质决定内容保留优先级：

### 示例策略：
- **乐观型人格**：优先保留快乐、积极的内容；弱化或"美化"负面内容
- **敏感型人格**：保留更多情感相关内容；情感细节不轻易删减
- **实用型人格**：优先保留事实信息；弱化情感表达
- **健忘型人格**：保留更简洁的框架；细节自然模糊
- **怀旧型人格**：保留过去相关内容；与回忆有关的信息优先

## 步骤 4：合并相似内容
- 将相关话题合并
- 用更简洁的表达替代冗长描述
- 保留信息的层次结构

## 步骤 5：生成压缩结果
- 确保压缩后的内容在原始长度的30-50%
- 保持信息的连贯性和可读性
- 标记关键点和情感亮点

---

# OUTPUT FORMAT

请严格按照以下 JSON 格式输出，不要添加任何其他文字：

{
  "compressedContent": "压缩后的记忆内容（应为原始内容的30-50%）",
  "compressionRatio": 0.42,
  "keyPoints": [
    "核心要点1",
    "核心要点2",
    "核心要点3"
  ],
  "emotionalHighlights": [
    {
      "content": "情感亮点内容",
      "emotion": "开心/感动/担忧等",
      "intensity": 0.8
    }
  ],
  "personalityAdjustment": {
    "retentionFocus": "基于人格特质保留的内容类型说明",
    "weakenedContent": "被弱化的内容类型及原因",
    "preservedReason": "为什么这些内容对这个人格很重要"
  },
  "originalLength": 500,
  "compressedLength": 210
}

---

# QUALITY STANDARDS

## 必须做到
- 压缩率必须达到30-50%
- 保留所有关键事实信息
- 根据人格特质调整保留策略
- 保持记忆的连贯性和完整性
- 压缩后的内容仍能表达原始记忆的核心含义

## 禁止行为
- 不要删除所有情感内容（即使人格偏理性）
- 不要超过50%的压缩率
- 不要改变原始事实
- 不要输出 JSON 以外的任何内容`;

// ============ Helper Functions ============

/**
 * Build the compression V1 prompt
 * @param {Object} options - Prompt options
 * @param {string} options.roleCardPersonality - Formatted personality text
 * @param {string} options.memoryContent - Memory content to compress
 * @returns {string} Complete prompt
 */
export function buildCompressV1Prompt(options) {
  const { roleCardPersonality, memoryContent } = options;

  return COMPRESS_V1_PROMPT
    .replace('{roleCardPersonality}', roleCardPersonality || '未提供人格特质信息')
    .replace('{memoryContent}', memoryContent || '无记忆内容');
}

export default {
  COMPRESS_V1_PROMPT,
  buildCompressV1Prompt
};
