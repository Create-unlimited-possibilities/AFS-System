import express from 'express';
import settingsController from '../controllers/SettingsController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';

const router = express.Router();

router.get('/', protect, requirePermission('system:view'), (req, res) => {
  settingsController.getAllSettings(req, res);
});

router.put('/:category', protect, requirePermission('system:update'), (req, res) => {
  settingsController.updateSettings(req, res);
});

router.get('/info', protect, requirePermission('system:view'), (req, res) => {
  settingsController.getSystemInfo(req, res);
});

router.post('/reset', protect, requirePermission('system:update'), (req, res) => {
  settingsController.resetSystem(req, res);
});

export default router;
