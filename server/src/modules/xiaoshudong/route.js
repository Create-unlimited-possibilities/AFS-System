/**
 * XiaoShuDong Routes
 * API endpoints for the XiaoShuDong (小树洞) chat feature
 *
 * @author AFS Team
 * @version 1.0.0
 */

import express from 'express';
import controller from './controller.js';
import { protect } from '../auth/middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Send message to XiaoShuDong
router.post('/message', (req, res) => {
  controller.sendMessage(req, res);
});

// Get conversation history
router.get('/history', (req, res) => {
  controller.getHistory(req, res);
});

// Get current session state
router.get('/session', (req, res) => {
  controller.getSession(req, res);
});

// End current session
router.post('/end', (req, res) => {
  controller.endSession(req, res);
});

// Get service health status
router.get('/health', (req, res) => {
  controller.health(req, res);
});

export default router;
