import AnswerRepository from '../repositories/AnswerRepository.js';
import QuestionRepository from '../repositories/QuestionRepository.js';
import UserRepository from '../repositories/UserRepository.js';
import AssistRelationRepository from '../repositories/AssistRelationRepository.js';
import StorageService from './storageService.js';
import { countTokens } from '../utils/tokenCounter.js';

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
        relationshipType: 'self',
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
      relationshipType: 'self'
    });

    await this.storageService.saveAnswer({
      userId,
      targetUserId: userId,
      questionId: question._id,
      question,
      answer,
      layer: question.layer,
      relationshipType: 'self',
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
        relationshipType: relation.relationshipType,
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
      relationshipType: relation.relationshipType
    });

    const helper = await this.userRepository.findById(userId);
    await this.storageService.saveAnswer({
      userId,
      targetUserId,
      questionId: question._id,
      question,
      answer,
      layer: question.layer,
      relationshipType: relation.relationshipType,
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
    const answers = await this.answerRepository.find({
      targetUserId: targetUserId,
      userId: { $ne: targetUserId }
    });

    const groupedByContributor = {};
    answers.forEach(answer => {
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
        layer: question.layer
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

    // 对每一层，先删除该层的旧答案，再插入新答案
    let totalTokenCount = 0;
    const allSavedAnswers = [];

    for (const layer of ['basic', 'emotional']) {
      const layerAnswers = answersByLayer[layer];

      if (layerAnswers.length > 0) {
        // 只删除当前层的答案
        await this.answerRepository.deleteMany({
          userId,
          targetUserId: userId,
          questionLayer: layer
        });

        const answerDocs = [];
        for (const answerData of layerAnswers) {
          const question = await this.questionRepository.findById(answerData.questionId);
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

          // 保存到文件系统
          await this.storageService.saveAnswer({
            userId,
            targetUserId: userId,
            questionId: question._id,
            question,
            answer: answerData.answer,
            layer: question.layer,
            relationshipType: 'self',
            questionRole: question.role,
            questionOrder: question.order,
            helperId: null,
            helperNickname: null
          });

          totalTokenCount += countTokens(answerData.answer);
        }

        if (answerDocs.length > 0) {
          const inserted = await this.answerRepository.insertMany(answerDocs);
          allSavedAnswers.push(...inserted);
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

    await this.answerRepository.deleteMany({ userId, targetUserId });

    const answerDocs = [];
    for (const answerData of answers) {
      const question = await this.questionRepository.findById(answerData.questionId);
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
      await this.answerRepository.insertMany(answerDocs);
    }

    let totalTokenCount = 0;
    const helper = await this.userRepository.findById(userId);
    for (const { questionId, answer } of answers) {
      const question = await this.questionRepository.findById(questionId);
      if (!question) continue;

      await this.storageService.saveAnswer({
        userId,
        targetUserId,
        questionId: question._id,
        question,
        answer,
        layer: question.layer,
        relationshipType: relation.relationshipType,
        helperId: helper._id.toString(),
        helperNickname: helper.nickname || helper.name,
        questionRole: question.role,
        questionOrder: question.order
      });
      totalTokenCount += countTokens(answer);
    }

    if (answerDocs.length > 0) {
      const allAnswers = await this.answerRepository.find({
        userId,
        targetUserId
      });
      const newTotalTokenCount = allAnswers.reduce((sum, a) => sum + countTokens(a.answer), 0);

      await this.userRepository.findByIdAndUpdate(targetUserId, {
        $set: { 'companionChat.roleCard.memoryTokenCount': newTotalTokenCount }
      });
    }

    return { savedCount: answerDocs.length };
  }
}
