/**
 * 问题意义字段迁移脚本
 * 为现有问题添加空的 significance 字段
 *
 * @author AFS Team
 * @version 1.0.0
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Question from '../src/models/Question.js';

dotenv.config();

async function migrateQuestionSignificance() {
  try {
    console.log('[Migration] 开始迁移问题意义字段...');

    // 连接数据库
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongoserver:27017/afs_db');
    console.log('[Migration] 数据库连接成功');

    // 获取所有问题
    const questions = await Question.find({});
    console.log(`[Migration] 找到 ${questions.length} 个问题`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const question of questions) {
      try {
        // 检查是否已有 significance 字段
        if (!question.significance || question.significance === undefined) {
          await Question.findByIdAndUpdate(question._id, {
            significance: ''
          });
          updatedCount++;
          console.log(`[Migration] ✓ 已更新问题: ${question.role}/${question.layer} - order ${question.order}`);
        } else {
          skippedCount++;
          console.log(`[Migration] - 跳过（已有字段）: ${question.role}/${question.layer} - order ${question.order}`);
        }
      } catch (error) {
        console.error(`[Migration] ✗ 更新失败: ${question.role}/${question.layer} - order ${question.order}`, error.message);
        errorCount++;
      }
    }

    console.log('\n[Migration] 迁移完成！');
    console.log(`[Migration] 已更新: ${updatedCount} 个问题`);
    console.log(`[Migration] 跳过: ${skippedCount} 个问题`);
    console.log(`[Migration] 失败: ${errorCount} 个问题`);

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
migrateQuestionSignificance();
