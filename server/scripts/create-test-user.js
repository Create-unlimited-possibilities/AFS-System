#!/usr/bin/env node
/**
 * 创建测试用户脚本
 * 用法: node scripts/create-test-user.js
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// 简单的 User Schema（不需要导入整个模型）
const userSchema = new mongoose.Schema({
  uniqueCode: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, default: '用户' },
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
  profile: {
    gender: { type: String, enum: ['男', '女', '其他'] },
    birthDate: Date,
    birthHour: { type: Number, min: 0, max: 23 },
    birthPlace: { provinceCode: String, provinceName: String, cityCode: String, cityName: String },
    residence: { provinceCode: String, provinceName: String, cityCode: String, cityName: String },
    nationality: String,
    ethnicity: String,
    occupation: String,
    education: String,
    maritalStatus: { type: String, enum: ['未婚', '已婚', '离异', '丧偶'] },
    children: { sons: { type: Number, default: 0 }, daughters: { type: Number, default: 0 } },
    height: Number,
    appearanceFeatures: String,
    updatedAt: Date
  }
});

// 生成唯一编号
function generateUniqueCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let code = '';
  const bytes = crypto.randomBytes(16);
  for (let i = 0; i < 16; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

import crypto from 'crypto';

async function createTestUser() {
  try {
    // 使用本地端口连接（脚本在容器外运行）
    const mongoUri = process.env.MONGO_URI.replace('mongoserver:27017', 'localhost:27018');
    await mongoose.connect(mongoUri);
    console.log('MongoDB 已连接');

    const User = mongoose.model('User', userSchema);

    // 检查测试用户是否已存在
    const existingUser = await User.findOne({ email: 'test@test.com' });
    if (existingUser) {
      console.log('\n测试用户已存在:');
      console.log('  邮箱: test@test.com');
      console.log('  密码: Test123456');
      console.log('  专属编号:', existingUser.uniqueCode);
      await mongoose.disconnect();
      return;
    }

    // 创建测试用户
    const hashedPassword = await bcrypt.hash('Test123456', 10);
    const uniqueCode = generateUniqueCode();

    const testUser = new User({
      email: 'test@test.com',
      password: hashedPassword,
      name: '测试用户',
      uniqueCode,
      isActive: true,
      profile: {
        gender: '男',
        birthDate: new Date('1960-05-15'),
        birthHour: 8,
        birthPlace: { provinceCode: '11', provinceName: '北京市', cityCode: '1101', cityName: '东城区' },
        residence: { provinceCode: '11', provinceName: '北京市', cityCode: '1108', cityName: '海淀区' },
        nationality: '中国',
        ethnicity: '汉族',
        occupation: '退休教师',
        education: '大学本科',
        maritalStatus: '已婚',
        children: { sons: 1, daughters: 1 },
        height: 172
      }
    });

    await testUser.save();

    console.log('\n========================================');
    console.log('测试用户创建成功！');
    console.log('========================================');
    console.log('  邮箱: test@test.com');
    console.log('  密码: Test123456');
    console.log('  专属编号:', uniqueCode);
    console.log('========================================\n');

    await mongoose.disconnect();
    console.log('MongoDB 已断开');
  } catch (error) {
    console.error('创建测试用户失败:', error);
    process.exit(1);
  }
}

createTestUser();
