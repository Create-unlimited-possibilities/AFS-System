import Answer from '../models/Answer.js';

export default class AnswerRepository {
  async create(answerData) {
    const answer = new Answer(answerData);
    return await answer.save();
  }

  async findOne(query) {
    return await Answer.findOne(query).populate('questionId');
  }

  async find(query) {
    return await Answer.find(query)
      .populate('questionId')
      .populate('userId', 'name email uniqueCode')
      .sort({ createdAt: -1 });
  }

  async findOneAndUpdate(query, update, options = {}) {
    return await Answer.findOneAndUpdate(query, update, options);
  }

  async deleteMany(query) {
    return await Answer.deleteMany(query);
  }

  async countDocuments(query) {
    return await Answer.countDocuments(query);
  }

  async getProgress(userId, targetUserId, layer) {
    const Question = (await import('../models/Question.js')).default;

    const totalQuestions = await Question.countDocuments({
      role: 'elder',
      layer,
      active: true
    });

    const answeredQuestions = await this.countDocuments({
      userId,
      targetUserId: userId,
      questionLayer: layer,
      isSelfAnswer: true
    });

    return {
      total: totalQuestions,
      answered: answeredQuestions,
      percentage: totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0
    };
  }

  async getAnswerStats(targetUserId) {
    return await Answer.aggregate([
      { $match: { targetUserId: new mongoose.Types.ObjectId(targetUserId) } },
      {
        $group: {
          _id: {
            userId: '$userId',
            relationshipType: '$relationshipType',
            questionLayer: '$questionLayer'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: {
            userId: '$_id.userId',
            relationshipType: '$_id.relationshipType'
          },
          layers: {
            $push: {
              layer: '$_id.questionLayer',
              count: '$count'
            }
          },
          totalAnswers: { $sum: '$count' }
        }
      }
    ]);
  }
}
