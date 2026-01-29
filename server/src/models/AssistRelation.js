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
  createdAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
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
