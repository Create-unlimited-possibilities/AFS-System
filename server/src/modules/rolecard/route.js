import express from 'express';
import rolecardController from './controller.js';
import { protect } from '../auth/middleware.js';

const router = express.Router();

// 普通生成（无进度）
router.post('/generate', protect, (req, res) => {
  rolecardController.generateRoleCard(req, res);
});

// SSE 生成（带进度推送）
router.post('/generate/stream', protect, (req, res) => {
  rolecardController.generateRoleCardWithProgress(req, res);
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

// 获取各层生成状态
router.get('/layers/status', protect, (req, res) => {
  rolecardController.getLayersStatus(req, res);
});

// 单独生成核心层（SSE）
router.post('/layers/core/stream', protect, (req, res) => {
  rolecardController.generateCoreLayerStream(req, res);
});

// 单独生成某个关系层（SSE）
router.post('/layers/relation/:relationId/stream', protect, (req, res) => {
  rolecardController.generateRelationLayerStream(req, res);
});

export default router;
