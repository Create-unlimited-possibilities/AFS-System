import express from 'express';
import {
  generateRoleCard,
  getRoleCard,
  checkASetProgress,
  regenerateRoleCard,
  preprocessAllGuidelines,
  preprocessOneGuideline,
  updateOneGuideline,
  getOneGuideline,
  getAllGuidelines
} from '../controllers/companionship.js';
import { protect } from '../src/middleware/auth.js';
import { requirePermission } from '../src/middleware/permission.js';

const router = express.Router();

/**
 * @route   POST /api/companionship/generate-rolecard
 * @desc    生成角色卡
 * @access  Private
 */
router.post('/generate-rolecard', protect, requirePermission('companionship:create'), generateRoleCard);

/**
 * @route   GET /api/companionship/rolecard
 * @desc    获取角色卡
 * @access  Private
 */
router.get('/rolecard', protect, requirePermission('companionship:view'), getRoleCard);

/**
 * @route   GET /api/companionship/rolecard/:userId
 * @desc    获取指定用户的角色卡
 * @access  Private (Admin only)
 */
router.get('/rolecard/:userId', protect, requirePermission('companionship:view'), getRoleCard);

/**
 * @route   GET /api/companionship/progress/a-set
 * @desc    检查A套题进度
 * @access  Private
 */
router.get('/progress/a-set', protect, requirePermission('companionship:view'), checkASetProgress);

/**
 * @route   GET /api/companionship/progress/a-set/:userId
 * @desc    检查指定用户的A套题进度
 * @access  Private (Admin only)
 */
router.get('/progress/a-set/:userId', protect, requirePermission('companionship:view'), checkASetProgress);

/**
 * @route   POST /api/companionship/regenerate-rolecard
 * @desc    重新生成角色卡
 * @access  Private
 */
router.post('/regenerate-rolecard', protect, requirePermission('companionship:update'), regenerateRoleCard);

/**
 * @route   POST /api/companionship/preprocess-guidelines
 * @desc    预处理所有协助者的对话准则
 * @access  Private
 */
router.post('/preprocess-guidelines', protect, requirePermission('companionship:create'), preprocessAllGuidelines);

/**
 * @route   POST /api/companionship/preprocess-guideline/:assistantId
 * @desc    预处理单个协助者的对话准则
 * @access  Private
 */
router.post('/preprocess-guideline/:assistantId', protect, requirePermission('companionship:create'), preprocessOneGuideline);

/**
 * @route   POST /api/companionship/update-guideline/:assistantId
 * @desc    更新单个协助者的对话准则（增量更新）
 * @access  Private
 */
router.post('/update-guideline/:assistantId', protect, requirePermission('companionship:update'), updateOneGuideline);

/**
 * @route   GET /api/companionship/guidelines/:assistantId
 * @desc    获取单个协助者的对话准则
 * @access  Private
 */
router.get('/guidelines/:assistantId', protect, requirePermission('companionship:view'), getOneGuideline);

/**
 * @route   GET /api/companionship/all-guidelines
 * @desc    获取所有协助者的对话准则
 * @access  Private
 */
router.get('/all-guidelines', protect, requirePermission('companionship:view'), getAllGuidelines);

export default router;