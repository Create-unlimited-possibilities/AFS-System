import express from 'express';
import chatController from '../controllers/ChatController.js';
import { protect } from '../middleware/auth.js';

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

export default router;
