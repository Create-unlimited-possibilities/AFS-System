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

  // 对话周期（Conversation Cycles）
  // 每个周期代表一个独立的对话上下文
  // 当检测到结束意图时，保存记忆并开启新周期
  cycles: [{
    cycleId: {
      type: String,
      required: true
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    endedAt: Date,
    // 该周期的消息
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
    }]
  }],

  // 当前周期ID
  currentCycleId: {
    type: String,
    default: null
  },

  // 消息历史（保留用于向后兼容，实际消息存储在cycles中）
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

  // Session status for memory indexing flow
  // 'active' - normal operation
  // 'fatigue_prompt' - 60% threshold reached, showing fatigue prompt
  // 'indexing' - 70% threshold reached, forced offline for memory indexing
  sessionStatus: {
    type: String,
    enum: ['active', 'fatigue_prompt', 'indexing'],
    default: 'active',
    index: true
  },

  // When indexing started (for tracking duration)
  indexingStartedAt: {
    type: Date
  },

  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
  lastMessageAt: Date,
  isActive: { type: Boolean, default: true }
});

// 复合索引
chatSessionSchema.index({ targetUserId: 1, interlocutorUserId: 1, isActive: 1 });
chatSessionSchema.index({ sessionId: 1, isActive: 1 });
chatSessionSchema.index({ targetUserId: 1, sessionStatus: 1 });

/**
 * Static method: Set session to indexing mode
 * @param {String} sessionId - Session ID
 * @returns {Promise<Object>} Update result
 */
chatSessionSchema.statics.setIndexing = async function(sessionId) {
  return this.findOneAndUpdate(
    { sessionId },
    {
      sessionStatus: 'indexing',
      indexingStartedAt: new Date()
    },
    { new: true }
  );
};

/**
 * Static method: Set session back to active
 * @param {String} sessionId - Session ID
 * @returns {Promise<Object>} Update result
 */
chatSessionSchema.statics.setActive = async function(sessionId) {
  return this.findOneAndUpdate(
    { sessionId },
    {
      sessionStatus: 'active',
      $unset: { indexingStartedAt: '' }
    },
    { new: true }
  );
};

/**
 * Static method: Set session to fatigue prompt mode
 * @param {String} sessionId - Session ID
 * @returns {Promise<Object>} Update result
 */
chatSessionSchema.statics.setFatiguePrompt = async function(sessionId) {
  return this.findOneAndUpdate(
    { sessionId },
    { sessionStatus: 'fatigue_prompt' },
    { new: true }
  );
};

/**
 * Static method: Check if session is in indexing mode
 * @param {String} sessionId - Session ID
 * @returns {Promise<Boolean>} True if indexing
 */
chatSessionSchema.statics.isIndexing = async function(sessionId) {
  const session = await this.findOne({ sessionId });
  return session?.sessionStatus === 'indexing';
};

export default mongoose.model('ChatSession', chatSessionSchema);
