import AnswerRepository from '../repositories/answer.js';
import QuestionRepository from '../repositories/question.js';
import UserRepository from '../../user/repository.js';
import AssistRelationRepository from '../../assist/repository.js';
import StorageService from '../../../core/storage/service.js';
import Answer from '../models/answer.js';
import { countTokens } from '../../../core/utils/tokens.js';

export default class AnswerService {
  constructor() {
    this.answerRepository = new AnswerRepository();
    this.questionRepository = new QuestionRepository();
    this.userRepository = new UserRepository();
    this.assistRelationRepository = new AssistRelationRepository();
    this.storageService = new StorageService();
  }

  async saveSelfAnswer(userId, questionId, answer) {
    const question = await this.questionRepository.findById(questionId);
    if (!question) {
      throw new Error('问题不存在');
    }

    const existingAnswer = await this.answerRepository.findOne({
      userId,
      targetUserId: userId,
      questionId
    });

    if (existingAnswer) {
      const oldTokenCount = countTokens(existingAnswer.answer);
      const newTokenCount = countTokens(answer);
      const tokenDiff = newTokenCount - oldTokenCount;

      existingAnswer.answer = answer;
      existingAnswer.updatedAt = new Date();
      await existingAnswer.save();

      await this.storageService.saveAnswer({
        userId,
        targetUserId: userId,
        questionId: question._id,
        question,
        answer,
        layer: question.layer,
        questionRole: question.role,
        questionOrder: question.order,
        helperId: null,
        helperNickname: null
      });

      // 更新 token 数（如果答案长度改变）
      if (tokenDiff !== 0) {
        await this.userRepository.findByIdAndUpdate(userId, {
          $inc: { 'companionChat.roleCard.memoryTokenCount': tokenDiff }
        });
      }

      return existingAnswer;
    }

    const newAnswer = await this.answerRepository.create({
      userId,
      targetUserId: userId,
      questionId,
      questionLayer: question.layer,
      answer,
      isSelfAnswer: true,
      assistRelationId: null,
      specificRelation: ''
    });

    await this.storageService.saveAnswer({
      userId,
      targetUserId: userId,
      questionId: question._id,
      question,
      answer,
      layer: question.layer,
      questionRole: question.role,
      questionOrder: question.order,
      helperId: null,
      helperNickname: null
    });

    const tokenCount = countTokens(answer);
    await this.userRepository.findByIdAndUpdate(userId, {
      $inc: { 'companionChat.roleCard.memoryTokenCount': tokenCount }
    });

    return newAnswer;
  }

  async saveAssistAnswer(userId, targetUserId, questionId, answer) {
    const relation = await this.assistRelationRepository.findOne({
      assistantId: userId,
      targetId: targetUserId,
      isActive: true
    });

    if (!relation) {
      throw new Error('您没有协助该用户的权限');
    }

    const question = await this.questionRepository.findById(questionId);
    if (!question) {
      throw new Error('问题不存在');
    }

    const existingAnswer = await this.answerRepository.findOne({
      userId,
      targetUserId,
      questionId
    });

    if (existingAnswer) {
      const oldTokenCount = countTokens(existingAnswer.answer);
      const newTokenCount = countTokens(answer);
      const tokenDiff = newTokenCount - oldTokenCount;

      existingAnswer.answer = answer;
      existingAnswer.assistRelationId = relation._id;
      existingAnswer.specificRelation = relation.specificRelation;
      existingAnswer.updatedAt = new Date();
      await existingAnswer.save();

      const helper = await this.userRepository.findById(userId);
      await this.storageService.saveAnswer({
        userId,
        targetUserId,
        questionId: question._id,
        question,
        answer,
        layer: question.layer,
        helperId: helper._id.toString(),
        helperNickname: helper.nickname || helper.name,
        questionRole: question.role,
        questionOrder: question.order
      });

      // 更新 token 数（如果答案长度改变）
      if (tokenDiff !== 0) {
        await this.userRepository.findByIdAndUpdate(targetUserId, {
          $inc: { 'companionChat.roleCard.memoryTokenCount': tokenDiff }
        });
      }

      return existingAnswer;
    }

    const newAnswer = await this.answerRepository.create({
      userId,
      targetUserId,
      questionId,
      questionLayer: question.layer,
      answer,
      isSelfAnswer: false,
      assistRelationId: relation._id,
      specificRelation: relation.specificRelation
    });

    const helper = await this.userRepository.findById(userId);
    await this.storageService.saveAnswer({
      userId,
      targetUserId,
      questionId: question._id,
      question,
      answer,
      layer: question.layer,
      helperId: helper._id.toString(),
      helperNickname: helper.nickname || helper.name,
      questionRole: question.role,
      questionOrder: question.order
    });

    const tokenCount = countTokens(answer);
    await this.userRepository.findByIdAndUpdate(targetUserId, {
      $inc: { 'companionChat.roleCard.memoryTokenCount': tokenCount }
    });

    return newAnswer;
  }

  async getProgress(userId, targetUserId, layer) {
    return await this.answerRepository.getProgress(userId, targetUserId, layer);
  }

  async getSelfProgress(userId) {
    const basicProgress = await this.getProgress(userId, userId, 'basic');
    const emotionalProgress = await this.getProgress(userId, userId, 'emotional');

    const totalProgress = basicProgress.total + emotionalProgress.total;
    const totalAnswered = basicProgress.answered + emotionalProgress.answered;
    const overallPercentage = totalProgress > 0
      ? Math.round((totalAnswered / totalProgress) * 100)
      : 0;

    return {
      basic: basicProgress,
      emotional: emotionalProgress,
      overall: {
        total: totalProgress,
        answered: totalAnswered,
        percentage: overallPercentage
      }
    };
  }

  async getSelfAnswers(userId, layer) {
    const query = {
      userId,
      targetUserId: userId
    };

    if (layer) {
      query.questionLayer = layer;
    }

    return await this.answerRepository.find(query);
  }

  async getAnswersFromOthers(targetUserId) {
    const answers = await this.answerRepository.findWithAssistRelation({
      targetUserId: targetUserId,
      userId: { $ne: targetUserId }
    });

    const groupedByContributor = {};
    answers.forEach(answer => {
      const contributorId = answer.userId._id.toString();
      if (!groupedByContributor[contributorId]) {
        const relationshipType = answer.assistRelationId?.relationshipType || 'unknown';
        const specificRelation = answer.assistRelationId?.specificRelation || '';
        groupedByContributor[contributorId] = {
          contributor: {
            id: answer.userId._id,
            name: answer.userId.name,
            email: answer.userId.email
          },
          relationshipType: relationshipType,
          specificRelation: specificRelation,
          answers: [],
          basicCount: 0,
          emotionalCount: 0
        };
      }

      groupedByContributor[contributorId].answers.push({
        id: answer._id,
        questionId: answer.questionId._id,
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

    return Object.values(groupedByContributor);
  }

  async getContributorAnswers(targetUserId, contributorId) {
    const answers = await this.answerRepository.find({
      userId: contributorId,
      targetUserId: targetUserId,
      isSelfAnswer: false
    });

    if (!answers || answers.length === 0) {
      return { answers: [], contributor: null };
    }

    const contributor = answers[0].userId;
    return { answers, contributor };
  }

  async batchSaveSelfAnswers(userId, answers) {
    // 首先获取所有问题的 layer 信息
    const answerDataWithLayers = [];
    for (const answerData of answers) {
      const question = await this.questionRepository.findById(answerData.questionId);
      if (!question) continue;
      answerDataWithLayers.push({
        ...answerData,
        layer: question.layer,
        questionObj: question
      });
    }

    // 按层分组答案
    const answersByLayer = {
      basic: [],
      emotional: []
    };

    for (const data of answerDataWithLayers) {
      if (answersByLayer[data.layer]) {
        answersByLayer[data.layer].push(data);
      }
    }

    // 使用 bulkWrite 进行批量替换（upsert: true）
    let totalTokenCount = 0;
    const allSavedAnswers = [];

    for (const layer of ['basic', 'emotional']) {
      const layerAnswers = answersByLayer[layer];

      if (layerAnswers.length > 0) {
        const bulkOps = [];
        
        for (const answerData of layerAnswers) {
          const question = answerData.questionObj;

          // 保存到文件系统
          await this.storageService.saveAnswer({
            userId,
            targetUserId: userId,
            questionId: question._id,
            question,
            answer: answerData.answer,
            layer: question.layer,
            questionRole: question.role,
            questionOrder: question.order,
            helperId: null,
            helperNickname: null
          });

          // 准备 bulkWrite 操作
          bulkOps.push({
            replaceOne: {
              filter: {
                userId,
                targetUserId: userId,
                questionId: question._id
              },
              replacement: {
                userId,
                targetUserId: userId,
                questionId: question._id,
                questionLayer: question.layer,
                answer: answerData.answer,
                isSelfAnswer: true,
                assistRelationId: null,
                specificRelation: '',
                updatedAt: new Date()
              },
              upsert: true
            }
          });

          totalTokenCount += countTokens(answerData.answer);
        }

        // 执行批量写入
        if (bulkOps.length > 0) {
          const result = await Answer.bulkWrite(bulkOps, { ordered: false });
          
          // 获取保存的答案（查询以返回完整文档）
          const savedAnswers = await this.answerRepository.find({
            userId,
            targetUserId: userId,
            questionLayer: layer
          });
          allSavedAnswers.push(...savedAnswers);
        }
      }
    }

    // 重新计算并更新总 token 数
    if (allSavedAnswers.length > 0) {
      const newTotalTokenCount = allSavedAnswers.reduce((sum, a) => sum + countTokens(a.answer), 0);

      await this.userRepository.findByIdAndUpdate(userId, {
        $set: { 'companionChat.roleCard.memoryTokenCount': newTotalTokenCount }
      });
    }

    return { savedCount: allSavedAnswers.length };
  }

  async batchSaveAssistAnswers(userId, targetUserId, answers) {
    const relation = await this.assistRelationRepository.findOne({
      assistantId: userId,
      targetId: targetUserId,
      isActive: true
    });

    if (!relation) {
      throw new Error('您没有协助该用户的权限');
    }

    // 首先获取所有问题的 layer 信息
    const answerDataWithLayers = [];
    for (const answerData of answers) {
      const question = await this.questionRepository.findById(answerData.questionId);
      if (!question) continue;
      answerDataWithLayers.push({
        ...answerData,
        layer: question.layer,
        questionObj: question
      });
    }

    // 按层分组答案
    const answersByLayer = {
      basic: [],
      emotional: []
    };

    for (const data of answerDataWithLayers) {
      if (answersByLayer[data.layer]) {
        answersByLayer[data.layer].push(data);
      }
    }

    // 使用 bulkWrite 进行批量替换（upsert: true）
    let totalTokenCount = 0;
    const allSavedAnswers = [];
    const helper = await this.userRepository.findById(userId);

    for (const layer of ['basic', 'emotional']) {
      const layerAnswers = answersByLayer[layer];

      if (layerAnswers.length > 0) {
        const bulkOps = [];
        
        for (const answerData of layerAnswers) {
          const question = answerData.questionObj;

          // 保存到文件系统
          await this.storageService.saveAnswer({
            userId,
            targetUserId,
            questionId: question._id,
            question,
            answer: answerData.answer,
            layer: question.layer,
            helperId: helper._id.toString(),
            helperNickname: helper.nickname || helper.name,
            questionRole: question.role,
            questionOrder: question.order
          });

          // 准备 bulkWrite 操作
          bulkOps.push({
            replaceOne: {
              filter: {
                userId,
                targetUserId,
                questionId: question._id
              },
              replacement: {
                userId,
                targetUserId,
                questionId: question._id,
                questionLayer: question.layer,
                answer: answerData.answer,
                isSelfAnswer: false,
                assistRelationId: relation._id,
                specificRelation: relation.specificRelation,
                updatedAt: new Date()
              },
              upsert: true
            }
          });

          totalTokenCount += countTokens(answerData.answer);
        }

        // 执行批量写入
        if (bulkOps.length > 0) {
          const result = await Answer.bulkWrite(bulkOps, { ordered: false });
          
          // 获取保存的答案（查询以返回完整文档）
          const savedAnswers = await this.answerRepository.find({
            userId,
            targetUserId,
            questionLayer: layer
          });
          allSavedAnswers.push(...savedAnswers);
        }
      }
    }

    // 重新计算并更新总 token 数
    if (allSavedAnswers.length > 0) {
      const newTotalTokenCount = allSavedAnswers.reduce((sum, a) => sum + countTokens(a.answer), 0);

      await this.userRepository.findByIdAndUpdate(targetUserId, {
        $set: { 'companionChat.roleCard.memoryTokenCount': newTotalTokenCount }
      });
    }

    return { savedCount: allSavedAnswers.length };
  }

  async getAssistAnswers(userId, targetUserId) {
    return await this.answerRepository.find({
      userId,
      targetUserId,
      isSelfAnswer: false
    }).populate('questionId');
  }

  async getAssistQuestions(userId, targetUserId, relationType) {
    const Question = (await import('../models/question.js')).default;
    return await Question.find({
      role: relationType,
      active: true
    }).sort({ layer: 1, order: 1 });
  }

  async deleteAssistAnswers(assistRelationId) {
    return await this.answerRepository.deleteMany({
      assistRelationId: assistRelationId
    });
  }
}
