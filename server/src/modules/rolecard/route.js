import express from 'express';
import rolecardController from './controller.js';
import { protect } from '../auth/middleware.js';

const router = express.Router();

router.post('/generate', protect, (req, res) => {
  rolecardController.generateRoleCard(req, res);
});

router.get('/', protect, (req, res) => {
  rolecardController.getRoleCard(req, res);
});

router.put('/', protect, (req, res) => {
  rolecardController.updateRoleCard(req, res);
});

router.delete('/', protect, (req, res) => {
  rolecardController.deleteRoleCard(req, res);
});

router.post('/assistants/:assistantId/regenerate', protect, (req, res) => {
  rolecardController.regenerateAssistantGuidelines(req, res);
});

router.post('/vector-index/build', protect, (req, res) => {
  rolecardController.buildVectorIndex(req, res);
});

router.get('/vector-index/status', protect, (req, res) => {
  rolecardController.getVectorIndexStatus(req, res);
});

export default router;
