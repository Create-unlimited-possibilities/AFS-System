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
      relationshipType: 'self'
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
      helper
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
    await this.answerRepository.deleteMany({
      userId,
      targetUserId: userId
    });

    const answerDocs = [];
    const memoryUpdates = [];

    for (const answerData of answers) {
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

      memoryUpdates.push({ question, answer: answerData.answer });
    }

    if (answerDocs.length > 0) {
      await this.answerRepository.create(answerDocs[0]);
    }

    let totalTokenCount = 0;
    for (const { question, answer } of memoryUpdates) {
      await this.storageService.saveAnswer({
        userId,
        targetUserId: userId,
        questionId: question._id,
        question,
        answer,
        layer: question.layer,
        relationshipType: 'self'
      });
      totalTokenCount += countTokens(answer);
    }

    if (totalTokenCount > 0) {
      await this.userRepository.findByIdAndUpdate(userId, {
        $inc: { 'companionChat.roleCard.memoryTokenCount': totalTokenCount }
      });
    }

    return { savedCount: answerDocs.length };
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
      await this.answerRepository.create(answerDocs[0]);
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
        helper
      });
      totalTokenCount += countTokens(answer);
    }

    if (totalTokenCount > 0) {
      await this.userRepository.findByIdAndUpdate(targetUserId, {
        $inc: { 'companionChat.roleCard.memoryTokenCount': totalTokenCount }
      });
    }

    return { savedCount: answerDocs.length };
  }
}
