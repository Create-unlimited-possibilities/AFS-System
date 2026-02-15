import express from 'express';
import Question from '../models/question.js';
import Answer from '../models/answer.js';
import User from '../../user/model.js';
import { protect } from '../../auth/middleware.js';
import StorageService from '../../../core/storage/service.js';
import { countTokens } from '../../../core/utils/tokens.js';

const router = express.Router();
const storageService = new StorageService();

// 1. 获取所有层次的进度（用于左侧面板）
router.get('/progress', protect, async (req, res) => {
  try {
    const { role = 'elder' } = req.query;
    const userId = req.user.id;

    const layers = ['basic', 'emotional'];
    const result = {};

    for (const layer of layers) {
      const questions = await Question.countDocuments({ role, layer, active: true });
      const answered = await Answer.countDocuments({
        targetUserId: userId,
        userId: userId,
        questionLayer: layer
      });

      result[layer] = {
        total: questions,
        answered,
        progress: questions > 0 ? Math.round((answered / questions) * 100) : 0
      };
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取进度失败' });
  }
});

// 2. 获取某个层次的所有问题 + 已答答案
router.get('/', protect, async (req, res) => {
  try {
    const { role = 'elder', layer = 'basic' } = req.query;
    const userId = req.user.id;

    const questions = await Question.find({ role, layer, active: true })
      .sort({ order: 1 })
      .lean();

    // 使用正确的 userId 和 targetUserId 查询已回答内容
    const memories = await Answer.find({
      targetUserId: userId,
      userId: userId,
      questionLayer: layer
    }).lean();

    const answerMap = {};
    memories.forEach(m => {
      // 处理两种情况：questionId 可能是字符串或 ObjectId
      const questionId = m.questionId._id ? m.questionId._id.toString() : m.questionId.toString();
      answerMap[questionId] = m.answer;
    });

    const result = questions.map(q => ({
      _id: q._id,
      order: q.order,
      question: q.question,
      placeholder: q.placeholder || '',
      type: q.type || 'textarea',
      answer: answerMap[q._id.toString()] || ''
    }));

    const total = questions.length;
    const answered = Object.keys(answerMap).length;

    res.json({
      success: true,
      questions: result,
      total,
      answered,
      progress: total > 0 ? Math.round((answered / total) * 100) : 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// 3. 保存/更新单条答案（支持批量保存）
router.post('/answer', protect, async (req, res) => {
  try {
    const { questionOrder, answer, layer, targetCode, targetEmail, relationshipType } = req.body;
    const userId = req.user.id;

    // 验证目标用户
    const targetUser = await User.findOne({ 
      uniqueCode: targetCode,
      email: targetEmail.toLowerCase()
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    // 不能为自己回答
    if (targetUser._id.toString() === userId.toString()) {
      return res.status(400).json({ success: false, error: '不能为自己回答问题' });
    }

    // 查找问题
    const question = await Question.findOne({
      order: questionOrder,
      layer,
      active: true
    });

    if (!question) {
      return res.status(404).json({ success: false, error: '问题不存在' });
    }

    const isSelfAnswer = false;
    const targetUserId = targetUser._id;

    const answerData = {
      userId,
      targetUserId,
      questionId: question._id,
      question,
      answer,
      layer,
      isSelfAnswer,
      relationshipType: relationshipType || 'friend',
      helper: req.user
    };

    const result = await storageService.saveAnswer(answerData);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    const tokenCount = countTokens(answer);
    await User.findByIdAndUpdate(targetUserId, {
      $inc: { 'companionChat.roleCard.memoryTokenCount': tokenCount }
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: '保存答案失败' });
  }
});

export default router;