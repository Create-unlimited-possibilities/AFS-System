/**
 * Compressor - Memory Compression System
 * Compresses old memories to save space while retaining key information
 * Uses personality-driven compression strategy
 *
 * @author AFS Team
 * @version 2.0.0
 */

import LLMClient from '../../core/llm/client.js';
import { buildCompressV1Prompt } from './prompts/compressV1.js';
import { buildCompressV2Prompt } from './prompts/compressV2.js';
import logger from '../../core/utils/logger.js';

const memoryLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'COMPRESSOR' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'COMPRESSOR' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'COMPRESSOR' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'COMPRESSOR' }),
};

class Compressor {
  constructor() {
    this.llmClient = new LLMClient(process.env.OLLAMA_MODEL || 'deepseek-r1:14b', {
      temperature: 0.3,
      timeout: 60000
    });
    memoryLogger.info('Compressor initialized', {
      model: this.llmClient.model,
      temperature: 0.3
    });
  }

  /**
   * Compress a memory to a smaller representation
   * Routes to appropriate compression method based on target stage
   * @param {Object} memory - Memory to compress
   * @param {string} targetStage - Target compression stage (v1, v2)
   * @param {Object} roleCard - Role card with personality info
   * @returns {Promise<Object>} Compressed memory data
   */
  async compress(memory, targetStage = 'v1', roleCard = null) {
    memoryLogger.info('Starting compression', {
      memoryId: memory.memoryId,
      currentStage: memory.meta?.compressionStage,
      targetStage
    });

    // Determine which compression method to use
    if (targetStage === 'v1') {
      return this.compressV1(memory, roleCard);
    } else if (targetStage === 'v2') {
      return this.compressV2(memory, roleCard);
    }

    throw new Error(`Unknown compression stage: ${targetStage}`);
  }

  /**
   * Compress memory to V1 stage (Day 3)
   * Removes redundancy, merges similar content, 30-50% reduction
   * @param {Object} memory - Memory to compress
   * @param {Object} roleCard - Role card with personality info
   * @returns {Promise<Object>} Compressed memory data
   */
  async compressV1(memory, roleCard) {
    const memoryId = memory.memoryId;
    memoryLogger.info('Starting V1 compression', { memoryId });

    try {
      // Format inputs
      const personalityText = this.formatPersonality(roleCard);
      const memoryContent = this.formatMemoryForPrompt(memory);

      // Check if content is too short to compress
      if (memoryContent.length < 100) {
        memoryLogger.info('Memory too short for V1 compression, skipping', {
          memoryId,
          length: memoryContent.length
        });
        return {
          skipped: true,
          reason: 'Memory too short',
          originalLength: memoryContent.length
        };
      }

      // Build prompt
      const prompt = buildCompressV1Prompt({
        roleCardPersonality: personalityText,
        memoryContent
      });

      memoryLogger.debug('Calling LLM for V1 compression', { memoryId });

      // Call LLM
      const response = await this.llmClient.generate(prompt, {
        temperature: 0.3,
        maxTokens: 2000
      });

      // Parse response
      const compressedData = this.parseResponse(response);

      // Validate compression ratio
      if (compressedData.compressionRatio > 0.6) {
        memoryLogger.warn('V1 compression ratio too high, may need adjustment', {
          memoryId,
          ratio: compressedData.compressionRatio
        });
      }

      const result = {
        compressedContent: compressedData.compressedContent,
        compressionRatio: compressedData.compressionRatio || 0.5,
        keyPoints: compressedData.keyPoints || [],
        emotionalHighlights: compressedData.emotionalHighlights || [],
        personalityAdjustment: compressedData.personalityAdjustment || {},
        originalLength: compressedData.originalLength || memoryContent.length,
        compressedLength: compressedData.compressedLength || compressedData.compressedContent?.length || 0,
        compressionStage: 'v1',
        compressedAt: new Date().toISOString()
      };

      memoryLogger.info('V1 compression completed', {
        memoryId,
        originalLength: result.originalLength,
        compressedLength: result.compressedLength,
        ratio: result.compressionRatio
      });

      return result;

    } catch (error) {
      memoryLogger.error('V1 compression failed', {
        memoryId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Compress memory to V2 stage (Day 7)
   * Extract core memories, generate memory traces, 100-200 chars
   * @param {Object} memory - Memory to compress (should be V1 compressed)
   * @param {Object} roleCard - Role card with personality info
   * @returns {Promise<Object>} Compressed memory data
   */
  async compressV2(memory, roleCard) {
    const memoryId = memory.memoryId;
    memoryLogger.info('Starting V2 compression', { memoryId });

    try {
      // Format inputs
      const personalityText = this.formatPersonality(roleCard);

      // Use V1 compressed content if available, otherwise use processed content
      let compressedMemory = '';
      if (memory.compression?.compressedContent) {
        compressedMemory = memory.compression.compressedContent;
      } else if (memory.content?.processed) {
        compressedMemory = this.formatProcessedContent(memory.content.processed);
      } else if (memory.content?.raw) {
        compressedMemory = memory.content.raw;
      }

      if (!compressedMemory || compressedMemory.length < 50) {
        memoryLogger.info('Memory content too short for V2 compression, skipping', {
          memoryId,
          length: compressedMemory?.length || 0
        });
        return {
          skipped: true,
          reason: 'Memory content too short',
          originalLength: compressedMemory?.length || 0
        };
      }

      // Build prompt
      const prompt = buildCompressV2Prompt({
        roleCardPersonality: personalityText,
        compressedMemory
      });

      memoryLogger.debug('Calling LLM for V2 compression', { memoryId });

      // Call LLM
      const response = await this.llmClient.generate(prompt, {
        temperature: 0.3,
        maxTokens: 2000
      });

      // Parse response
      const compressedData = this.parseResponse(response);

      // Validate core memory length
      const coreMemoryLength = compressedData.coreMemory?.length || 0;
      if (coreMemoryLength > 200) {
        memoryLogger.warn('V2 core memory exceeds 200 chars, truncation may be needed', {
          memoryId,
          length: coreMemoryLength
        });
      }

      const result = {
        coreMemory: compressedData.coreMemory || '',
        coreMemoryPoints: compressedData.coreMemoryPoints || [],
        memoryTraces: compressedData.memoryTraces || {
          clear: [],
          fuzzy: [],
          vague: []
        },
        forgotten: compressedData.forgotten || {
          details: [],
          reason: ''
        },
        emotionalResidue: compressedData.emotionalResidue || {
          dominantEmotion: '',
          intensity: 0,
          summary: ''
        },
        personalityNotes: compressedData.personalityNotes || '',
        compressionStage: 'v2',
        compressedAt: new Date().toISOString()
      };

      memoryLogger.info('V2 compression completed', {
        memoryId,
        coreMemoryLength: result.coreMemory.length,
        corePointsCount: result.coreMemoryPoints.length,
        traceLevels: {
          clear: result.memoryTraces.clear.length,
          fuzzy: result.memoryTraces.fuzzy.length,
          vague: result.memoryTraces.vague.length
        }
      });

      return result;

    } catch (error) {
      memoryLogger.error('V2 compression failed', {
        memoryId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Determine if memory needs compression based on age and current stage
   * @param {Object} memory - Memory to check
   * @returns {Object|null} Compression info or null if no compression needed
   */
  determineCompressionStage(memory) {
    const createdAt = new Date(memory.meta?.createdAt);
    const daysOld = this.getDaysSinceCreation(createdAt);
    const currentStage = memory.meta?.compressionStage || 'raw';

    memoryLogger.debug('Checking compression eligibility', {
      memoryId: memory.memoryId,
      daysOld,
      currentStage
    });

    // V1 compression: Day 3, still at raw stage
    if (currentStage === 'raw' && daysOld >= 3 && !memory.meta?.compressedAt) {
      return {
        needsCompression: true,
        targetStage: 'v1',
        reason: `Memory is ${daysOld} days old, ready for V1 compression`
      };
    }

    // V2 compression: Day 7, already at V1 stage
    if (currentStage === 'v1' && daysOld >= 7) {
      return {
        needsCompression: true,
        targetStage: 'v2',
        reason: `Memory is ${daysOld} days old, ready for V2 compression`
      };
    }

    return null;
  }

  /**
   * Calculate days since creation
   * @param {Date|string} createdAt - Creation timestamp
   * @returns {number} Number of days
   */
  getDaysSinceCreation(createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Format memory content for the LLM prompt
   * @param {Object} memory - Memory object
   * @returns {string} Formatted memory string
   */
  formatMemoryForPrompt(memory) {
    const parts = [];

    // Add summary if available
    if (memory.content?.processed?.summary) {
      parts.push(`【摘要】${memory.content.processed.summary}`);
    }

    // Add key topics
    if (memory.content?.processed?.keyTopics?.length > 0) {
      parts.push(`【主要话题】${memory.content.processed.keyTopics.join('、')}`);
    }

    // Add facts
    if (memory.content?.processed?.facts?.length > 0) {
      parts.push(`【事实信息】${memory.content.processed.facts.join('；')}`);
    }

    // Add emotional journey
    const journey = memory.content?.processed?.emotionalJourney;
    if (journey) {
      const journeyParts = [];
      if (journey.start) journeyParts.push(`开始: ${journey.start}`);
      if (journey.peak) journeyParts.push(`高潮: ${journey.peak}`);
      if (journey.end) journeyParts.push(`结束: ${journey.end}`);
      if (journeyParts.length > 0) {
        parts.push(`【情感变化】${journeyParts.join(' → ')}`);
      }
    }

    // Add memorable moments
    if (memory.content?.processed?.memorableMoments?.length > 0) {
      const moments = memory.content.processed.memorableMoments
        .map(m => `${m.content}${m.emotionTag ? ` (${m.emotionTag})` : ''}`)
        .join('；');
      parts.push(`【难忘时刻】${moments}`);
    }

    // Add pending topics
    if (memory.pendingTopics?.topics?.length > 0) {
      const topics = memory.pendingTopics.topics
        .map(t => t.topic || t)
        .join('、');
      parts.push(`【待处理话题】${topics}`);
    }

    // Add raw content if not enough processed content
    if (parts.length === 0 && memory.content?.raw) {
      // Try to parse raw content
      try {
        const parsed = JSON.parse(memory.content.raw);
        if (Array.isArray(parsed)) {
          const rawText = parsed
            .map(m => `${m.isOwner ? '我' : '对方'}: ${m.content}`)
            .join('\n');
          parts.push(`【对话记录】\n${rawText}`);
        } else {
          parts.push(`【原始内容】${memory.content.raw}`);
        }
      } catch {
        parts.push(`【原始内容】${memory.content.raw}`);
      }
    }

    return parts.join('\n') || '无记忆内容';
  }

  /**
   * Format processed content for V2 compression
   * @param {Object} processed - Processed content object
   * @returns {string} Formatted string
   */
  formatProcessedContent(processed) {
    const parts = [];

    if (processed.summary) {
      parts.push(processed.summary);
    }

    if (processed.keyTopics?.length > 0) {
      parts.push(`话题: ${processed.keyTopics.join('、')}`);
    }

    if (processed.facts?.length > 0) {
      parts.push(`事实: ${processed.facts.join('；')}`);
    }

    return parts.join('\n');
  }

  /**
   * Format personality from role card for prompts
   * @param {Object} roleCard - Role card object with coreLayer
   * @returns {string} Formatted personality text
   */
  formatPersonality(roleCard) {
    if (!roleCard || !roleCard.coreLayer) {
      return '未提供人格特质信息';
    }

    const coreLayer = roleCard.coreLayer;
    const sections = [];

    // Add personality description
    if (coreLayer.personality?.summary || coreLayer.personality?.compressed) {
      sections.push(`【性格特质】${coreLayer.personality.summary || coreLayer.personality.compressed}`);
    }

    // Add communication style
    if (coreLayer.communicationStyle?.summary || coreLayer.communicationStyle?.compressed) {
      sections.push(`【沟通风格】${coreLayer.communicationStyle.summary || coreLayer.communicationStyle.compressed}`);
    }

    // Add values
    if (coreLayer.values?.keyPoints?.length > 0) {
      sections.push(`【价值观】${coreLayer.values.keyPoints.join('；')}`);
    } else if (coreLayer.values?.compressed) {
      sections.push(`【价值观】${coreLayer.values.compressed}`);
    }

    // Add interests
    if (coreLayer.interests?.keyPoints?.length > 0) {
      sections.push(`【兴趣爱好】${coreLayer.interests.keyPoints.join('；')}`);
    } else if (coreLayer.interests?.compressed) {
      sections.push(`【兴趣爱好】${coreLayer.interests.compressed}`);
    }

    // Add emotional needs
    if (coreLayer.emotionalNeeds?.keyPoints?.length > 0) {
      sections.push(`【情感需求】${coreLayer.emotionalNeeds.keyPoints.join('；')}`);
    } else if (coreLayer.emotionalNeeds?.compressed) {
      sections.push(`【情感需求】${coreLayer.emotionalNeeds.compressed}`);
    }

    return sections.length > 0 ? sections.join('\n') : '未提供人格特质信息';
  }

  /**
   * Parse LLM response to JSON
   * @param {string} response - Raw LLM response
   * @returns {Object} Parsed JSON object
   */
  parseResponse(response) {
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

      return JSON.parse(jsonStr);

    } catch (error) {
      memoryLogger.error('Failed to parse LLM response', {
        error: error.message,
        responsePreview: response.substring(0, 500)
      });

      throw new Error(`Failed to parse compression response: ${error.message}`);
    }
  }

  /**
   * Health check for the compressor
   * @returns {Promise<boolean>} Whether the compressor is healthy
   */
  async healthCheck() {
    try {
      const isHealthy = await this.llmClient.healthCheck();
      memoryLogger.debug('Health check result', { isHealthy });
      return isHealthy;
    } catch (error) {
      memoryLogger.error('Health check failed', { error: error.message });
      return false;
    }
  }
}

export default Compressor;
