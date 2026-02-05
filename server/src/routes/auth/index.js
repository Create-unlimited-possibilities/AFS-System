import express from 'express';
import authController from '../../controllers/AuthController.js';
import assistController from '../../controllers/AssistController.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);

router.get('/me', protect, (req, res) => {
  authController.getMe(req, res);
});

// 协助关系路由
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
