/**
 * 紫微斗数 RAG 服务
 * 用于检索相关书籍内容 from ChromaDB
 *
 * This service:
 * 1. Retrieves relevant book chunks based on user queries
 * 2. Supports palace and star-based retrieval
 * 3. Returns formatted context for LLM prompt building
 *
 * @author AFS Team
 * @version 1.0.0
 */

import ChromaDBService from '../storage/chroma.js';
import EmbeddingService from '../storage/embedding.js';
import logger from '../utils/logger.js';

const COLLECTION_NAME = 'ziwei_books';
const DEFAULT_TOP_K = 5;

/**
 * Ziwei RAG Service Class
 * Singleton pattern for managing ChromaDB connection and retrievals
 */
class ZiweiRagService {
  constructor() {
    this.chromaService = null;
    this.embeddingService = null;
    this.collection = null;
    this.initialized = false;
  }

  /**
   * Initialize the service and connect to ChromaDB
   * @throws {Error} If initialization fails
   */
  async initialize() {
    if (this.initialized && this.collection) {
      return;
    }

    try {
      this.chromaService = new ChromaDBService();
      this.embeddingService = new EmbeddingService();

      await this.chromaService.initialize();
      await this.embeddingService.initialize();

      // Get or create the ziwei_books collection
      this.collection = await this.chromaService.getCollection(COLLECTION_NAME, {
        description: 'Ziwei fortune-telling book chunks for RAG'
      });

      this.initialized = true;
      logger.info(`[ZiweiRagService] Initialized with collection '${COLLECTION_NAME}'`);
    } catch (error) {
      logger.error('[ZiweiRagService] Initialization failed:', error);
      throw new Error(`Failed to initialize ZiweiRagService: ${error.message}`);
    }
  }

  /**
   * 检索相关书籍内容
   * Retrieve relevant book content based on query text
   *
   * @param {string} query - Query text to search for
   * @param {number} [topK=5] - Number of results to return
   * @returns {Promise<Array>} Array of relevant content chunks with metadata
   *
   * @example
   * const results = await ziweiRag.retrieve('命宫在午宫的特点', 3);
   * // Returns: [{ content, source, chunk_id, distance }, ...]
   */
  async retrieve(query, topK = DEFAULT_TOP_K) {
    await this.initialize();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      logger.warn('[ZiweiRagService] Empty query provided');
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingService.embedQuery(query);

      // Search in ChromaDB
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK
      });

      // Format results
      if (!results.documents || !results.documents[0]) {
        logger.info(`[ZiweiRagService] No results found for query: "${query.substring(0, 50)}..."`);
        return [];
      }

      const formattedResults = results.documents[0].map((doc, idx) => ({
        content: doc,
        source: results.metadatas?.[0]?.[idx]?.source || '未知',
        chunk_id: results.metadatas?.[0]?.[idx]?.chunk_id || 0,
        distance: results.distances?.[0]?.[idx] || 0
      }));

      logger.info(`[ZiweiRagService] Retrieved ${formattedResults.length} results for query`);
      return formattedResults;
    } catch (error) {
      logger.error('[ZiweiRagService] Retrieve failed:', error);
      return [];
    }
  }

  /**
   * 根据宫位检索相关内容
   * Retrieve content related to a specific palace
   *
   * @param {string} palace - Palace name (e.g., '命宫', '财帛宫')
   * @param {number} [topK=5] - Number of results
   * @returns {Promise<Array>} Relevant content chunks
   *
   * @example
   * const results = await ziweiRag.retrieveByPalace('命宫', 3);
   */
  async retrieveByPalace(palace, topK = DEFAULT_TOP_K) {
    if (!palace) {
      logger.warn('[ZiweiRagService] No palace specified');
      return [];
    }

    const query = `${palace}的特点和意义`;
    return this.retrieve(query, topK);
  }

  /**
   * 根据星曜检索相关内容
   * Retrieve content related to specific stars
   *
   * @param {string[]} stars - Array of star names (e.g., ['紫微', '天府'])
   * @param {number} [topK=5] - Number of results
   * @returns {Promise<Array>} Relevant content chunks
   *
   * @example
   * const results = await ziweiRag.retrieveByStars(['紫微', '天府'], 3);
   */
  async retrieveByStars(stars, topK = DEFAULT_TOP_K) {
    if (!stars || !Array.isArray(stars) || stars.length === 0) {
      logger.warn('[ZiweiRagService] No stars specified');
      return [];
    }

    const query = stars.join(' ');
    return this.retrieve(query, topK);
  }

  /**
   * 根据宫位或星曜检索相关内容
   * Retrieve content based on palace and/or stars
   *
   * @param {string} palace - Palace name
   * @param {string[]} stars - Array of star names
   * @param {number} [topK=5] - Number of results
   * @returns {Promise<Array>} Relevant content chunks
   *
   * @example
   * const results = await ziweiRag.retrieveByPalaceAndStars('命宫', ['紫微'], 3);
   */
  async retrieveByPalaceAndStars(palace, stars = [], topK = DEFAULT_TOP_K) {
    const queryParts = [];

    if (palace) {
      queryParts.push(`${palace}宫`);
    }

    if (stars.length > 0) {
      queryParts.push(stars.join('、'));
    }

    if (queryParts.length === 0) {
      logger.warn('[ZiweiRagService] No palace or stars specified');
      return [];
    }

    const query = queryParts.join('有');
    return this.retrieve(query, topK);
  }

  /**
   * 根据用户问题智能检索
   * Intelligently retrieve based on user question and chart data
   *
   * @param {string} question - User's question
   * @param {Object} chartData - Natal chart data with relevant palaces
   * @param {number} [topK=5] - Number of results
   * @returns {Promise<Array>} Relevant content chunks
   *
   * @example
   * const results = await ziweiRag.retrieveWithContext(
   *   '我的事业发展如何',
   *   { relevantPalaces: [{ name: '命宫', majorStars: ['紫微'] }] }
   * );
   */
  async retrieveWithContext(question, chartData = {}, topK = DEFAULT_TOP_K) {
    const queryParts = [question];

    // Add relevant palace context if available
    if (chartData.relevantPalaces && chartData.relevantPalaces.length > 0) {
      const palaceContexts = chartData.relevantPalaces.map(p => {
        const stars = p.majorStars?.join('、') || '';
        return `${p.name}${stars ? '有' + stars : ''}`;
      });
      queryParts.push(...palaceContexts);
    }

    const enhancedQuery = queryParts.join('，');
    return this.retrieve(enhancedQuery, topK);
  }

  /**
   * Format retrieved results as context for LLM
   *
   * @param {Array} results - Retrieved results from retrieve()
   * @param {number} [maxChars=2000] - Maximum characters to include
   * @returns {string} Formatted context string
   *
   * @example
   * const results = await ziweiRag.retrieve('命宫');
   * const context = ziweiRag.formatAsContext(results);
   * // Returns: "参考紫微斗数书籍内容：\n1. 命宫...\n2. ..."
   */
  formatAsContext(results, maxChars = 2000) {
    if (!results || results.length === 0) {
      return '';
    }

    let context = '参考紫微斗数书籍内容：\n';
    let totalChars = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const item = `${i + 1}. ${result.content}\n`;

      if (totalChars + item.length > maxChars) {
        context += `(省略部分内容...)\n`;
        break;
      }

      context += item;
      totalChars += item.length;
    }

    return context;
  }

  /**
   * Health check for the service
   * @returns {Promise<boolean>} True if service is healthy
   */
  async healthCheck() {
    try {
      await this.initialize();
      const count = await this.collection.count();
      logger.info(`[ZiweiRagService] Health check passed, collection has ${count} chunks`);
      return count > 0;
    } catch (error) {
      logger.warn('[ZiweiRagService] Health check failed:', error.message);
      return false;
    }
  }

  /**
   * Get collection statistics
   * @returns {Promise<Object>} Statistics about the collection
   */
  async getStats() {
    await this.initialize();

    try {
      const count = await this.collection.count();
      return {
        collectionName: COLLECTION_NAME,
        totalChunks: count,
        initialized: this.initialized
      };
    } catch (error) {
      logger.error('[ZiweiRagService] Failed to get stats:', error);
      return {
        collectionName: COLLECTION_NAME,
        totalChunks: 0,
        initialized: this.initialized,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export default new ZiweiRagService();
