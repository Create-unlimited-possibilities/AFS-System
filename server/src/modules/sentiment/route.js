import express from 'express';
import sentimentController from './controller.js';
import { protect } from '../auth/middleware.js';

const router = express.Router();

router.get('/:targetUserId/:strangerId', protect, (req, res) => {
  sentimentController.getSentiment(req, res);
});

router.put('/:targetUserId/:strangerId', protect, (req, res) => {
  sentimentController.updateSentiment(req, res);
});

router.post('/:targetUserId/:strangerId/analyze', protect, (req, res) => {
  sentimentController.analyzeSentiment(req, res);
});

router.get('/:targetUserId/stats', protect, (req, res) => {
  sentimentController.getStats(req, res);
});

router.post('/batch-update', protect, (req, res) => {
  sentimentController.batchUpdate(req, res);
});

export default router;
