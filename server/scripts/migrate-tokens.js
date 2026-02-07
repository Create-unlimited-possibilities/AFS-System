/**
 * 数据迁移脚本：重新计算所有用户的 memoryTokenCount
 * 使用 tiktoken 替代旧的计算方法
 *
 * @author AFS Team
 * @version 1.0.0
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Answer from '../src/models/Answer.js';
import User from '../src/models/User.js';
import { countTokens } from '../src/utils/tokenCounter.js';

dotenv.config();

async function migrateUserTokens() {
  try {
    console.log('[Migration] 开始迁移用户 token 数...');

    // 连接数据库
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongoserver:27017/afs_db');
    console.log('[Migration] 数据库连接成功');

    // 获取所有用户
    const users = await User.find({}).select('_id uniqueCode name');
    console.log(`[Migration] 找到 ${users.length} 个用户`);

    let successCount = 0;
    let errorCount = 0;
    let totalTokens = 0;

    for (const user of users) {
      try {
        console.log(`[Migration] 处理用户: ${user.name} (${user.uniqueCode})`);

        // 获取用户的所有答案（包括自己回答的和他人协助的）
        const answers = await Answer.find({
          targetUserId: user._id
        });

        console.log(`[Migration] 找到 ${answers.length} 个答案`);

        // 使用 tiktoken 重新计算总 token 数
        let userTokens = 0;
        for (const answer of answers) {
          userTokens += countTokens(answer.answer);
        }

        totalTokens += userTokens;

        console.log(`[Migration] 新的 token 数: ${userTokens}`);

        // 更新用户的 memoryTokenCount
        await User.findByIdAndUpdate(user._id, {
          'companionChat.roleCard.memoryTokenCount': userTokens
        });

        console.log(`[Migration] ✓ 用户 ${user.name} 迁移成功`);
        successCount++;

      } catch (error) {
        console.error(`[Migration] ✗ 用户 ${user.name} 迁移失败:`, error.message);
        errorCount++;
      }
    }

    console.log('\n[Migration] 迁移完成！');
    console.log(`[Migration] 成功: ${successCount} 个用户`);
    console.log(`[Migration] 失败: ${errorCount} 个用户`);
    console.log(`[Migration] 总 token 数: ${totalTokens}`);

  } catch (error) {
    console.error('[Migration] 迁移过程中发生错误:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[Migration] 数据库连接已关闭');
    process.exit(0);
  }
}

// 运行迁移
migrateUserTokens();
