/**
 * MemoryExtractor - LLM-based Memory Extraction
 * Extracts structured memories from conversations using LLM with personality filtering
 *
 * @author AFS Team
 * @version 1.0.0
 */

import LLMClient, { createDefaultLLMClient } from '../../core/llm/client.js';
import { buildMemoryExtractionPrompt, formatConversationForPrompt } from './prompts/memoryExtraction.js';
import TopicChunker from './TopicChunker.js';
import logger from '../../core/utils/logger.js';

const memoryLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'MEMORY_EXTRACTOR' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'MEMORY_EXTRACTOR' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'MEMORY_EXTRACTOR' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'MEMORY_EXTRACTOR' }),
};

class MemoryExtractor {
  constructor() {
    // 使用统一的LLM配置
    this.llmClient = createDefaultLLMClient();
    this.extractionTemperature = 0.3;
    this.topicChunker = new TopicChunker();
    memoryLogger.info('MemoryExtractor initialized', {
      model: this.llmClient.getModelInfo().model,
      backend: this.llmClient.getModelInfo().backend,
      temperature: this.extractionTemperature
    });
  }

  /**
   * Extract structured memory from conversation
   * @param {Object} options - Extraction options
   * @param {Object} options.roleCard - The role card object (with coreLayer)
   * @param {string} options.roleCardOwnerName - Name of role card owner
   * @param {string} options.interlocutorName - Name of conversation partner
   * @param {string} options.relationType - Relationship type (family, friend, etc.)
   * @param {Array} options.messages - Array of message objects
   * @returns {Promise<Object>} Extracted memory data
   */
  async extract(options) {
    const {
      roleCard,
      roleCardOwnerName,
      interlocutorName,
      relationType,
      messages
    } = options;

    memoryLogger.info('Starting memory extraction', {
      hasRoleCard: !!roleCard,
      ownerName: roleCardOwnerName,
      interlocutorName,
      relationType,
      messageCount: messages?.length || 0
    });

    // If no role card, return simplified raw memory
    if (!roleCard || !roleCard.coreLayer) {
      memoryLogger.info('No role card provided, creating raw memory');
      return this.createRawMemory(messages, { roleCardOwnerName, interlocutorName });
    }

    try {
      // Format personality and conversation for the prompt
      const personalityText = this.formatPersonality(roleCard.coreLayer);
      const conversationHistory = this.formatConversation(messages, roleCardOwnerName, interlocutorName);

      // Build the prompt
      const prompt = buildMemoryExtractionPrompt({
        roleCardPersonality: personalityText,
        roleCardOwnerName: roleCardOwnerName || '我',
        interlocutorName: interlocutorName || '对方',
        relationType: relationType || '未知',
        conversationHistory
      });

      memoryLogger.debug('Calling LLM for memory extraction');

      // Call LLM with the extraction prompt
      const response = await this.llmClient.generate(prompt, {
        temperature: 0.3,
        maxTokens: 2000
      });

      // Parse response
      const extractedData = this.parseResponse(response);

      // Add metadata
      const result = {
        ...extractedData,
        messageCount: messages?.length || 0,
        extractedAt: new Date().toISOString(),
        hasRoleCard: true
      };

      memoryLogger.info('Memory extraction completed', {
        topicSummary: result.topicSummary,
        retentionScore: result.personalityFiltered?.retentionScore,
        pendingTopicsCount: result.pendingTopics?.length || 0
      });

      return result;

    } catch (error) {
      memoryLogger.error('Memory extraction failed', {
        error: error.message,
        stack: error.stack
      });

      // Fallback to raw memory on error
      memoryLogger.warn('Falling back to raw memory');
      return this.createRawMemory(messages, { roleCardOwnerName, interlocutorName });
    }
  }

  /**
   * Extract structured memories from conversation with topic-based chunking
   * Uses TopicChunker to split conversation before extraction
   * @param {Object} options - Extraction options
   * @param {Object} options.roleCard - The role card object (with coreLayer)
   * @param {string} options.roleCardOwnerName - Name of role card owner
   * @param {string} options.interlocutorName - Name of conversation partner
   * @param {string} options.relationType - Relationship type (family, friend, etc.)
   * @param {Array} options.messages - Array of message objects
   * @param {boolean} options.wasInterrupted - Whether conversation was interrupted
   * @returns {Promise<Object>} Extraction result with array of chunk memories
   */
  async extractWithChunking(options) {
    const {
      roleCard,
      roleCardOwnerName,
      interlocutorName,
      relationType,
      messages,
      wasInterrupted = false
    } = options;

    memoryLogger.info('Starting memory extraction with chunking', {
      hasRoleCard: !!roleCard,
      ownerName: roleCardOwnerName,
      interlocutorName,
      relationType,
      messageCount: messages?.length || 0,
      wasInterrupted
    });

    // If no role card, return simplified raw memory without chunking
    if (!roleCard || !roleCard.coreLayer) {
      memoryLogger.info('No role card provided, creating raw memory without chunking');
      return {
        chunks: [{
          ...this.createRawMemory(messages, { roleCardOwnerName, interlocutorName }),
          chunkId: 'single',
          isChunked: false
        }],
        totalChunks: 1,
        hasIncompleteTopics: false,
        chunkingSkipped: true,
        skipReason: 'No role card provided'
      };
    }

    try {
      // Step 1: Chunk the conversation using TopicChunker
      const chunkingResult = await this.topicChunker.chunk({
        messages,
        roleCardOwnerName,
        interlocutorName,
        relationType,
        wasInterrupted
      });

      memoryLogger.info('Topic chunking completed', {
        totalChunks: chunkingResult.totalChunks,
        hasIncompleteTopics: chunkingResult.hasIncompleteTopics
      });

      // Step 2: Extract memory for each chunk
      const extractedChunks = [];
      for (let i = 0; i < chunkingResult.chunks.length; i++) {
        const chunk = chunkingResult.chunks[i];

        memoryLogger.debug(`Extracting memory for chunk ${i + 1}/${chunkingResult.chunks.length}`, {
          chunkId: chunk.id,
          messageCount: chunk.messageCount,
          isIncomplete: chunk.isIncomplete
        });

        // Extract memory for this chunk
        const extractedData = await this.extract({
          roleCard,
          roleCardOwnerName,
          interlocutorName,
          relationType,
          messages: chunk.messages
        });

        // Add chunk-specific metadata
        extractedChunks.push({
          ...extractedData,
          chunkId: chunk.id,
          chunkIndex: i,
          topicSummary: chunk.topicSummary || extractedData.topicSummary,
          messageIndices: chunk.messageIndices,
          isIncomplete: chunk.isIncomplete,
          completenessScore: chunk.completenessScore,
          suggestedFollowUp: chunk.suggestedFollowUp,
          isChunked: true
        });
      }

      const result = {
        chunks: extractedChunks,
        totalChunks: extractedChunks.length,
        hasIncompleteTopics: chunkingResult.hasIncompleteTopics,
        incompleteTopicChunks: chunkingResult.incompleteTopicChunks,
        analysisMetadata: {
          ...chunkingResult.analysisMetadata,
          extractedAt: new Date().toISOString()
        }
      };

      memoryLogger.info('Memory extraction with chunking completed', {
        totalChunks: result.totalChunks,
        hasIncompleteTopics: result.hasIncompleteTopics,
        incompleteCount: result.incompleteTopicChunks.length
      });

      return result;

    } catch (error) {
      memoryLogger.error('Memory extraction with chunking failed', {
        error: error.message,
        stack: error.stack
      });

      // Fallback to single extraction without chunking
      memoryLogger.warn('Falling back to single extraction without chunking');
      const singleExtraction = await this.extract({
        roleCard,
        roleCardOwnerName,
        interlocutorName,
        relationType,
        messages
      });

      return {
        chunks: [{
          ...singleExtraction,
          chunkId: 'fallback',
          isChunked: false
        }],
        totalChunks: 1,
        hasIncompleteTopics: wasInterrupted,
        chunkingFailed: true,
        error: error.message
      };
    }
  }

  /**
   * Format role card personality for prompt
   * @param {Object} coreLayer - The core layer from role card
   * @returns {string} Formatted personality text
   */
  formatPersonality(coreLayer) {
    if (!coreLayer) {
      return '未提供人格特质信息';
    }

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

    // Add preferences
    if (coreLayer.preferences?.keyPoints?.length > 0) {
      sections.push(`【偏好】${coreLayer.preferences.keyPoints.join('；')}`);
    } else if (coreLayer.preferences?.compressed) {
      sections.push(`【偏好】${coreLayer.preferences.compressed}`);
    }

    if (sections.length === 0) {
      return '未提供人格特质信息';
    }

    return sections.join('\n');
  }

  /**
   * Format messages array for prompt
   * @param {Array} messages - Array of message objects
   * @param {string} ownerName - Name of the role card owner
   * @param {string} partnerName - Name of the conversation partner
   * @returns {string} Formatted conversation string
   */
  formatConversation(messages, ownerName = '我', partnerName = '对方') {
    return formatConversationForPrompt(messages, ownerName, partnerName);
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

      const parsed = JSON.parse(jsonStr);

      // Validate required fields and set defaults
      return this.validateAndDefault(parsed);

    } catch (error) {
      memoryLogger.error('Failed to parse LLM response', {
        error: error.message,
        responsePreview: response.substring(0, 500)
      });

      // Return default structure on parse error
      return this.getDefaultExtraction();
    }
  }

  /**
   * Validate parsed data and set defaults for missing fields
   * @param {Object} data - Parsed data
   * @returns {Object} Validated data with defaults
   */
  validateAndDefault(data) {
    const defaults = this.getDefaultExtraction();

    return {
      summary: data.summary || defaults.summary,
      topicSummary: (data.topicSummary || defaults.topicSummary).substring(0, 10),
      keyTopics: Array.isArray(data.keyTopics) ? data.keyTopics : defaults.keyTopics,
      facts: Array.isArray(data.facts) ? data.facts : defaults.facts,
      emotionalJourney: {
        start: data.emotionalJourney?.start || '',
        peak: data.emotionalJourney?.peak || '',
        end: data.emotionalJourney?.end || ''
      },
      memorableMoments: Array.isArray(data.memorableMoments)
        ? data.memorableMoments.map(m => ({
            content: m.content || '',
            importance: typeof m.importance === 'number' ? m.importance : 0.5,
            emotionTag: m.emotionTag || '',
            reason: m.reason || ''
          }))
        : defaults.memorableMoments,
      pendingTopics: Array.isArray(data.pendingTopics)
        ? data.pendingTopics.map(t => ({
            topic: t.topic || '',
            context: t.context || '',
            suggestedFollowUp: t.suggestedFollowUp || '',
            urgency: ['high', 'medium', 'low'].includes(t.urgency) ? t.urgency : 'medium'
          }))
        : defaults.pendingTopics,
      personalityFiltered: {
        retentionScore: typeof data.personalityFiltered?.retentionScore === 'number'
          ? data.personalityFiltered.retentionScore
          : 0.7,
        likelyToRecall: Array.isArray(data.personalityFiltered?.likelyToRecall)
          ? data.personalityFiltered.likelyToRecall
          : [],
        likelyToForget: Array.isArray(data.personalityFiltered?.likelyToForget)
          ? data.personalityFiltered.likelyToForget
          : [],
        forgetReason: data.personalityFiltered?.forgetReason || ''
      },
      tags: Array.isArray(data.tags) ? data.tags : defaults.tags
    };
  }

  /**
   * Get default extraction structure
   * @returns {Object} Default extraction object
   */
  getDefaultExtraction() {
    return {
      summary: '对话记录待处理',
      topicSummary: '待处理',
      keyTopics: [],
      facts: [],
      emotionalJourney: {
        start: '',
        peak: '',
        end: ''
      },
      memorableMoments: [],
      pendingTopics: [],
      personalityFiltered: {
        retentionScore: 0.7,
        likelyToRecall: [],
        likelyToForget: [],
        forgetReason: ''
      },
      tags: ['unprocessed']
    };
  }

  /**
   * Create raw memory for users without role card
   * @param {Array} messages - Array of message objects
   * @param {Object} participants - Participant info
   * @returns {Object} Raw memory data
   */
  createRawMemory(messages, participants = {}) {
    const { roleCardOwnerName, interlocutorName } = participants;

    // Simple extraction without LLM
    const messageCount = messages?.length || 0;
    const firstMessage = messages?.[0]?.content || '';
    const topicSummary = firstMessage.substring(0, 10) || '对话';

    memoryLogger.info('Creating raw memory (no role card)', {
      messageCount,
      topicSummary
    });

    return {
      summary: `与${interlocutorName || '对方'}的对话，共${messageCount}条消息`,
      topicSummary,
      keyTopics: [],
      facts: [],
      emotionalJourney: {
        start: '',
        peak: '',
        end: ''
      },
      memorableMoments: [],
      pendingTopics: [],
      personalityFiltered: {
        retentionScore: 0.7,
        likelyToRecall: [],
        likelyToForget: [],
        forgetReason: '无角色卡，使用默认保留分值'
      },
      tags: ['pending_processing', 'needs_rolecard'],
      messageCount,
      needsProcessing: true,
      extractedAt: new Date().toISOString(),
      hasRoleCard: false
    };
  }

  /**
   * Batch process pending memories for a user
   * @param {string} userId - User ID
   * @param {Object} roleCard - User's role card
   * @param {Object} memoryStore - MemoryStore instance
   * @returns {Promise<Object>} Processing results
   */
  async processPendingMemories(userId, roleCard, memoryStore) {
    memoryLogger.info('Starting batch processing of pending memories', { userId });

    const results = {
      total: 0,
      processed: 0,
      failed: 0,
      skipped: 0,
      details: []
    };

    try {
      // Load all memories for user
      const allMemories = await memoryStore.loadUserMemories(userId);

      // Find memories needing processing
      const pendingMemories = [];

      for (const [partnerId, memories] of Object.entries(allMemories)) {
        for (const memory of memories) {
          // Check for pending_processing tag or needsProcessing flag
          const needsProcessing = memory.tags?.includes('pending_processing') ||
                                   memory.tags?.includes('needsProcessing') ||
                                   memory.needsProcessing === true;

          if (needsProcessing) {
            pendingMemories.push({
              partnerId,
              memory,
              filePath: memory._filePath
            });
          }
        }
      }

      results.total = pendingMemories.length;
      memoryLogger.info(`Found ${results.total} pending memories to process`);

      // Process each memory
      for (const { partnerId, memory, filePath } of pendingMemories) {
        try {
          // Determine compression stage based on age
          const createdAt = new Date(memory.meta?.createdAt);
          const ageInDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

          let compressionStage = 'raw';
          if (ageInDays >= 7) {
            compressionStage = 'v2';
          } else if (ageInDays >= 3) {
            compressionStage = 'v1';
          }

          // Parse raw conversation if available
          const rawContent = memory.content?.raw || '';
          let messages = [];

          // Try to parse raw content as messages array
          if (rawContent) {
            try {
              const parsed = JSON.parse(rawContent);
              messages = Array.isArray(parsed) ? parsed : (parsed.messages || []);
            } catch {
              // If not JSON, treat as single message
              messages = [{ content: rawContent, isOwner: true }];
            }
          }

          // Get relation type from memory meta or default
          const relationType = memory.meta?.relationType || 'unknown';

          // Extract with new role card
          const extractedData = await this.extract({
            roleCard,
            roleCardOwnerName: roleCard?.coreLayer?.basicIdentity?.name || '我',
            interlocutorName: `用户${partnerId}`,
            relationType,
            messages
          });

          // Update memory with extracted data
          const updates = {
            content: {
              raw: rawContent,
              processed: {
                summary: extractedData.summary,
                topicSummary: extractedData.topicSummary,
                keyTopics: extractedData.keyTopics,
                facts: extractedData.facts,
                emotionalJourney: extractedData.emotionalJourney,
                memorableMoments: extractedData.memorableMoments
              }
            },
            pendingTopics: {
              hasUnfinished: extractedData.pendingTopics.length > 0,
              topics: extractedData.pendingTopics
            },
            personalityFiltered: extractedData.personalityFiltered,
            tags: extractedData.tags.filter(t => t !== 'pending_processing' && t !== 'needsProcessing'),
            meta: {
              ...memory.meta,
              compressionStage,
              processedAt: new Date().toISOString()
            }
          };

          // Remove needsProcessing flag
          delete updates.needsProcessing;

          // Update the memory file
          if (filePath) {
            await memoryStore.updateMemory(filePath, updates);
          }

          results.processed++;
          results.details.push({
            memoryId: memory.memoryId,
            partnerId,
            status: 'processed',
            compressionStage
          });

          memoryLogger.info('Processed pending memory', {
            memoryId: memory.memoryId,
            partnerId,
            compressionStage
          });

        } catch (error) {
          results.failed++;
          results.details.push({
            memoryId: memory.memoryId,
            partnerId,
            status: 'failed',
            error: error.message
          });

          memoryLogger.error('Failed to process pending memory', {
            memoryId: memory.memoryId,
            partnerId,
            error: error.message
          });
        }
      }

      memoryLogger.info('Batch processing completed', {
        userId,
        total: results.total,
        processed: results.processed,
        failed: results.failed
      });

      return results;

    } catch (error) {
      memoryLogger.error('Batch processing failed', {
        userId,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Health check for the memory extractor
   * @returns {Promise<boolean>} Whether the extractor is healthy
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

export default MemoryExtractor;
