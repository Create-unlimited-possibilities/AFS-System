/**
 * Memory Routes
 * API endpoints for memory management
 *
 * @author AFS Team
 * @version 1.0.0
 */

import express from 'express';
import { protect } from '../auth/middleware.js';
import {
  getIndexStatus,
  checkBusy,
  getPendingTopics,
  clearPendingTopic,
  triggerIndexing,
  getMemoryStats
} from './controller.js';

const router = express.Router();

// All memory routes require authentication
router.use(protect);

/**
 * @route GET /api/memory/index/status
 * @desc Get indexing status and memory statistics
 * @access Private
 */
router.get('/index/status', getIndexStatus);

/**
 * @route GET /api/memory/busy
 * @desc Check if memory system is busy indexing
 * @access Private
 */
router.get('/busy', checkBusy);

/**
 * @route GET /api/memory/pending-topics
 * @desc Get all pending conversation topics
 * @access Private
 */
router.get('/pending-topics', getPendingTopics);

/**
 * @route DELETE /api/memory/pending-topics/:topicId
 * @desc Clear a specific pending topic
 * @access Private
 */
router.delete('/pending-topics/:topicId', clearPendingTopic);

/**
 * @route POST /api/memory/index/trigger
 * @desc Trigger indexing for all pending memories
 * @access Private
 */
router.post('/index/trigger', triggerIndexing);

/**
 * @route GET /api/memory/stats
 * @desc Get memory statistics for current user
 * @access Private
 */
router.get('/stats', getMemoryStats);

export default router;
