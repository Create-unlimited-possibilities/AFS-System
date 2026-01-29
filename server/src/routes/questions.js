// server/src/routes/questions.js
import express from 'express';
import Question from '../models/Question.js';
import Memory from '../models/Memory.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// 1. 获取所有层次的进度（用于左侧面板）
router.get('/progress', protect, async (req, res) => {
  try {
    const { role = 'elder', elderCode } = req.query;
    const userId = req.user.id;

    const layers = ['basic', 'emotional', 'ethics'];
    const result = {};

    for (const layer of layers) {
      const questions = await Question.countDocuments({ role, layer, active: true });
      const answered = await Memory.countDocuments({
        elderCode,
        contributorId: userId,
        layer
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
    const { role = 'elder', layer = 'basic', elderCode } = req.query;
    const userId = req.user.id;

    const questions = await Question.find({ role, layer, active: true })
      .sort({ order: 1 })
      .lean();

    const memories = await Memory.find({
      elderCode,
      contributorId: userId,
      layer
    }).lean();

    const answerMap = {};
    memories.forEach(m => { answerMap[m.questionOrder] = m.answer; });

    const result = questions.map(q => ({
      _id: q._id,
      order: q.order,
      question: q.question,
      placeholder: q.placeholder || '',
      type: q.type || 'textarea',
      answer: answerMap[q.order] || ''
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

// 3. 保存/更新单条答案
router.post('/answer', protect, async (req, res) => {
  try {
    const { questionOrder, answer, layer, elderCode } = req.body;
    const contributorId = req.user.id;

    await Memory.findOneAndUpdate(
      { elderCode, contributorId, questionOrder, layer },
      { answer, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

export default router;