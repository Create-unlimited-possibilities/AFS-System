import express from 'express';
import roleController from '../controllers/RoleController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';

const router = express.Router();

router.get('/permissions', protect, requirePermission('permission:view'), (req, res) => {
  roleController.getAllPermissions(req, res);
});

router.post('/permissions', protect, requirePermission('permission:create'), (req, res) => {
  roleController.createPermission(req, res);
});

router.put('/permissions/:id', protect, requirePermission('permission:update'), (req, res) => {
  roleController.updatePermission(req, res);
});

router.delete('/permissions/:id', protect, requirePermission('permission:delete'), (req, res) => {
  roleController.deletePermission(req, res);
});

router.get('/', protect, requirePermission('role:view'), (req, res) => {
  roleController.getAllRoles(req, res);
});

router.get('/:id', protect, requirePermission('role:view'), (req, res) => {
  roleController.getRoleById(req, res);
});

router.post('/', protect, requirePermission('role:create'), (req, res) => {
  roleController.createRole(req, res);
});

router.put('/:id', protect, requirePermission('role:update'), (req, res) => {
  roleController.updateRole(req, res);
});

router.delete('/:id', protect, requirePermission('role:delete'), (req, res) => {
  roleController.deleteRole(req, res);
});

router.post('/initialize', protect, (req, res) => {
  roleController.initializeDefaults(req, res);
});

export default router;
