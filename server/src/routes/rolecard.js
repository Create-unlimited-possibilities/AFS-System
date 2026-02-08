import express from 'express';
import rolecardController from '../controllers/RoleCardController.js';
import { protect } from '../middleware/auth.js';

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

export default router;
