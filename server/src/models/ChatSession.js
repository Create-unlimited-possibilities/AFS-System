import mongoose from 'mongoose';

const chatSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // 目标用户（被对话者，角色卡主人）
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // 对话发起者
  interlocutorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // 关系信息
  relation: {
    type: String,
    enum: ['family', 'friend', 'stranger'],
    required: true
  },

  // 具体关系（家人/朋友）
  assistRelationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssistRelation'
  },
  specificRelation: String,

  // 陌生人好感度
  sentimentScore: {
    type: Number,
    default: 50
  },

  // 动态角色卡（每次对话时重新生成）
  dynamicRoleCard: {
    profile: {
      personality: String,
      background: String,
      interests: [String],
      communicationStyle: String
    },
    interlocutorInfo: {
      name: String,
      relation: String,
      specificRelation: String,
      nickname: String
    },
    conversationGuidelines: String,
    generatedAt: Date
  },

  // LangGraph状态
  langGraphState: {
    currentNode: String,
    stateHistory: [{
      node: String,
      timestamp: Date
    }]
  },

  // 消息历史
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant', 'system']
    },
    content: String,
    timestamp: Date,
    metadata: {
      ragUsed: Boolean,
      retrievedMemories: [mongoose.Schema.Types.Mixed],
      modelUsed: String,
      dynamicRoleCardVersion: Number,
      sentimentScore: Number
    }
  }],

  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
  lastMessageAt: Date,
  isActive: { type: Boolean, default: true }
});

// 复合索引
chatSessionSchema.index({ targetUserId: 1, interlocutorUserId: 1, isActive: 1 });
chatSessionSchema.index({ sessionId: 1, isActive: 1 });

export default mongoose.model('ChatSession', chatSessionSchema);