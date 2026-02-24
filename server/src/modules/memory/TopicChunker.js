/**
 * TopicChunker - LLM-based Topic Detection and Chunking
 * Splits conversations into topic-based chunks for memory storage
 * Detects incomplete/interrupted topics for follow-up
 *
 * @author AFS Team
 * @version 1.0.0
 *
 * =============================================================================
 * INTEGRATION GUIDE FOR TASK #8 (Memory Flow Integration)
 * =============================================================================
 *
 * ## API USAGE
 *
 * ### Method 1: Direct TopicChunker Usage
 * ```javascript
 * import TopicChunker from './modules/memory/TopicChunker.js';
 *
 * const chunker = new TopicChunker();
 * const result = await chunker.chunk({
 *   messages: [{ content: '...', isOwner: true }, ...],
 *   roleCardOwnerName: '张三',
 *   interlocutorName: '李四',
 *   relationType: 'family',
 *   wasInterrupted: false  // Set true if role card said "tired"
 * });
 * ```
 *
 * ### Method 2: MemoryExtractor with Chunking (RECOMMENDED)
 * ```javascript
 * import MemoryExtractor from './modules/memory/MemoryExtractor.js';
 *
 * const extractor = new MemoryExtractor();
 * const result = await extractor.extractWithChunking({
 *   roleCard: roleCardObject,           // Required: with coreLayer
 *   roleCardOwnerName: '张三',
 *   interlocutorName: '李四',
 *   relationType: 'family',
 *   messages: messageArray,
 *   wasInterrupted: false
 * });
 * ```
 *
 * ## INPUT PARAMETERS
 *
 * | Parameter | Type | Required | Description |
 * |-----------|------|----------|-------------|
 * | messages | Array | Yes | Array of {content, isOwner, timestamp?} |
 * | roleCard | Object | Yes* | Role card with coreLayer (for extraction) |
 * | roleCardOwnerName | string | No | Default: '我' |
 * | interlocutorName | string | No | Default: '对方' |
 * | relationType | string | No | Default: 'unknown' |
 * | wasInterrupted | boolean | No | Default: false |
 *
 * *roleCard required for extractWithChunking(), optional for chunk()
 *
 * ## OUTPUT STRUCTURE
 *
 * ```javascript
 * {
 *   chunks: [
 *     {
 *       id: "chunk_uuid",
 *       chunkId: "chunk_uuid",           // Same as id
 *       chunkIndex: 0,                   // Index in array
 *       topicSummary: "话题摘要",          // Max 10 chars
 *       messageIndices: [0, 1, 2, 3],    // Original message indices
 *       messages: [...],                 // Actual message objects
 *       messageCount: 4,
 *       isIncomplete: false,             // true if topic was interrupted
 *       completenessScore: 0.9,          // 0.0 - 1.0
 *       suggestedFollowUp: "",           // For incomplete chunks
 *       isChunked: true,
 *
 *       // From MemoryExtractor (only in extractWithChunking):
 *       summary: "Full summary...",
 *       keyTopics: [...],
 *       facts: [...],
 *       emotionalJourney: {...},
 *       memorableMoments: [...],
 *       pendingTopics: [...],
 *       personalityFiltered: {...},
 *       tags: [...]
 *     }
 *   ],
 *   totalChunks: 2,
 *   hasIncompleteTopics: true,
 *   incompleteTopicChunks: [0, 1],    // Indices of incomplete chunks
 *   analysisMetadata: {
 *     analyzedAt: "2026-02-24T...",
 *     modelUsed: "deepseek-r1:14b",
 *     backend: "ollama"
 *   }
 * }
 * ```
 *
 * ## INTEGRATION IN ORCHESTRATOR
 *
 * ### Where to Call:
 * Call `extractWithChunking()` in orchestrator.js after conversation ends,
 * before saving to MemoryStore. This replaces the existing `extract()` call.
 *
 * ### Full Integration Example:
 * ```javascript
 * // In orchestrator.js or memory save flow
 * import { MemoryExtractor, MemoryStore, Indexer } from '../memory/index.js';
 *
 * async function saveConversationMemory(options) {
 *   const { userId, partnerId, messages, roleCard, wasInterrupted } = options;
 *
 *   const extractor = new MemoryExtractor();
 *   const memoryStore = new MemoryStore();
 *   const indexer = new Indexer();
 *
 *   try {
 *     // Step 1: Extract with chunking
 *     const result = await extractor.extractWithChunking({
 *       roleCard,
 *       roleCardOwnerName: roleCard?.coreLayer?.basicIdentity?.name || '我',
 *       interlocutorName: partnerId,
 *       relationType: 'family',  // or from context
 *       messages,
 *       wasInterrupted
 *     });
 *
 *     // Step 2: Save each chunk as separate memory
 *     const savedMemories = [];
 *     for (const chunk of result.chunks) {
 *       const memoryData = {
 *         content: {
 *           raw: JSON.stringify(chunk.messages),
 *           processed: {
 *             summary: chunk.summary,
 *             topicSummary: chunk.topicSummary,
 *             keyTopics: chunk.keyTopics,
 *             facts: chunk.facts,
 *             emotionalJourney: chunk.emotionalJourney,
 *             memorableMoments: chunk.memorableMoments
 *           }
 *         },
 *         pendingTopics: {
 *           hasUnfinished: chunk.isIncomplete,
 *           topics: chunk.isIncomplete ? [{
 *             topic: chunk.topicSummary,
 *             context: chunk.summary,
 *             suggestedFollowUp: chunk.suggestedFollowUp,
 *             urgency: 'medium'
 *           }] : []
 *         },
 *         personalityFiltered: chunk.personalityFiltered,
 *         tags: [...chunk.tags, chunk.isIncomplete ? 'incomplete_topic' : 'complete'],
 *         meta: {
 *           chunkId: chunk.chunkId,
 *           chunkIndex: chunk.chunkIndex,
 *           totalChunks: result.totalChunks,
 *           completenessScore: chunk.completenessScore
 *         }
 *       };
 *
 *       const saved = await memoryStore.saveMemory(userId, partnerId, memoryData);
 *       savedMemories.push(saved);
 *
 *       // Step 3: Index to ChromaDB
 *       await indexer.indexConversationMemory(userId, saved.memory);
 *     }
 *
 *     return {
 *       success: true,
 *       totalChunks: result.totalChunks,
 *       hasIncompleteTopics: result.hasIncompleteTopics,
 *       savedMemories
 *     };
 *
 *   } catch (error) {
 *     // Fallback: Save without chunking
 *     const singleMemory = await extractor.extract({
 *       roleCard,
 *       roleCardOwnerName: roleCard?.coreLayer?.basicIdentity?.name,
 *       interlocutorName: partnerId,
 *       relationType: 'family',
 *       messages
 *     });
 *
 *     const saved = await memoryStore.saveMemory(userId, partnerId, singleMemory);
 *     await indexer.indexConversationMemory(userId, saved.memory);
 *
 *     return { success: true, fallback: true, error: error.message };
 *   }
 * }
 * ```
 *
 * ## ERROR HANDLING RECOMMENDATIONS
 *
 * 1. Always wrap in try-catch - LLM calls can fail
 * 2. Use fallback to single extraction if chunking fails
 * 3. Log errors with context for debugging
 * 4. Check `result.chunkingFailed` flag for fallback detection
 *
 * ## TESTING
 *
 * Test cases to cover:
 * - Empty messages array
 * - Single message (should create single chunk)
 * - Short conversation (< 4 messages)
 * - Long conversation with clear topic changes
 * - Interrupted conversation (wasInterrupted: true)
 * - LLM failure (should fallback gracefully)
 *
 * =============================================================================
 */

import crypto from 'crypto';
import LLMClient, { createDefaultLLMClient } from '../../core/llm/client.js';
import logger from '../../core/utils/logger.js';

const chunkerLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'TOPIC_CHUNKER' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'TOPIC_CHUNKER' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'TOPIC_CHUNKER' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'TOPIC_CHUNKER' }),
};

// Minimum messages to form a topic context
const MIN_MESSAGES_FOR_CHUNK = 2;
// Minimum total messages to consider multiple chunks
const MIN_MESSAGES_FOR_SPLITTING = 4;

/**
 * Topic Chunker class
 * Uses LLM to analyze conversations and split into topic-based chunks
 */
class TopicChunker {
  constructor() {
    this.llmClient = createDefaultLLMClient();
    this.temperature = 0.3; // Low temperature for consistent analysis
    chunkerLogger.info('TopicChunker initialized', {
      model: this.llmClient.getModelInfo().model,
      backend: this.llmClient.getModelInfo().backend,
      temperature: this.temperature
    });
  }

  /**
   * Main entry point - chunk a conversation into topic-based segments
   * @param {Object} options - Chunking options
   * @param {Array} options.messages - Array of message objects
   * @param {string} options.roleCardOwnerName - Name of role card owner
   * @param {string} options.interlocutorName - Name of conversation partner
   * @param {string} options.relationType - Relationship type
   * @param {boolean} options.wasInterrupted - Whether conversation was interrupted (e.g., tired)
   * @returns {Promise<Object>} Chunking result with array of chunks
   */
  async chunk(options) {
    const {
      messages,
      roleCardOwnerName = '我',
      interlocutorName = '对方',
      relationType = 'unknown',
      wasInterrupted = false
    } = options;

    chunkerLogger.info('Starting topic chunking', {
      messageCount: messages?.length || 0,
      wasInterrupted,
      interlocutorName
    });

    // Validate input
    if (!messages || messages.length === 0) {
      chunkerLogger.warn('No messages to chunk');
      return this.createEmptyResult();
    }

    try {
      // If too few messages for splitting, create single chunk
      if (messages.length < MIN_MESSAGES_FOR_SPLITTING) {
        chunkerLogger.info('Conversation too short for splitting, creating single chunk', {
          messageCount: messages.length
        });
        return this.createSingleChunk(messages, wasInterrupted, {
          roleCardOwnerName,
          interlocutorName,
          relationType
        });
      }

      // Analyze conversation with LLM
      const analysis = await this.analyzeConversation(messages, {
        roleCardOwnerName,
        interlocutorName,
        relationType,
        wasInterrupted
      });

      // Create chunks based on analysis
      const chunks = this.createChunks(messages, analysis, {
        wasInterrupted,
        roleCardOwnerName,
        interlocutorName
      });

      const result = {
        chunks,
        totalChunks: chunks.length,
        hasIncompleteTopics: chunks.some(c => c.isIncomplete),
        incompleteTopicChunks: chunks
          .map((c, i) => c.isIncomplete ? i : -1)
          .filter(i => i >= 0),
        analysisMetadata: {
          analyzedAt: new Date().toISOString(),
          modelUsed: this.llmClient.getModelInfo().model,
          backend: this.llmClient.getModelInfo().backend
        }
      };

      chunkerLogger.info('Topic chunking completed', {
        totalChunks: result.totalChunks,
        hasIncompleteTopics: result.hasIncompleteTopics,
        incompleteCount: result.incompleteTopicChunks.length
      });

      return result;

    } catch (error) {
      chunkerLogger.error('Topic chunking failed, falling back to single chunk', {
        error: error.message,
        stack: error.stack
      });

      // Fallback to single chunk on error
      return this.createSingleChunk(messages, wasInterrupted, {
        roleCardOwnerName,
        interlocutorName,
        relationType
      });
    }
  }

  /**
   * Analyze conversation using LLM to detect topic boundaries
   * @param {Array} messages - Array of message objects
   * @param {Object} context - Context information
   * @returns {Promise<Object>} Analysis result with boundaries and completeness
   */
  async analyzeConversation(messages, context) {
    const { roleCardOwnerName, interlocutorName, relationType, wasInterrupted } = context;

    // Format conversation for prompt
    const conversationText = this.formatConversationForAnalysis(messages, roleCardOwnerName, interlocutorName);

    // Build the analysis prompt
    const prompt = this.buildAnalysisPrompt(conversationText, {
      roleCardOwnerName,
      interlocutorName,
      relationType,
      wasInterrupted,
      messageCount: messages.length
    });

    chunkerLogger.debug('Calling LLM for topic analysis');

    // Call LLM
    const response = await this.llmClient.generate(prompt, {
      temperature: this.temperature,
      maxTokens: 2000
    });

    // Parse response
    return this.parseAnalysisResponse(response);
  }

  /**
   * Build the LLM prompt for topic analysis
   * @param {string} conversationText - Formatted conversation
   * @param {Object} context - Context information
   * @returns {string} Complete prompt
   */
  buildAnalysisPrompt(conversationText, context) {
    const { roleCardOwnerName, interlocutorName, relationType, wasInterrupted, messageCount } = context;

    return `# ROLE
你是一位对话分析专家，擅长识别对话中的话题边界和未完成的话题。你的任务是分析一段对话，识别出不同的话题，并判断每个话题是否完整。

---

# CONTEXT

## 任务背景
分析一段对话记录，将其分割成基于话题的片段。每个片段应该代表一个连贯的话题。

## 对话信息
- 角色卡所有者: ${roleCardOwnerName}
- 对话伙伴: ${interlocutorName}
- 关系类型: ${relationType}
- 对话是否被中断: ${wasInterrupted ? '是' : '否'}
- 消息总数: ${messageCount}

---

# INPUT

## 对话记录
${conversationText}

---

# STEPS

## 步骤 1：识别话题边界
- 找出对话中话题自然转换的位置
- 话题边界通常出现在：话题明显改变、时间跳跃、新的问题提出等
- 不要过度分割，保持话题的完整性

## 步骤 2：分析每个话题的完整性
- 判断每个话题是否得到了充分的讨论
- 考虑对话是否被中断（如疲劳提示）
- 识别哪些话题需要后续跟进

## 步骤 3：评估话题重要性
- 评估每个话题的重要程度
- 识别情感高潮或重要时刻
- 标记需要记住的关键信息

---

# OUTPUT FORMAT

请严格按照以下 JSON 格式输出，不要添加任何其他文字：

{
  "topicBoundaries": [
    {
      "startIndex": 0,
      "endIndex": 5,
      "topicSummary": "话题简要描述（10字以内）",
      "isComplete": true,
      "completenessScore": 0.9,
      "reason": "该话题已充分讨论"
    },
    {
      "startIndex": 6,
      "endIndex": 12,
      "topicSummary": "另一个话题",
      "isComplete": false,
      "completenessScore": 0.4,
      "reason": "话题被中断，未得出结论",
      "suggestedFollowUp": "下次可以继续问关于..."
    }
  ],
  "overallAnalysis": {
    "mainTopics": ["主题1", "主题2"],
    "dominantEmotion": "开心/担忧/平静等",
    "conversationQuality": "high/medium/low",
    "needsFollowUp": true
  }
}

---

# QUALITY STANDARDS

## 必须做到
- 确保每个边界覆盖连续的消息
- startIndex 和 endIndex 必须是有效的消息索引（从0开始）
- 所有消息都必须被覆盖，不能有遗漏
- completenessScore 在 0.0-1.0 之间
- 如果对话被中断，最后一个话题通常标记为不完整

## 禁止行为
- 不要创建只有1条消息的片段（除非整个对话只有1条消息）
- 不要输出 JSON 以外的任何内容
- 不要遗漏任何消息`;
  }

  /**
   * Format conversation messages for analysis
   * @param {Array} messages - Array of message objects
   * @param {string} ownerName - Name of role card owner
   * @param {string} partnerName - Name of conversation partner
   * @returns {string} Formatted conversation
   */
  formatConversationForAnalysis(messages, ownerName = '我', partnerName = '对方') {
    return messages
      .map((msg, index) => {
        const speaker = msg.isOwner ? ownerName : partnerName;
        return `[${index}] ${speaker}: ${msg.content}`;
      })
      .join('\n');
  }

  /**
   * Parse LLM analysis response
   * @param {string} response - Raw LLM response
   * @returns {Object} Parsed analysis object
   */
  parseAnalysisResponse(response) {
    if (!response) {
      throw new Error('Empty LLM response');
    }

    try {
      // Try to find JSON in the response
      let jsonStr = response;

      // Handle thinking tags from deepseek-r1
      const thinkMatch = response.match(/<\/think>\s*([\s\S]*)/);
      if (thinkMatch) {
        jsonStr = thinkMatch[1].trim();
      }

      // Try to find JSON object in the response
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr);

      // Validate and normalize
      return this.validateAnalysis(parsed);

    } catch (error) {
      chunkerLogger.error('Failed to parse analysis response', {
        error: error.message,
        responsePreview: response.substring(0, 500)
      });
      throw new Error(`Failed to parse topic analysis: ${error.message}`);
    }
  }

  /**
   * Validate and normalize analysis result
   * @param {Object} analysis - Parsed analysis
   * @returns {Object} Validated analysis
   */
  validateAnalysis(analysis) {
    const boundaries = Array.isArray(analysis.topicBoundaries)
      ? analysis.topicBoundaries.map(b => ({
          startIndex: typeof b.startIndex === 'number' ? b.startIndex : 0,
          endIndex: typeof b.endIndex === 'number' ? b.endIndex : 0,
          topicSummary: (b.topicSummary || '对话').substring(0, 10),
          isComplete: b.isComplete !== false,
          completenessScore: typeof b.completenessScore === 'number'
            ? Math.max(0, Math.min(1, b.completenessScore))
            : 0.7,
          reason: b.reason || '',
          suggestedFollowUp: b.suggestedFollowUp || ''
        }))
      : [];

    return {
      topicBoundaries: boundaries,
      overallAnalysis: {
        mainTopics: Array.isArray(analysis.overallAnalysis?.mainTopics)
          ? analysis.overallAnalysis.mainTopics
          : [],
        dominantEmotion: analysis.overallAnalysis?.dominantEmotion || '',
        conversationQuality: analysis.overallAnalysis?.conversationQuality || 'medium',
        needsFollowUp: analysis.overallAnalysis?.needsFollowUp || false
      }
    };
  }

  /**
   * Create chunks from messages based on analysis
   * @param {Array} messages - Original messages
   * @param {Object} analysis - LLM analysis result
   * @param {Object} options - Additional options
   * @returns {Array} Array of chunk objects
   */
  createChunks(messages, analysis, options) {
    const { wasInterrupted } = options;
    const chunks = [];

    // If no valid boundaries, create single chunk
    if (!analysis.topicBoundaries || analysis.topicBoundaries.length === 0) {
      return [this.createChunkObject(messages, 0, messages.length - 1, {
        topicSummary: '对话',
        isComplete: !wasInterrupted,
        completenessScore: wasInterrupted ? 0.5 : 0.8
      })];
    }

    // Create chunks from boundaries
    for (let i = 0; i < analysis.topicBoundaries.length; i++) {
      const boundary = analysis.topicBoundaries[i];
      const { startIndex, endIndex, topicSummary, isComplete, completenessScore, suggestedFollowUp } = boundary;

      // Validate indices
      const validStart = Math.max(0, startIndex);
      const validEnd = Math.min(messages.length - 1, endIndex);

      // Ensure minimum chunk size
      if (validEnd - validStart + 1 < MIN_MESSAGES_FOR_CHUNK && chunks.length > 0) {
        // Merge with previous chunk if too small
        const prevChunk = chunks[chunks.length - 1];
        prevChunk.messageIndices.push(...this.createRange(validStart, validEnd));
        prevChunk.messages = prevChunk.messageIndices.map(idx => messages[idx]);
        continue;
      }

      const chunk = this.createChunkObject(messages, validStart, validEnd, {
        topicSummary,
        isComplete: wasInterrupted && i === analysis.topicBoundaries.length - 1
          ? false
          : isComplete,
        completenessScore: wasInterrupted && i === analysis.topicBoundaries.length - 1
          ? Math.min(completenessScore, 0.5)
          : completenessScore,
        suggestedFollowUp
      });

      chunks.push(chunk);
    }

    // Ensure all messages are covered
    this.fillGaps(chunks, messages);

    return chunks;
  }

  /**
   * Create a single chunk object
   * @param {Array} messages - Original messages
   * @param {number} startIndex - Start index
   * @param {number} endIndex - End index
   * @param {Object} metadata - Chunk metadata
   * @returns {Object} Chunk object
   */
  createChunkObject(messages, startIndex, endIndex, metadata) {
    const indices = this.createRange(startIndex, endIndex);
    const chunkMessages = indices.map(idx => messages[idx]).filter(m => m);

    return {
      id: `chunk_${crypto.randomUUID()}`,
      topicSummary: metadata.topicSummary || '对话',
      messageIndices: indices,
      messages: chunkMessages,
      messageCount: chunkMessages.length,
      isIncomplete: metadata.isComplete === false,
      completenessScore: metadata.completenessScore ?? 0.7,
      suggestedFollowUp: metadata.suggestedFollowUp || '',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Create a range of numbers
   * @param {number} start - Start value
   * @param {number} end - End value (inclusive)
   * @returns {Array} Array of numbers
   */
  createRange(start, end) {
    const range = [];
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }

  /**
   * Fill gaps in chunk coverage
   * @param {Array} chunks - Array of chunks
   * @param {Array} messages - Original messages
   */
  fillGaps(chunks, messages) {
    // Get all covered indices
    const covered = new Set();
    for (const chunk of chunks) {
      for (const idx of chunk.messageIndices) {
        covered.add(idx);
      }
    }

    // Find gaps
    const gaps = [];
    let gapStart = null;
    for (let i = 0; i < messages.length; i++) {
      if (!covered.has(i)) {
        if (gapStart === null) {
          gapStart = i;
        }
      } else {
        if (gapStart !== null) {
          gaps.push({ start: gapStart, end: i - 1 });
          gapStart = null;
        }
      }
    }
    if (gapStart !== null) {
      gaps.push({ start: gapStart, end: messages.length - 1 });
    }

    // Create chunks for gaps
    for (const gap of gaps) {
      const gapChunk = this.createChunkObject(messages, gap.start, gap.end, {
        topicSummary: '其他对话',
        isComplete: true,
        completenessScore: 0.6
      });
      chunks.push(gapChunk);
      chunkerLogger.debug('Created chunk for gap', {
        start: gap.start,
        end: gap.end
      });
    }
  }

  /**
   * Create a single chunk for short conversations
   * @param {Array} messages - All messages
   * @param {boolean} wasInterrupted - Whether conversation was interrupted
   * @param {Object} context - Context information
   * @returns {Object} Single chunk result
   */
  createSingleChunk(messages, wasInterrupted, context) {
    const chunk = this.createChunkObject(messages, 0, messages.length - 1, {
      topicSummary: '对话',
      isComplete: !wasInterrupted,
      completenessScore: wasInterrupted ? 0.5 : 0.8,
      suggestedFollowUp: wasInterrupted ? '对话被中断，可以继续讨论' : ''
    });

    // Try to get a better topic summary from first message
    if (messages.length > 0 && messages[0].content) {
      chunk.topicSummary = messages[0].content.substring(0, 10);
    }

    return {
      chunks: [chunk],
      totalChunks: 1,
      hasIncompleteTopics: wasInterrupted,
      incompleteTopicChunks: wasInterrupted ? [0] : [],
      analysisMetadata: {
        analyzedAt: new Date().toISOString(),
        modelUsed: this.llmClient.getModelInfo().model,
        backend: this.llmClient.getModelInfo().backend,
        note: 'Single chunk created (short conversation)'
      }
    };
  }

  /**
   * Create empty result for no messages
   * @returns {Object} Empty chunking result
   */
  createEmptyResult() {
    return {
      chunks: [],
      totalChunks: 0,
      hasIncompleteTopics: false,
      incompleteTopicChunks: [],
      analysisMetadata: {
        analyzedAt: new Date().toISOString(),
        note: 'No messages to chunk'
      }
    };
  }

  /**
   * Health check for the chunker
   * @returns {Promise<boolean>} Whether the chunker is healthy
   */
  async healthCheck() {
    try {
      const isHealthy = await this.llmClient.healthCheck();
      chunkerLogger.debug('Health check result', { isHealthy });
      return isHealthy;
    } catch (error) {
      chunkerLogger.error('Health check failed', { error: error.message });
      return false;
    }
  }
}

export default TopicChunker;
