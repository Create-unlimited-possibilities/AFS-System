import AnswerService from './services/answer.js';
import QuestionService from './services/question.js';
import Question from './models/question.js';
import Answer from './models/answer.js';
import User from '../user/model.js';
import AssistRelation from '../assist/model.js';

// 实例化服务类
const answerService = new AnswerService();
const questionService = new QuestionService();

class AnswerController {
  async getQuestions(req, res) {
    try {
      const { layer = 'basic', role = 'elder' } = req.query;
      const userId = req.user?.id || req.user?._id;

      console.log(`[AnswerController] 获取问题 - userId: ${userId}, layer: ${layer}, role: ${role}`);

      // 获取问题列表
      const questions = await Question.find({ role, layer, active: true })
        .sort({ order: 1 })
        .lean();

      console.log(`[AnswerController] 问题总数: ${questions.length}`);

      // 获取用户已回答的问题
      const answeredQuestions = userId ? await answerService.getSelfAnswers(userId, layer) : [];

      console.log(`[AnswerController] 已回答问题数: ${answeredQuestions.length}`);

      // 创建答案映射
      const answerMap = {};
      answeredQuestions.forEach(a => {
        // 处理两种情况：questionId 可能是字符串或 ObjectId
        const questionId = a.questionId._id ? a.questionId._id.toString() : a.questionId.toString();
        answerMap[questionId] = a.answer;
      });

      // 计算已回答数量
      const answered = Object.keys(answerMap).length;

      console.log(`[AnswerController] 已匹配答案数: ${answered}`);

      // 将问题转换为前端期望的格式
      const formattedQuestions = questions.map(q => ({
        _id: q._id.toString(),
        order: q.order,
        category: layer,
        questionText: q.question,
        questionType: q.type || 'textarea',
        placeholder: q.placeholder || '',
        options: [],
        answer: answerMap[q._id.toString()] || ''
      }));

      const responseData = {
        success: true,
        data: {
          questions: formattedQuestions,
          total: questions.length,
          answered,
          progress: questions.length > 0 ? Math.round((answered / questions.length) * 100) : 0
        }
      };

      console.log(`[AnswerController] 返回数据: total=${responseData.data.total}, answered=${responseData.data.answered}, progress=${responseData.data.progress}%`);

      res.json(responseData);
    } catch (error) {
      console.error('获取问题失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async saveSelfAnswer(req, res) {
    try {
      const userId = req.user.id;
      const { questionId, answer } = req.body;

      if (!questionId || !answer) {
        return res.status(400).json({
          success: false,
          error: '问题ID和答案不能为空'
        });
      }

      const savedAnswer = await answerService.saveSelfAnswer(userId, questionId, answer);

      res.json({
        success: true,
        message: '答案已保存',
        answer: savedAnswer
      });
    } catch (error) {
      console.error('保存答案失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async saveAssistAnswer(req, res) {
    try {
      const userId = req.user.id;
      const { targetUserId, questionId, answer } = req.body;

      if (!targetUserId || !questionId || !answer) {
        return res.status(400).json({
          success: false,
          error: '目标用户ID、问题ID和答案不能为空'
        });
      }

      const savedAnswer = await answerService.saveAssistAnswer(userId, targetUserId, questionId, answer);

      res.json({
        success: true,
        message: '答案已保存',
        answer: savedAnswer
      });
    } catch (error) {
      console.error('保存协助答案失败:', error);
      res.status(403).json({
        success: false,
        error: error.message
      });
    }
  }

  async getSelfProgress(req, res) {
    try {
      const userId = req.user.id;
      const progress = await answerService.getSelfProgress(userId);

      res.json({
        success: true,
        progress
      });
    } catch (error) {
      console.error('获取进度失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getSelfAnswers(req, res) {
    try {
      const userId = req.user?.id || req.user?._id;
      const { layer } = req.query;
      const answers = await answerService.getSelfAnswers(userId, layer);

      res.json({
        success: true,
        data: answers.map(a => ({
          id: a._id,
          questionId: a.questionId?._id?.toString() || a.questionId?.toString(),
          question: a.questionId?.question,
          questionLayer: a.questionLayer,
          answer: a.answer,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt
        }))
      });
    } catch (error) {
      console.error('获取答案失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAnswersFromOthers(req, res) {
    try {
      const userId = req.user.id;
      const contributors = await answerService.getAnswersFromOthers(userId);

      // 直接返回分组数据，包含每个协助者的基础和情感层次回答统计
      res.json({
        success: true,
        data: {
          contributors,
          totalContributors: contributors.length,
          totalAnswers: contributors.reduce((sum, contributor) => 
            sum + contributor.basicCount + contributor.emotionalCount, 0),
          basicAnswers: contributors.reduce((sum, contributor) => 
            sum + contributor.basicCount, 0),
          emotionalAnswers: contributors.reduce((sum, contributor) => 
            sum + contributor.emotionalCount, 0)
        }
      });
    } catch (error) {
      console.error('获取他人回答失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getContributorAnswers(req, res) {
    try {
      const userId = req.user.id;
      const { contributorId } = req.params;
      const { answers, contributor } = await answerService.getContributorAnswers(userId, contributorId);

      res.json({
        success: true,
        answers: answers.map(a => ({
          id: a._id,
          questionId: a.questionId._id,
          question: a.questionId.question,
          questionLayer: a.questionLayer,
          answer: a.answer,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt
        })),
        contributor
      });
    } catch (error) {
      console.error('获取贡献者答案失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async batchSaveSelfAnswers(req, res) {
    try {
      const userId = req.user.id;
      const { answers } = req.body;

      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({
          success: false,
          error: '答案数据格式错误'
        });
      }

      const result = await answerService.batchSaveSelfAnswers(userId, answers);

      res.json({
        success: true,
        message: '答案保存成功',
        savedCount: result.savedCount
      });
    } catch (error) {
      console.error('批量保存答案失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async batchSaveAssistAnswers(req, res) {
    try {
      const userId = req.user.id;
      const { targetUserId, answers } = req.body;

      if (!targetUserId || !answers || !Array.isArray(answers)) {
        return res.status(400).json({
          success: false,
          error: '数据格式错误'
        });
      }

      const result = await answerService.batchSaveAssistAnswers(userId, targetUserId, answers);

      res.json({
        success: true,
        message: '协助答案保存成功',
        savedCount: result.savedCount
      });
    } catch (error) {
      console.error('批量保存协助答案失败:', error);
      res.status(403).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAssistQuestions(req, res) {
    try {
      const { targetUserId } = req.query;
      const userId = req.user.id;

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          error: 'targetUserId参数不能为空'
        });
      }

      const relation = await AssistRelation.findOne({
        assistantId: userId,
        targetId: targetUserId,
        isActive: true
      });

      if (!relation) {
        return res.status(403).json({
          success: false,
          error: '您没有协助该用户的权限'
        });
      }

      const questions = await Question.find({
        role: relation.relationshipType,
        active: true
      }).sort({ layer: 1, order: 1 });

      const answeredQuestions = await answerService.getAssistAnswers(userId, targetUserId);

      const answerMap = {};
      answeredQuestions.forEach(a => {
        const questionId = a.questionId._id ? a.questionId._id.toString() : a.questionId.toString();
        answerMap[questionId] = a.answer;
      });

      const formattedQuestions = questions.map(q => ({
        _id: q._id.toString(),
        order: q.order,
        category: q.layer,
        questionText: q.question,
        questionType: q.type || 'textarea',
        placeholder: q.placeholder || '',
        answer: answerMap[q._id.toString()] || ''
      }));

      res.json({
        success: true,
        data: {
          questions: formattedQuestions,
          targetUser: relation.targetId,
          relationType: relation.relationshipType,
          specificRelation: relation.specificRelation
        }
      });
    } catch (error) {
      console.error('获取协助问题失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new AnswerController();
