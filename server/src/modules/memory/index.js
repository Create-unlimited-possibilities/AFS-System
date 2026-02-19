/**
 * Memory Management Module
 * Handles conversation memory storage, extraction, and compression
 *
 * @module memory
 */

import MemoryStore from './MemoryStore.js';
import MemoryExtractor from './MemoryExtractor.js';
import Compressor from './Compressor.js';
import Scheduler from './Scheduler.js';
import PendingTopicsManager from './PendingTopicsManager.js';
import ProactiveMessagingManager from './ProactiveMessagingManager.js';

export {
  MemoryStore,
  MemoryExtractor,
  Compressor,
  Scheduler,
  PendingTopicsManager,
  ProactiveMessagingManager
};

export default {
  MemoryStore,
  MemoryExtractor,
  Compressor,
  Scheduler,
  PendingTopicsManager,
  ProactiveMessagingManager
};
