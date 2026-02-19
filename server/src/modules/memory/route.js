/**
 * Memory Routes
 * API endpoints for memory management
 *
 * @author AFS Team
 * @version 2.0.0
 */

import express from 'express';
import { protect } from '../auth/middleware.js';
import {
  getIndexStatus,
  checkBusy,
  getPendingTopics,
  clearPendingTopic,
  triggerIndexing,
  getMemoryStats,
  checkProactive,
  generateProactive,
  getProactiveStatus,
  getPendingTopicsV2,
  addPendingTopic,
  clearPendingTopicV2
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
 * @desc Get all pending conversation topics (legacy, from memory files)
 * @access Private
 */
router.get('/pending-topics', getPendingTopics);

/**
 * @route GET /api/memory/pending-topics/v2
 * @desc Get all pending conversation topics from dedicated manager
 * @access Private
 */
router.get('/pending-topics/v2', getPendingTopicsV2);

/**
 * @route POST /api/memory/pending-topics
 * @desc Add a new pending topic
 * @access Private
 */
router.post('/pending-topics', addPendingTopic);

/**
 * @route DELETE /api/memory/pending-topics/:topicId
 * @desc Clear a specific pending topic (legacy)
 * @access Private
 */
router.delete('/pending-topics/:topicId', clearPendingTopic);

/**
 * @route DELETE /api/memory/pending-topics/v2/:topicId
 * @desc Clear a specific pending topic from dedicated manager
 * @access Private
 */
router.delete('/pending-topics/v2/:topicId', clearPendingTopicV2);

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

/**
 * @route GET /api/memory/proactive/check/:withUserId
 * @desc Check if should send a proactive message
 * @access Private
 */
router.get('/proactive/check/:withUserId', checkProactive);

/**
 * @route POST /api/memory/proactive/generate/:withUserId
 * @desc Generate a proactive message
 * @access Private
 */
router.post('/proactive/generate/:withUserId', generateProactive);

/**
 * @route GET /api/memory/proactive/status/:withUserId
 * @desc Get proactive messaging status
 * @access Private
 */
router.get('/proactive/status/:withUserId', getProactiveStatus);

export default router;
