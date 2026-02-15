import express from 'express';
import authController from './controller.js';
import { protect } from './middleware.js';

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);

router.get('/me', protect, (req, res) => {
  authController.getMe(req, res);
});

// 协助关系路由 (暂时保留在 auth 模块，兼容现有 API)
import assistController from '../assist/controller.js';

router.get('/assist/search', protect, (req, res) => {
  assistController.searchUser(req, res);
});
router.post('/assist/verify', protect, (req, res) => {
  assistController.createRelation(req, res);
});
router.get('/assist/relations', protect, (req, res) => {
  assistController.getRelations(req, res);
});
router.get('/assist/helpers', protect, (req, res) => {
  assistController.getHelpers(req, res);
});
router.delete('/assist/relations/:relationId', protect, (req, res) => {
  assistController.deleteRelation(req, res);
});
router.get('/assist/check-incomplete', protect, (req, res) => {
  assistController.getIncompleteRelations(req, res);
});
router.post('/assist/batch-update-relations', protect, (req, res) => {
  assistController.batchUpdateRelations(req, res);
});

export default router;
