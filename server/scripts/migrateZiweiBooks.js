/**
 * 迁移 ziwei-project 书籍 chunks 到 ChromaDB
 *
 * Source: F:\FPY\ziwei-project\data\rag\chunks\
 * Target: ChromaDB collection 'ziwei_books'
 *
 * This script:
 * 1. Loads JSONL chunk files from the ziwei-project
 * 2. Generates embeddings using Ollama (bge-m3 model)
 * 3. Stores chunks in ChromaDB for RAG retrieval
 *
 * @author AFS Team
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ChromaDBService from '../src/core/storage/chroma.js';
import EmbeddingService from '../src/core/storage/embedding.js';
import logger from '../src/core/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
// In Docker container, use mounted path; locally use project-relative path
const IS_DOCKER = process.env.DOCKER_ENV === 'true' || process.cwd().startsWith('/app');
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CHUNKS_DIR = IS_DOCKER ? '/app/ziwei-chunks' : path.join(PROJECT_ROOT, 'data', 'ziwei-chunks');
const COLLECTION_NAME = 'ziwei_books';
const BATCH_SIZE = 50; // Process in batches to avoid memory issues

/**
 * Load all JSONL chunks from directory
 * @returns {Array} Array of chunk objects with content, source, chunk_id
 */
function loadChunks() {
  const chunks = [];

  // Check if directory exists
  if (!fs.existsSync(CHUNKS_DIR)) {
    logger.error(`[LoadChunks] Chunks directory not found: ${CHUNKS_DIR}`);
    logger.info('[LoadChunks] Please ensure the ziwei-project exists at the specified path');
    return chunks;
  }

  const files = fs.readdirSync(CHUNKS_DIR).filter(f => f.endsWith('.jsonl'));

  logger.info(`[LoadChunks] Found ${files.length} JSONL files to process`);

  for (const file of files) {
    const filePath = path.join(CHUNKS_DIR, file);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const data = JSON.parse(line);

          // Validate chunk has content
          if (data.content && data.content.trim()) {
            chunks.push({
              content: data.content.trim(),
              source: data.source || path.basename(file, '.jsonl'),
              chunk_id: data.chunk_id || 0,
            });
          }
        } catch (e) {
          logger.warn(`[LoadChunks] Failed to parse line in ${file}: ${e.message}`);
        }
      }

      logger.info(`[LoadChunks] Loaded ${lines.length} chunks from ${file}`);
    } catch (error) {
      logger.error(`[LoadChunks] Failed to read file ${file}:`, error.message);
    }
  }

  return chunks;
}

/**
 * Generate UUID for ChromaDB
 * ChromaDB v2 requires valid UUIDs for all document IDs
 * @returns {string} Valid UUID string
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Migrate chunks to ChromaDB
 * Processes chunks in batches to avoid memory issues
 */
async function migrateChunks() {
  logger.info('========================================');
  logger.info('Starting ziwei books migration...');
  logger.info('========================================');

  // Initialize services
  const chromaService = new ChromaDBService();
  const embeddingService = new EmbeddingService();

  try {
    await chromaService.initialize();
    await embeddingService.initialize();

    // Health check
    const chromaHealth = await chromaService.healthCheck();
    const embedHealth = await embeddingService.healthCheck();

    if (!chromaHealth) {
      throw new Error('ChromaDB health check failed');
    }
    if (!embedHealth) {
      throw new Error('Embedding service health check failed');
    }

    // Create or get collection
    const collection = await chromaService.getCollection(COLLECTION_NAME, {
      description: 'Ziwei fortune-telling book chunks for RAG',
      source: 'ziwei-project',
      migrated_at: new Date().toISOString()
    });

    logger.info(`[Migrate] Collection '${COLLECTION_NAME}' ready`);

    // Load chunks
    const chunks = loadChunks();
    logger.info(`[Migrate] Total chunks to migrate: ${chunks.length}`);

    if (chunks.length === 0) {
      logger.warn('[Migrate] No chunks found to migrate');
      return;
    }

    // Check existing count
    const existingCount = await collection.count();
    if (existingCount > 0) {
      logger.info(`[Migrate] Collection already has ${existingCount} chunks`);
      logger.info('[Migrate] Delete the collection first if you want to re-migrate');
      logger.info('[Migrate] Or set CLEAR_COLLECTION=true to overwrite');

      if (process.env.CLEAR_COLLECTION === 'true') {
        logger.info('[Migrate] Clearing collection...');
        await chromaService.deleteCollection(COLLECTION_NAME);
        // Recreate collection
        const newCollection = await chromaService.getCollection(COLLECTION_NAME, {
          description: 'Ziwei fortune-telling book chunks for RAG'
        });
        // Update collection reference
        Object.assign(collection, newCollection);
        logger.info('[Migrate] Collection cleared and ready for migration');
      } else {
        logger.info('[Migrate] Migration skipped (collection not empty)');
        logger.info('[Migrate] Set CLEAR_COLLECTION=true to force re-migration');
        return;
      }
    }

    // Process in batches
    let processed = 0;
    let failed = 0;
    const startTime = Date.now();

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

      logger.info(`[Migrate] Processing batch ${batchNumber}/${totalBatches} (${batch.length} chunks)...`);

      try {
        // Generate embeddings
        const texts = batch.map(c => c.content);
        const embeddings = await embeddingService.embedDocuments(texts);

        // Prepare data for ChromaDB
        const ids = batch.map(() => generateUUID());
        const documents = batch.map(c => c.content);
        const metadatas = batch.map(c => ({
          source: c.source,
          chunk_id: c.chunk_id,
          migrated_at: new Date().toISOString()
        }));

        // Add to collection
        await collection.add({
          ids,
          embeddings,
          documents,
          metadatas
        });

        processed += batch.length;
        const progress = ((processed / chunks.length) * 100).toFixed(1);
        logger.info(`[Migrate] Progress: ${processed}/${chunks.length} (${progress}%)`);
      } catch (error) {
        failed += batch.length;
        logger.error(`[Migrate] Failed to migrate batch ${batchNumber}:`, error.message);
      }
    }

    // Verify
    const finalCount = await collection.count();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.info('========================================');
    logger.info('Migration Complete');
    logger.info('========================================');
    logger.info(`Total chunks:     ${chunks.length}`);
    logger.info(`Successfully migrated: ${processed}`);
    logger.info(`Failed:           ${failed}`);
    logger.info(`Collection count: ${finalCount}`);
    logger.info(`Duration:         ${duration}s`);
    logger.info('========================================');

    // Summary by source
    const sourceCounts = {};
    chunks.forEach(c => {
      sourceCounts[c.source] = (sourceCounts[c.source] || 0) + 1;
    });
    logger.info('[Migrate] Summary by source:');
    for (const [source, count] of Object.entries(sourceCounts)) {
      logger.info(`  ${source}: ${count} chunks`);
    }

  } catch (error) {
    logger.error('[Migrate] Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateChunks()
  .then(() => {
    logger.info('[Migrate] Migration script finished successfully');
    process.exit(0);
  })
  .catch(error => {
    logger.error('[Migrate] Migration failed:', error);
    process.exit(1);
  });
