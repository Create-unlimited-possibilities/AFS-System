/**
 * 问题意义导入脚本
 *
 * 使用说明：
 * 1. 编辑 server/scripts/questions-significance-template.json
 * 2. 填写每个问题的 significance 字段（最大 200 字）
 * 3. 运行此脚本：node server/scripts/import-question-significance.js
 *
 * @author AFS Team
 * @version 1.0.0
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import Question from '../src/models/Question.js';

dotenv.config();

async function importSignificance() {
  try {
    console.log('[Import] 开始导入问题意义...');

    // 连接数据库
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongoserver:27017/afs_db');
    console.log('[Import] 数据库连接成功');

    // 读取意义文件
    const templatePath = path.join(process.cwd(), 'scripts/questions-significance-template.json');
    console.log(`[Import] 读取意义文件: ${templatePath}`);

    const significanceData = await fs.readFile(templatePath, 'utf-8');
    const questions = JSON.parse(significanceData);

    console.log(`[Import] 加载了 ${questions.length} 个问题`);

    // 验证必需字段
    const requiredFields = ['questionId', 'significance'];
    const invalidQuestions = questions.filter(q => {
      return requiredFields.some(field => !q[field]);
    });

    if (invalidQuestions.length > 0) {
      console.error(`[Import] 发现 ${invalidQuestions.length} 个无效问题：`);
      invalidQuestions.forEach(q => {
        console.error(`  - questionId: ${q.questionId}`);
      });
      process.exit(1);
    }

    // 逐个更新问题
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const item of questions) {
      try {
        // 验证 significance 字段长度
        if (item.significance && item.significance.length > 200) {
          console.warn(`[Import] ⚠️ significance 字段超过 200 字: ${item.questionId}（长度: ${item.significance.length}）`);
          // 继续处理，但记录警告
        }

        const result = await Question.findByIdAndUpdate(
          item.questionId,
          { significance: item.significance || '' },
          { new: true }  // 返回更新后的文档
        );

        if (result) {
          successCount++;
        } else {
          console.warn(`[Import] ⚠️ 问题不存在: ${item.questionId}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`[Import] ✗ 更新失败 ${item.questionId}:`, error.message);
        errors.push({ questionId: item.questionId, error: error.message });
        errorCount++;
      }
    }

    console.log('\n[Import] 导入完成！');
    console.log(`[Import] 成功: ${successCount} 条`);
    console.log(`[Import] 失败: ${errorCount} 条`);

    if (errors.length > 0) {
      console.log('\n[Import] 错误详情：');
      errors.forEach(err => {
        console.log(`  - ${err.questionId}: ${err.error}`);
      });
    }

    console.log('\n[Import] 使用建议：');
    console.log('  1. 检查 significance 字段是否正确填写（最大 200 字）');
    console.log('  2. 确保所有问题的意义都已填写');
    console.log('  3. 生成角色卡时将自动使用意义信息');

  } catch (error) {
    console.error('[Import] 导入过程中发生错误:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[Import] 数据库连接已关闭');
    process.exit(0);
  }
}

// 运行导入
importSignificance();
