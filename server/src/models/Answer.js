import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  questionLayer: {
    type: String,
    enum: ['basic', 'emotional'],
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  isSelfAnswer: {
    type: Boolean,
    default: true
  },
  relationshipType: {
    type: String,
    enum: ['self', 'family', 'friend'],
    default: 'self'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 复合索引：确保同一用户对同一目标的同一问题只能回答一次
answerSchema.index({ userId: 1, targetUserId: 1, questionId: 1 }, { unique: true });

// 更新时间戳
answerSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// 静态方法：获取用户的回答进度
answerSchema.statics.getProgress = async function(userId, targetUserId, layer) {
  const Question = mongoose.model('Question');
  
  const totalQuestions = await Question.countDocuments({ layer });
  const answeredQuestions = await this.countDocuments({
    userId,
    targetUserId,
    questionLayer: layer
  });
  
  return {
    total: totalQuestions,
    answered: answeredQuestions,
    percentage: totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0
  };
};

// 静态方法：获取某人所有回答的统计
answerSchema.statics.getAnswerStats = async function(targetUserId) {
  const stats = await this.aggregate([
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
  
  return stats;
};

export default mongoose.model('Answer', answerSchema);
