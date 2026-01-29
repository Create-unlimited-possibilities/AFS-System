// server/src/routes/answers.js - 问题回答API（重构版）
import express from 'express';
import Answer from '../models/Answer.js';
import Question from '../models/Question.js';
import User from '../models/User.js';
import AssistRelation from '../models/AssistRelation.js';
import { RAGEngine } from '../rag/rag_engine.js';

// 初始化RAG引擎
const ragEngine = new RAGEngine();

const router = express.Router();

// 获取所有问题（按层级和角色）
router.get('/questions', async (req, res) => {
  try {
    const { layer, role = 'elder' } = req.query;

    let query = { active: true };
    
    // 根据 role 参数过滤
    if (role) {
      query.role = role;
    }
    
    // 根据 layer 参数过滤
    if (layer) {
      query.layer = layer;
    }

    const questions = await Question.find(query).sort({ order: 1 }).lean();

    res.json({
      success: true,
      questions
    });

  } catch (err) {
    console.error('获取问题失败:', err);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

// 提交答案（自己回答自己的问题）
router.post('/answer/self', async (req, res) => {
  try {
    const userId = req.user.id;
    const { questionId, answer } = req.body;

    if (!questionId || !answer) {
      return res.status(400).json({ 
        success: false, 
        message: '问题ID和答案不能为空' 
      });
    }

    // 获取问题信息
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ 
        success: false, 
        message: '问题不存在' 
      });
    }

    // 创建或更新答案
    const existingAnswer = await Answer.findOne({
      userId,
      targetUserId: userId,
      questionId
    });

    if (existingAnswer) {
      // 更新现有答案
      existingAnswer.answer = answer;
      existingAnswer.updatedAt = new Date();
      await existingAnswer.save();

      res.json({
        success: true,
        message: '答案已更新',
        answer: existingAnswer
      });
    } else {
      // 创建新答案
      const newAnswer = new Answer({
        userId,
        targetUserId: userId,
        questionId,
        questionLayer: question.layer,
        answer,
        isSelfAnswer: true,
        relationshipType: 'self'
      });

      await newAnswer.save();

      res.json({
        success: true,
        message: '答案已保存',
        answer: newAnswer
      });
    }

  } catch (err) {
    console.error('保存答案失败:', err);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

// 协助他人回答问题
router.post('/answer/assist', async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId, questionId, answer } = req.body;

    if (!targetUserId || !questionId || !answer) {
      return res.status(400).json({ 
        success: false, 
        message: '目标用户ID、问题ID和答案不能为空' 
      });
    }

    // 验证协助关系
    const hasRelation = await AssistRelation.hasRelation(userId, targetUserId);
    if (!hasRelation) {
      return res.status(403).json({ 
        success: false, 
        message: '您没有协助该用户的权限' 
      });
    }

    // 获取关系类型
    const relation = await AssistRelation.findOne({
      assistantId: userId,
      targetId: targetUserId,
      isActive: true
    });

    // 获取问题信息
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ 
        success: false, 
        message: '问题不存在' 
      });
    }

    // 创建或更新答案
    const existingAnswer = await Answer.findOne({
      userId,
      targetUserId,
      questionId
    });

    if (existingAnswer) {
      existingAnswer.answer = answer;
      existingAnswer.updatedAt = new Date();
      await existingAnswer.save();

      res.json({
        success: true,
        message: '答案已更新',
        answer: existingAnswer
      });
    } else {
      const newAnswer = new Answer({
        userId,
        targetUserId,
        questionId,
        questionLayer: question.layer,
        answer,
        isSelfAnswer: false,
        relationshipType: relation.relationshipType
      });

      await newAnswer.save();

      res.json({
        success: true,
        message: '答案已保存',
        answer: newAnswer
      });
    }

  } catch (err) {
    console.error('保存协助答案失败:', err);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

// 获取自己的回答进度
router.get('/progress/self', async (req, res) => {
  try {
    const userId = req.user.id;

    const basicProgress = await Answer.getProgress(userId, userId, 'basic');
    const emotionalProgress = await Answer.getProgress(userId, userId, 'emotional');

    const totalProgress = basicProgress.total + emotionalProgress.total;
    const totalAnswered = basicProgress.answered + emotionalProgress.answered;
    const overallPercentage = totalProgress > 0 
      ? Math.round((totalAnswered / totalProgress) * 100) 
      : 0;

    res.json({
      success: true,
      progress: {
        basic: basicProgress,
        emotional: emotionalProgress,
        overall: {
          total: totalProgress,
          answered: totalAnswered,
          percentage: overallPercentage
        }
      }
    });

  } catch (err) {
    console.error('获取进度失败:', err);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

// 获取我的所有答案
router.get('/answers/self', async (req, res) => {
  try {
    const userId = req.user.id;
    const { layer } = req.query;

    const query = {
      userId,
      targetUserId: userId
    };

    if (layer) {
      query.questionLayer = layer;
    }

    const answers = await Answer.find(query)
      .populate('questionId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      answers: answers.map(a => ({
        id: a._id,
        question: a.questionId.question,
        questionLayer: a.questionLayer,
        answer: a.answer,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      }))
    });

  } catch (err) {
    console.error('获取答案失败:', err);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

// 获取他人对我的回答统计
router.get('/answers/from-others', async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await Answer.getAnswerStats(userId);

    // 获取详细的回答信息
    const answersFromOthers = await Answer.find({
      targetUserId: userId,
      userId: { $ne: userId }
    }).populate('userId', 'name email').populate('questionId');

    // 按贡献者分组
    const groupedByContributor = {};
    answersFromOthers.forEach(answer => {
      const contributorId = answer.userId._id.toString();
      if (!groupedByContributor[contributorId]) {
        groupedByContributor[contributorId] = {
          contributor: {
            id: answer.userId._id,
            name: answer.userId.name,
            email: answer.userId.email
          },
          relationshipType: answer.relationshipType,
          answers: [],
          basicCount: 0,
          emotionalCount: 0
        };
      }
      
      groupedByContributor[contributorId].answers.push({
        id: answer._id,
        question: answer.questionId.question,
        questionLayer: answer.questionLayer,
        answer: answer.answer,
        createdAt: answer.createdAt
      });

      if (answer.questionLayer === 'basic') {
        groupedByContributor[contributorId].basicCount++;
      } else if (answer.questionLayer === 'emotional') {
        groupedByContributor[contributorId].emotionalCount++;
      }
    });

    res.json({
      success: true,
      contributors: Object.values(groupedByContributor)
    });

  } catch (err) {
    console.error('获取他人回答失败:', err);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

// 获取我协助他人的回答
router.get('/answers/assist/:targetUserId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.params;

    // 验证协助关系
    const hasRelation = await AssistRelation.hasRelation(userId, targetUserId);
    if (!hasRelation) {
      return res.status(403).json({ 
        success: false, 
        message: '您没有查看该用户答案的权限' 
      });
    }

    const answers = await Answer.find({
      userId,
      targetUserId
    }).populate('questionId').sort({ createdAt: -1 });

    // 获取进度
    const basicProgress = await Answer.getProgress(userId, targetUserId, 'basic');
    const emotionalProgress = await Answer.getProgress(userId, targetUserId, 'emotional');

    res.json({
      success: true,
      answers: answers.map(a => ({
        id: a._id,
        question: a.questionId.question,
        questionLayer: a.questionLayer,
        answer: a.answer,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      })),
      progress: {
        basic: basicProgress,
        emotional: emotionalProgress
      }
    });

  } catch (err) {
    console.error('获取协助答案失败:', err);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

// 批量保存自己的答案（覆盖保存）
router.post('/answers/batch-self', async (req, res) => {
  try {
    const userId = req.user.id;
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ 
        success: false, 
        message: '答案数据格式错误' 
      });
    }

    // 获取用户信息
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    // 删除用户的所有旧答案
    await Answer.deleteMany({ userId, targetUserId: userId });

    // 批量插入新答案
    const answerDocs = [];
    for (const answerData of answers) {
      const question = await Question.findById(answerData.questionId);
      if (!question) continue;

      answerDocs.push({
        userId,
        targetUserId: userId,
        questionId: answerData.questionId,
        questionLayer: question.layer,
        answer: answerData.answer,
        isSelfAnswer: true,
        relationshipType: 'self'
      });
    }

    if (answerDocs.length > 0) {
      await Answer.insertMany(answerDocs);
    }

    // 生成JSONL文件
    await generateJSONL(userId, user.uniqueCode);

    // 异步更新RAG索引
    setTimeout(async () => {
      try {
        await ragEngine.update_user_index(user.uniqueCode);
        console.log(`RAG索引更新成功: ${user.uniqueCode}`);
      } catch (indexErr) {
        console.error(`RAG索引更新失败: ${user.uniqueCode}`, indexErr);
      }
    }, 0);

    res.json({
      success: true,
      message: '答案保存成功',
      savedCount: answerDocs.length
    });

  } catch (err) {
    console.error('批量保存答案失败:', err);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

// 批量保存协助他人的答案
router.post('/answers/batch-assist', async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId, answers } = req.body;

    if (!targetUserId || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ 
        success: false, 
        message: '数据格式错误' 
      });
    }

    // 验证协助关系
    const hasRelation = await AssistRelation.hasRelation(userId, targetUserId);
    if (!hasRelation) {
      return res.status(403).json({ 
        success: false, 
        message: '您没有协助该用户的权限' 
      });
    }

    // 获取关系类型
    const relation = await AssistRelation.findOne({
      assistantId: userId,
      targetId: targetUserId,
      isActive: true
    });

    // 获取目标用户信息
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        message: '目标用户不存在' 
      });
    }

    // 删除该协助者为目标用户的所有旧答案
    await Answer.deleteMany({ userId, targetUserId });

    // 批量插入新答案
    const answerDocs = [];
    for (const answerData of answers) {
      const question = await Question.findById(answerData.questionId);
      if (!question) continue;

      answerDocs.push({
        userId,
        targetUserId,
        questionId: answerData.questionId,
        questionLayer: question.layer,
        answer: answerData.answer,
        isSelfAnswer: false,
        relationshipType: relation.relationshipType
      });
    }

    if (answerDocs.length > 0) {
      await Answer.insertMany(answerDocs);
    }

    // 重新生成目标用户的JSONL文件（包含所有人的答案）
    await generateJSONL(targetUserId, targetUser.uniqueCode);

    // 异步更新RAG索引
    setTimeout(async () => {
      try {
        await ragEngine.update_user_index(targetUser.uniqueCode);
        console.log(`RAG索引更新成功: ${targetUser.uniqueCode}`);
      } catch (indexErr) {
        console.error(`RAG索引更新失败: ${targetUser.uniqueCode}`, indexErr);
      }
    }, 0);

    res.json({
      success: true,
      message: '协助答案保存成功',
      savedCount: answerDocs.length
    });

  } catch (err) {
    console.error('批量保存协助答案失败:', err);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

// 生成JSONL文件（用于LLM训练）
async function generateJSONL(targetUserId, uniqueCode) {
  try {
    // 获取目标用户的所有答案（包括自己和他人的）
    const answers = await Answer.find({ targetUserId })
      .populate('questionId')
      .populate('userId', 'name uniqueCode')
      .sort({ questionLayer: 1, questionId: 1 });

    // 使用JSONLBuilder生成RAG优化的JSONL文件
    const JSONLBuilder = (await import('../utils/jsonl_builder.js')).default;
    await JSONLBuilder.buildFromDatabase(answers, uniqueCode, 'rag');

 } catch (err) {
    console.error('生成JSONL文件失败:', err);
    // 不抛出错误，避免影响主流程
  }
}

export default router;
