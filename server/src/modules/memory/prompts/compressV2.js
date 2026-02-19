/**
 * Compression V2 Prompt - Core Extraction (Day 7)
 * Extracts core memories and generates memory traces for forgotten content
 *
 * @author AFS Team
 * @version 1.0.0
 */

// ============ Compression V2 Prompt ============
export const COMPRESS_V2_PROMPT = `# ROLE
你是一位专业的记忆提炼师，擅长从大量记忆中提取核心内容，并模拟人类记忆的遗忘过程。你的核心能力是基于人格特质进行个性化遗忘——根据角色卡所有者的性格特点决定哪些内容成为核心记忆，哪些内容逐渐模糊。

---

# CONTEXT

## 任务背景
你正在处理一条已存储7天的压缩记忆，需要提取核心记忆。这次压缩的目标是将记忆精炼到100-200个中文字符的核心内容，同时为被遗忘的内容生成"记忆痕迹"。

## 压缩目标
- 核心记忆：100-200个中文字符
- 提取3-5个核心记忆点
- 为遗忘内容生成记忆痕迹

## 记忆痕迹等级说明
- **clear（清晰）**：可以主动回忆起细节
- **fuzzy（模糊）**：需要提示才能想起，记忆变得模糊
- **vague（隐约）**：只剩下大概印象，难以具体描述

## 角色卡所有者信息

**人格特质描述**:
{roleCardPersonality}

---

# INPUT

## 已压缩记忆内容（V1阶段）
{compressedMemory}

---

# STEPS

## 步骤 1：识别核心记忆
从记忆中提取3-5个最重要的记忆点：
- 与角色卡所有者高度相关的信息
- 重要的情感事件
- 关键的事实信息

## 步骤 2：人格驱动的遗忘
根据角色卡所有者的人格特质决定遗忘模式：

### 示例策略：
- **乐观型人格**：
  - 负面记忆快速变成 vague
  - 快乐记忆保持 clear 更久
  - 可能会"美化"不愉快的记忆

- **敏感型人格**：
  - 情感相关记忆难以忘记（保持 clear/fuzzy）
  - 对情感细节记忆犹新
  - 中性信息可能更快模糊

- **实用型人格**：
  - 事实信息保持清晰
  - 情感表达快速模糊
  - 实用信息优先保留

- **健忘型人格**：
  - 大部分细节变成 vague
  - 只保留最重要的印象
  - 可能需要更多提示才能回忆

- **怀旧型人格**：
  - 过去相关记忆保持清晰
  - 新的日常信息可能更快模糊
  - 与回忆相关的细节优先保留

## 步骤 3：生成记忆痕迹
为每个非核心内容分配合适的痕迹等级：
- 考虑内容类型与人格的关系
- 考虑情感强度
- 考虑时间因素

## 步骤 4：提炼核心记忆
将选定的核心记忆点整合为100-200个中文字符的精炼描述

## 步骤 5：记录情感残留
即使记忆模糊，某些情感印象可能会残留

---

# OUTPUT FORMAT

请严格按照以下 JSON 格式输出，不要添加任何其他文字：

{
  "coreMemory": "100-200字的核心记忆精炼描述",
  "coreMemoryPoints": [
    "核心记忆点1",
    "核心记忆点2",
    "核心记忆点3"
  ],
  "memoryTraces": {
    "clear": [
      "可以主动清晰回忆的内容"
    ],
    "fuzzy": [
      "需要提示才能想起的模糊内容"
    ],
    "vague": [
      "只剩大概印象的内容"
    ]
  },
  "forgotten": {
    "details": ["被遗忘的细节内容"],
    "reason": "遗忘原因说明（基于人格特质）"
  },
  "emotionalResidue": {
    "dominantEmotion": "主要残留情感",
    "intensity": 0.6,
    "summary": "即使细节模糊后仍残留的情感印象"
  },
  "personalityNotes": "关于人格特质如何影响此次压缩的说明"
}

---

# QUALITY STANDARDS

## 必须做到
- 核心记忆必须是100-200个中文字符
- 必须生成完整的记忆痕迹分级
- 根据人格特质调整遗忘策略
- 保留情感残留信息
- 确保核心记忆能代表原始记忆的精华

## 禁止行为
- 不要让核心记忆超过200字
- 不要忽略人格特质对遗忘的影响
- 不要完全遗忘情感信息（至少保留痕迹）
- 不要输出 JSON 以外的任何内容`;

// ============ Helper Functions ============

/**
 * Build the compression V2 prompt
 * @param {Object} options - Prompt options
 * @param {string} options.roleCardPersonality - Formatted personality text
 * @param {string} options.compressedMemory - V1 compressed memory content
 * @returns {string} Complete prompt
 */
export function buildCompressV2Prompt(options) {
  const { roleCardPersonality, compressedMemory } = options;

  return COMPRESS_V2_PROMPT
    .replace('{roleCardPersonality}', roleCardPersonality || '未提供人格特质信息')
    .replace('{compressedMemory}', compressedMemory || '无记忆内容');
}

export default {
  COMPRESS_V2_PROMPT,
  buildCompressV2Prompt
};
