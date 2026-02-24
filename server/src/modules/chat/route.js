import express from 'express';
import chatController from './controller.js';
import { protect } from '../auth/middleware.js';

const router = express.Router();

router.post('/sessions/by-code', protect, (req, res) => {
  chatController.createSessionByCode(req, res);
});

router.post('/sessions/:sessionId/messages', protect, (req, res) => {
  chatController.sendMessage(req, res);
});

router.get('/sessions/:sessionId/messages', protect, (req, res) => {
  chatController.getSessionMessages(req, res);
});

router.post('/sessions/:sessionId/end', protect, (req, res) => {
  chatController.endSession(req, res);
});

router.get('/sessions/active', protect, (req, res) => {
  chatController.getActiveSessions(req, res);
});

router.get('/stats', protect, (req, res) => {
  chatController.getStats(req, res);
});

router.get('/sentiment/:strangerId', protect, (req, res) => {
  chatController.getStrangerSentiment(req, res);
});

router.get('/contacts', protect, (req, res) => {
  chatController.getContacts(req, res);
});

// 预加载会话 - 点击联系人时调用
router.get('/sessions/preload/:targetUserId', protect, (req, res) => {
  chatController.preloadSession(req, res);
});

// 结束聊天会话 - 更新记忆
router.post('/sessions/:sessionId/end-chat', protect, (req, res) => {
  chatController.endChatSession(req, res);
});

// ==================== Indexing Wait Mechanism Routes ====================

// Get session status (for checking if indexing)
router.get('/sessions/:sessionId/status', protect, (req, res) => {
  chatController.getSessionStatus(req, res);
});

// Process pending messages after indexing completes
router.post('/sessions/:sessionId/process-pending', protect, (req, res) => {
  chatController.processPendingMessages(req, res);
});

// Set session to indexing mode (internal, triggered by token threshold)
router.post('/sessions/:sessionId/set-indexing', protect, (req, res) => {
  chatController.setSessionIndexing(req, res);
});

// Set session back to active mode
router.post('/sessions/:sessionId/set-active', protect, (req, res) => {
  chatController.setSessionActive(req, res);
});

export default router;
