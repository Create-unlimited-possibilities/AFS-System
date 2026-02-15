import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// 生成16位随机专属编号（大小写字母+数字+标点符号）
function generateUniqueCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let code = '';
  const bytes = crypto.randomBytes(16);
  for (let i = 0; i < 16; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

const userSchema = new mongoose.Schema({
  uniqueCode: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true 
  },
  name: { 
    type: String, 
    default: '用户' 
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role'
  },
  isActive: {
    type: Boolean,
    default: true
  },
createdAt: { 
    type: Date, 
    default: Date.now 
  },
  lastLogin: {
    type: Date
  },
  
  // ========== AI陪伴聊天功能 ==========
  companionChat: {
    // ========== 角色卡（个人画像） ==========
    roleCard: {
      personality: String,           // 性格特点
      background: String,           // 生活背景
      interests: [String],          // 兴趣爱好
      communicationStyle: String,    // 沟通风格
      values: [String],             // 价值观
      emotionalNeeds: [String],     // 情感需求
      lifeMilestones: [String],     // 人生里程碑
      preferences: [String],         // 偏好
      memories: [String],           // 重要记忆

      // 陌生人初始好感度（基于个人画像生成）
      strangerInitialSentiment: {
        type: Number,
        default: 50,
        min: 0,
        max: 100
      },

      // 生成相关
      generatedAt: Date,
      updatedAt: Date,
      memoryTokenCount: Number
    },

    // ========== 预处理的协助者对话准则 ==========
    assistantsGuidelines: [{
      assistantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },

      // 协助者信息
      assistantName: String,
      assistantUniqueCode: String,

      // 关系信息
      assistRelationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AssistRelation'
      },
      relationType: {
        type: String,
        enum: ['family', 'friend'],
        required: true
      },
      specificRelation: {
        type: String,
        required: true
      },

      // 对话准则（预处理的）
      conversationGuidelines: {
        type: String,
        required: true
      },

      // 压缩后的答案
      compressedAnswers: [{
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Question'
        },
        question: String,
        originalAnswer: String,
        compressed: String,
        questionLayer: {
          type: String,
          enum: ['basic', 'emotional']
        },
        compressedAt: Date
      }],

      // 生成时间
      generatedAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },

      // 状态
      isValid: { type: Boolean, default: true }
    }],

    // ========== 对话模式 ==========
    currentMode: {
      type: String,
      enum: ['mode1', 'mode2', 'mode3'],
      default: 'mode1'
    },

    // ========== 模型状态 ==========
    modelStatus: {
      hasBaseModel: { type: Boolean, default: false },
      hasSFTModel: { type: Boolean, default: false },
      hasFullModel: { type: Boolean, default: false },
      lastTrainedAt: Date,
      trainingInProgress: { type: Boolean, default: false }
    },

    // ========== 陌生人好感度存储 ==========
    strangerSentiments: [{
      strangerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },

      // 好感度分数
      currentScore: { type: Number, default: 50, min: 0, max: 100 },

      // 初始分数
      initialScore: Number,

      // 好感度历史
      history: [{
        score: Number,
        change: Number,
        reason: String,
        factors: {
          sentiment: Number,
          frequency: Number,
          quality: Number,
          decay: Number
        },
        timestamp: Date
      }],

      // 统计信息
      totalConversations: { type: Number, default: 0 },
      totalMessages: { type: Number, default: 0 },
      lastConversationAt: Date,

      // 创建时间
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }],

    // ========== 作为被对话者的对话历史 ==========
    conversationsAsTarget: [{
      sessionId: { type: String, required: true },
      interlocutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      interlocutorName: String,
      relationType: {
        type: String,
        enum: ['family', 'friend', 'stranger']
      },
      assistRelationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AssistRelation'
      },
      specificRelation: String,
      sentimentSnapshot: Number,
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
          tokenCount: Number,
          sentimentSnapshot: Number
        }
      }],
      startedAt: Date,
      endedAt: Date,
      lastMessageAt: Date,
      isActive: { type: Boolean, default: true }
    }]
  }
  
});

// 静态方法：生成唯一编号
userSchema.statics.generateUniqueCode = async function() {
  let code;
  let exists = true;
  
  while (exists) {
    code = generateUniqueCode();
    const user = await this.findOne({ uniqueCode: code });
    exists = !!user;
  }
  
  return code;
};

// 密码自动加密
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// 验证密码
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// 隐藏密码字段
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// 索引
userSchema.index({ 'companionChat.assistantsGuidelines.assistantId': 1 });
userSchema.index({ 'companionChat.strangerSentiments.strangerId': 1 });
userSchema.index({ 'companionChat.conversationsAsTarget.sessionId': 1 });

export default mongoose.model('User', userSchema);
