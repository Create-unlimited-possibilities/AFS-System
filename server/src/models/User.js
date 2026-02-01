import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
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
createdAt: { 
    type: Date, 
    default: Date.now 
  },
  lastLogin: {
    type: Date
  },
  chatBeta: {
    memoryTokenCount: { type: Number, default: 0 },
    currentMode: { type: String, enum: ['mode1', 'mode2', 'mode3'], default: 'mode1' },
    relationships: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      relationType: { type: String, enum: ['stranger', 'family', 'friend', 'intimate', 'lover'] },
      affinityScore: { type: Number, default: 0, min: -100, max: 100 },
      specificRelation: { type: String },
      friendLevel: { type: String, enum: ['casual', 'close', 'intimate'] },
      lastInteractionDate: Date,
      isAssisted: { type: Boolean, default: false }
    }],
    roleCard: {
      selfCognition: {
        summary: String,
        traits: [String],
        vulnerabilities: [String]
      },
      familyScripts: {
        children: String,
        spouse: String
      },
      friendScripts: {
        casual: String,
        close: String,
        intimate: String
      }
    },
    modelStatus: {
      hasCustomModel: { type: Boolean, default: false },
      modelPath: String,
      trainingStatus: { type: String, enum: ['none', 'training', 'completed'], default: 'none' }
    }
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

export default mongoose.model('User', userSchema);
