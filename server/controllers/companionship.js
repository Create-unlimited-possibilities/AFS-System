/**
 * AI陪伴功能控制器
 * 处理角色卡生成、对话准则预处理等API请求
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import { roleCardGenerator } from '../src/services/langchain/roleCardGenerator.js';
import { assistantsGuidelinesPreprocessor } from '../src/services/langchain/assistantsGuidelinesPreprocessor.js';
import User from '../src/models/User.js';
import AssistRelation from '../src/models/AssistRelation.js';
import logger from '../src/utils/logger.js';

const successResponse = (data = null, message = 'Success') => ({
  success: true,
  message,
  data
});

const errorResponse = (message = 'Error', errors = null) => ({
  success: false,
  message,
  errors
});

/**
 * 生成角色卡
 * POST /api/companionship/generate-rolecard
 */
export const generateRoleCard = async (req, res) => {
  const userId = req.user?._id || req.body.userId;

  if (!userId) {
    return res.status(400).json(errorResponse('用户ID不能为空'));
  }

  try {
    logger.info(`[CompanionshipController] 开始为用户 ${userId} 生成角色卡`);

    // 检查用户是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(errorResponse('用户不存在'));
    }

    // 检查是否已生成过角色卡
    if (user.companionChat.roleCard && user.companionChat.roleCard.generatedAt) {
      logger.info(`[CompanionshipController] 用户 ${userId} 已有角色卡`);
      return res.status(200).json(successResponse({
        message: '角色卡已存在',
        roleCard: user.companionChat.roleCard,
        isExisting: true
      }));
    }

    // 生成角色卡
    const result = await roleCardGenerator.generateRoleCard(userId);

    logger.info(`[CompanionshipController] 角色 卡生成成功`);

    return res.status(200).json(successResponse({
      message: '角色卡生成成功',
      roleCard: result.roleCard,
      progress: result.progress,
      currentMode: result.currentMode,
      duration: result.duration,
      isExisting: false
    }));

  } catch (error) {
    logger.error(`[CompanionshipController] 生成角色卡失败:`, error);

    if (error.message.includes('进度不足')) {
      return res.status(400).json(errorResponse(error.message));
    }

    return res.status(500).json(errorResponse(`生成角色卡失败: ${error.message}`));
  }
};

/**
 * 获取角色卡
 * GET /api/companionship/rolecard
 */
export const getRoleCard = async (req, res) => {
  const userId = req.user?._id || req.params.userId;

  if (!userId) {
    return res.status(400).json(errorResponse('用户ID不能为空'));
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(errorResponse('用户不存在'));
    }

    const roleCard = user.companionChat?.roleCard;
    if (!roleCard) {
      return res.status(404).json(errorResponse('角色卡不存在'));
    }

    return res.status(200).json(successResponse({
      roleCard,
      hasBaseModel: user.companionChat?.modelStatus?.hasBaseModel || false,
      currentMode: user.companionChat?.currentMode || 'mode1'
    }));

  } catch (error) {
    logger.error(`[CompanionshipController] 获取角色卡失败:`, error);
    return res.status(500).json(errorResponse(`获取角色卡失败: ${error.message}`));
  }
};

/**
 * 检查A套题进度
 * GET /api/companionship/progress/a-set
 */
export const checkASetProgress = async (req, res) => {
  const userId = req.user?._id || req.params.userId;

  if (!userId) {
    return res.status(400).json(errorResponse('用户ID不能为空'));
  }

  try {
    const progress = await roleCardGenerator.checkASetProgress(userId);
    return res.status(200).json(successResponse(progress));

  } catch (error) {
    logger.error(`[CompanionshipController] 检查A套题进度失败:`, error);
    return res.status(500).json(errorResponse(`检查A套题进度失败: ${error.message}`));
  }
};

/**
 * 重新生成角色卡
 * POST /api/companionship/regenerate-rolecard
 */
export const regenerateRoleCard = async (req, res) => {
  const userId = req.user?._id || req.body.userId;

  if (!userId) {
    return res.status(400).json(errorResponse('用户ID不能为空'));
  }

  try {
    logger.info(`[CompanionshipController] 开始为用户 ${userId} 重新生成角色卡`);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(errorResponse('用户不存在'));
    }

    // 生成角色卡
    const result = await roleCardGenerator.generateRoleCard(userId);

    logger.info(`[CompanionshipController] 角色卡重新生成成功`);

    return res.status(200).json(successResponse({
      message: '角色卡重新生成成功',
      roleCard: result.roleCard,
      progress: result.progress,
      currentMode: result.currentMode,
      duration: result.duration
    }));

  } catch (error) {
    logger.error(`[CompanionshipController] 重新生成角色卡失败:`, error);
    return res.status(500).json(errorResponse(`重新生成角色卡失败: ${error.message}`));
  }
};

/**
 * 预处理所有协助者的对话准则
 * POST /api/companionship/preprocess-guidelines
 */
export const preprocessAllGuidelines = async (req, res) => {
  const userId = req.user?._id || req.body.userId;

  if (!userId) {
    return res.status(400).json(errorResponse('用户ID不能为空'));
  }

  try {
    logger.info(`[CompanionshipController] 开始为用户 ${userId} 预处理所有协助者的对话准则`);

    const result = await assistantsGuidelinesPreprocessor.preprocessAll(userId);

    logger.info(`[CompanionshipController] 所有协助者的对话准则预处理完成`);

    return res.status(200).json(successResponse({
      message: '对话准则预处理完成',
      total: result.total,
      successful: result.successful,
      failed: result.failed,
      guidelines: result.guidelines,
      errors: result.errors,
      duration: result.duration
    }));

  } catch (error) {
    logger.error(`[CompanionshipController] 预处理所有协助者的对话准则失败:`, error);
    return res.status(500).json(errorResponse(`预处理对话准则失败: ${error.message}`));
  }
};

/**
 * 预处理单个协助者的对话准则
 * POST /api/companionship/preprocess-guideline/:assistantId
 */
export const preprocessOneGuideline = async (req, res) => {
  const userId = req.user?._id || req.body.userId;
  const assistantId = req.params.assistantId;

  if (!userId) {
    return res.status(400).json(errorResponse('用户ID不能为空'));
  }

  if (!assistantId) {
    return res.status(400).json(errorResponse('协助者ID不能为空'));
  }

  try {
    logger.info(`[CompanionshipController] 开始为用户 ${userId} 预处理协助者 ${assistantId} 的对话准则`);

    const relation = await AssistRelation.findOne({ 
      assistantId: userId, 
      targetId: assistantId, 
      isActive: true 
    });

    if (!relation) {
      return res.status(404).json(errorResponse('协助关系不存在'));
    }

    const result = await assistantsGuidelinesPreprocessor.preprocessOne(userId, assistantId, relation);

    logger.info(`[CompanionshipController] 协助者 ${assistantId} 的对话准则预处理完成`);

    return res.status(200).json(successResponse({
      message: '对话准则预处理完成',
      guideline: result.guideline,
      duration: result.duration
    }));

  } catch (error) {
    logger.error(`[CompanionshipController] 预处理协助者对话准则失败:`, error);
    return res.status(500).json(errorResponse(`预处理对话准则失败: ${error.message}`));
  }
};

/**
 * 更新单个协助者的对话准则（增量更新）
 * POST /api/companionship/update-guideline/:assistantId
 */
export const updateOneGuideline = async (req, res) => {
  const userId = req.user?._id || req.body.userId;
  const assistantId = req.params.assistantId;

  if (!userId) {
    return res.status(400).json(errorResponse('用户ID不能为空'));
  }

  if (!assistantId) {
    return res.status(400).json(errorResponse('协助者ID不能为空'));
  }

  try {
    logger.info(`[CompanionshipController] 开始为用户 ${userId} 更新协助者 ${assistantId} 的对话准则`);

    const result = await assistantsGuidelinesPreprocessor.updateOneGuideline(userId, assistantId);

    logger.info(`[CompanionshipController] 协助者 ${assistantId} 的对话准则更新完成`);

    return res.status(200).json(successResponse({
      message: '对话准则更新完成',
      guideline: result.guideline,
      duration: result.duration
    }));

  } catch (error) {
    logger.error(`[CompanionshipController] 更新协助者对话准则失败:`, error);
    return res.status(500).json(errorResponse(`更新对话准则失败: ${error.message}`));
  }
};

/**
 * 获取单个协助者的对话准则
 * GET /api/companionship/guidelines/:assistantId
 */
export const getOneGuideline = async (req, res) => {
  const userId = req.user?._id;
  const assistantId = req.params.assistantId;

  if (!userId) {
    return res.status(401).json(errorResponse('用户未认证'));
  }

  if (!assistantId) {
    return res.status(400).json(errorResponse('协助者ID不能为空'));
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(errorResponse('用户不存在'));
    }

    const guideline = (user.companionChat?.assistantsGuidelines || [])
      .find(g => g.assistantId.toString() === assistantId);

    if (!guideline) {
      return res.status(404).json(errorResponse('对话准则不存在'));
    }

    return res.status(200).json(successResponse({
      guideline
    }));

  } catch (error) {
    logger.error(`[CompanionshipController] 获取协助者对话准则失败:`, error);
    return res.status(500).json(errorResponse(`获取对话准则失败: ${error.message}`));
  }
};

/**
 * 获取所有协助者的对话准则
 * GET /api/companionship/all-guidelines
 */
export const getAllGuidelines = async (req, res) => {
  const userId = req.user?._id || req.params.userId;

  if (!userId) {
    return res.status(400).json(errorResponse('用户ID不能为空'));
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(errorResponse('用户不存在'));
    }

    const guidelines = user.companionChat?.assistantsGuidelines || [];
    const count = guidelines.length;
    const hasBaseModel = user.companionChat?.modelStatus?.hasBaseModel || false;

    return res.status(200).json(successResponse({
      guidelines,
      count,
      hasBaseModel
    }));

  } catch (error) {
    logger.error(`[CompanionshipController] 获取所有协助者对话准则失败:`, error);
    return res.status(500).json(errorResponse(`获取所有对话准则失败: ${error.message}`));
  }
};