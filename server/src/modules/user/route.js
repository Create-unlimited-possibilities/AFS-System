import express from 'express';
import userController from './controller.js';
import { protect } from '../auth/middleware.js';
import { requirePermission as requirePermissionMiddleware } from '../../core/middleware/permission.js';
import { profileLogger } from '../../core/utils/logger.js';

const router = express.Router();

// 个人档案路由 - 用户自己可以访问（不需要特殊权限）
router.get('/profile', protect, (req, res) => {
  profileLogger.info('GET /profile', { userId: req.user._id });
  userController.getProfile(req, res);
});

router.put('/profile', protect, (req, res) => {
  profileLogger.info('PUT /profile', { userId: req.user._id });
  userController.updateProfile(req, res);
});

router.get('/stats', protect, requirePermissionMiddleware('user:view'), (req, res) => {
  userController.getUserStats(req, res);
});

router.get('/', protect, requirePermissionMiddleware('user:view'), (req, res) => {
  userController.getAllUsers(req, res);
});

router.get('/:id', protect, requirePermissionMiddleware('user:view'), (req, res) => {
  userController.getUserById(req, res);
});

router.post('/', protect, requirePermissionMiddleware('user:create'), (req, res) => {
  userController.createUser(req, res);
});

router.put('/:id', protect, requirePermissionMiddleware('user:update'), (req, res) => {
  userController.updateUser(req, res);
});

router.delete('/:id', protect, requirePermissionMiddleware('user:delete'), (req, res) => {
  userController.deleteUser(req, res);
});

router.patch('/:id/toggle-status', protect, requirePermissionMiddleware('user:update'), (req, res) => {
  userController.toggleUserStatus(req, res);
});

export default router;
