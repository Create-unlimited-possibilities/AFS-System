/**
 * ChromaDB Client Service
 * Wrapper for ChromaDB operations
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { ChromaClient } from 'chromadb';
import logger from '../utils/logger.js';

class ChromaDBService {
  constructor() {
    this.client = null;
    this.url = process.env.CHROMA_URL || 'http://localhost:8000';
  }

  /**
   * Initialize ChromaDB client
   */
  async initialize() {
    if (this.client) return;

    try {
      this.client = new ChromaClient({
        path: this.url
      });

      // Test connection
      await this.client.heartbeat();
      logger.info(`[ChromaDBService] Connected to ChromaDB at ${this.url}`);
    } catch (error) {
      logger.error('[ChromaDBService] Failed to connect:', error);
      throw error;
    }
  }

  /**
   * Get or create collection
   * @param {string} name - Collection name
   * @param {Object} metadata - Collection metadata
   * @returns {Promise<Object>} Collection
   */
  async getCollection(name, metadata = {}) {
    await this.initialize();

    try {
      // Try to get existing collection
      const collection = await this.client.getCollection({ name });
      return collection;
    } catch (error) {
      // Collection doesn't exist, create it
      logger.info(`[ChromaDBService] Creating collection: ${name}`);
      const collection = await this.client.createCollection({
        name,
        metadata: {
          description: `Memory collection for ${name}`,
          ...metadata
        }
      });
      return collection;
    }
  }

  /**
   * Delete collection
   * @param {string} name - Collection name
   */
  async deleteCollection(name) {
    await this.initialize();

    try {
      await this.client.deleteCollection({ name });
      logger.info(`[ChromaDBService] Deleted collection: ${name}`);
    } catch (error) {
      logger.warn(`[ChromaDBService] Failed to delete collection ${name}:`, error.message);
    }
  }

  /**
   * List all collections
   * @returns {Promise<Array>} Collection names
   */
  async listCollections() {
    await this.initialize();
    const collections = await this.client.listCollections();
    return collections.map(c => c.name);
  }

  /**
   * Health check
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      await this.initialize();
      await this.client.heartbeat();
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default ChromaDBService;
