import mongoose from 'mongoose';

const assistRelationSchema = new mongoose.Schema({
  assistantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  relationshipType: {
    type: String,
    enum: ['family', 'friend'],
    required: true
  },
  specificRelation: {
    type: String,
    description: '具体关系描述（如：夫妻、母子、同事等）',
    default: ''
  },
  friendLevel: {
    type: String,
    enum: ['casual', 'close', 'intimate'],
    description: '朋友关系级别：casual(普通朋友), close(好朋友), intimate(知心好友)',
    default: 'casual'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // 答案摘要
  answerSummary: {
    hasAnswers: Boolean,
    basicAnswersCount: Number,
    emotionalAnswersCount: Number,
    lastAnswerUpdatedAt: Date
  },
  
  // 对话准则生成状态
  guidelinesGenerated: {
    type: Boolean,
    default: false
  }
});

// 复合索引：防止重复关系
assistRelationSchema.index({ assistantId: 1, targetId: 1 }, { unique: true });

// 静态方法：检查关系是否存在
assistRelationSchema.statics.hasRelation = async function(assistantId, targetId) {
  const relation = await this.findOne({ 
    assistantId, 
    targetId, 
    isActive: true 
  });
  return !!relation;
};

// 静态方法：获取用户的所有协助关系
assistRelationSchema.statics.getAssistRelations = async function(userId) {
  return this.find({ 
    assistantId: userId, 
    isActive: true 
  }).populate('targetId', 'uniqueCode email name');
};

export default mongoose.model('AssistRelation', assistRelationSchema);
