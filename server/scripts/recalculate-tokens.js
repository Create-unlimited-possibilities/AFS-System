/**
 * 重新计算用户的 memoryTokenCount
 * 用法: docker compose exec server node scripts/recalculate-tokens.js <userId>
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/modules/user/model.js';
import Answer from '../src/modules/qa/models/answer.js';
import { countTokens } from '../src/core/utils/tokens.js';

dotenv.config();

async function recalculateTokens() {
  const userId = process.argv[2];

  if (!userId) {
    console.error('请提供用户ID: node scripts/recalculate-tokens.js <userId>');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB 已连接');

    // 获取用户所有自答答案
    const answers = await Answer.find({
      userId,
      targetUserId: userId,
      isSelfAnswer: true
    });

    console.log(`找到 ${answers.length} 个自答答案`);

    // 计算总 token 数
    let totalTokens = 0;
    for (const answer of answers) {
      const tokens = countTokens(answer.answer);
      totalTokens += tokens;
      console.log(`答案 ${answer.questionId}: ${tokens} tokens`);
    }

    console.log(`\n总 Token 数: ${totalTokens}`);

    // 更新用户记录
    const result = await User.findByIdAndUpdate(
      userId,
      { $set: { 'companionChat.roleCard.memoryTokenCount': totalTokens } },
      { new: true }
    );

    if (result) {
      console.log(`\n已更新用户 ${userId} 的 memoryTokenCount 为 ${totalTokens}`);
    } else {
      console.log(`\n未找到用户 ${userId}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

recalculateTokens();
