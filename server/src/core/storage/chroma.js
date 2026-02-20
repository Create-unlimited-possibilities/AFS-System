/**
 * ChromaDB Client Service
 * 直接使用 ChromaDB v2 API（不依赖 chromadb npm 包）
 *
 * @author AFS Team
 * @version 2.0.0
 */

import logger from '../utils/logger.js';

const CHROMA_TENANT = 'default_tenant';
const CHROMA_DATABASE = 'default_database';

class ChromaDBService {
  constructor() {
    this.baseUrl = process.env.CHROMA_URL || 'http://localhost:8000';
    this.apiBase = `${this.baseUrl}/api/v2/tenants/${CHROMA_TENANT}/databases/${CHROMA_DATABASE}`;
  }

  /**
   * Make HTTP request to ChromaDB v2 API
   */
  async request(endpoint, options = {}) {
    const url = `${this.apiBase}${endpoint}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ChromaDB API error: ${response.status} - ${text}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  /**
   * Initialize - test connection
   */
  async initialize() {
    try {
      const collections = await this.listCollections();
      logger.info(`[ChromaDBService] Connected to ChromaDB at ${this.baseUrl}, found ${collections.length} collections`);
    } catch (error) {
      logger.error('[ChromaDBService] Failed to connect:', error.message);
      throw error;
    }
  }

  /**
   * Get or create collection
   */
  async getCollection(name, metadata = {}) {
    // Try to get existing collection
    const collections = await this.listCollections();
    const existing = collections.find(c => c.name === name);

    if (existing) {
      return new ChromaCollection(this.apiBase, existing.id, existing.name);
    }

    // Create new collection
    logger.info(`[ChromaDBService] Creating collection: ${name}`);
    const result = await this.request('/collections', {
      method: 'POST',
      body: JSON.stringify({ name, metadata: { description: `Memory collection for ${name}`, ...metadata } })
    });

    return new ChromaCollection(this.apiBase, result.id, result.name);
  }

  /**
   * Delete collection
   */
  async deleteCollection(name) {
    try {
      // First find the collection to get its UUID
      const collections = await this.listCollections();
      const collection = collections.find(c => c.name === name);

      if (!collection) {
        logger.warn(`[ChromaDBService] Collection not found: ${name}`);
        return;
      }

      // Delete using UUID
      await this.request(`/collections/${collection.id}`, { method: 'DELETE' });
      logger.info(`[ChromaDBService] Deleted collection: ${name}`);
    } catch (error) {
      logger.warn(`[ChromaDBService] Failed to delete collection ${name}:`, error.message);
    }
  }

  /**
   * List all collections
   */
  async listCollections() {
    return this.request('/collections');
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.listCollections();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * ChromaDB Collection wrapper
 */
class ChromaCollection {
  constructor(apiBase, id, name) {
    this.apiBase = apiBase;
    this.id = id;
    this.name = name;
  }

  /**
   * Convert memoryId to valid UUID for ChromaDB v2
   * Strips non-UUID prefix (e.g., "mem_" from "mem_xxx-xxx-xxx")
   */
  toValidUUID(id) {
    // If already a valid UUID, return as-is
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(id)) return id;

    // Strip prefix until we get to the UUID part
    const uuidMatch = id.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    if (uuidMatch) return uuidMatch[0];

    // Fallback: return as-is (will fail, but gives clear error)
    return id;
  }

  async request(endpoint, options = {}) {
    // ChromaDB v2 API requires collection UUID, not name
    const url = `${this.apiBase}/collections/${this.id}${endpoint}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ChromaDB API error: ${response.status} - ${text}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async add({ ids, embeddings, documents, metadatas }) {
    // ChromaDB v2 requires valid UUIDs - convert memoryIds
    const validIds = ids.map(id => this.toValidUUID(id));

    return this.request('/add', {
      method: 'POST',
      body: JSON.stringify({ ids: validIds, embeddings, documents, metadatas })
    });
  }

  async query({ queryEmbeddings, nResults = 10, where }) {
    return this.request('/query', {
      method: 'POST',
      body: JSON.stringify({ query_embeddings: queryEmbeddings, n_results: nResults, where })
    });
  }

  async get({ ids, where, limit }) {
    const body = {};
    if (ids) body.ids = ids.map(id => this.toValidUUID(id));
    if (where) body.where = where;
    if (limit) body.limit = limit;
    return this.request('/get', { method: 'POST', body: JSON.stringify(body) });
  }

  async delete({ ids, where }) {
    const body = {};
    if (ids) body.ids = ids.map(id => this.toValidUUID(id));
    if (where) body.where = where;
    return this.request('/delete', { method: 'POST', body: JSON.stringify(body) });
  }

  async count() {
    return this.request('/count');
  }
}

export default ChromaDBService;
