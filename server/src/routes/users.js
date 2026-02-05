import express from 'express';
import userController from '../controllers/UserController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission as requirePermissionMiddleware } from '../middleware/permission.js';

const router = express.Router();

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
