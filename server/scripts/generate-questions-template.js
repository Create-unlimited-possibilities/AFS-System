/**
 * 问题模板生成脚本
 * 从数据库导出所有问题，生成 significance 模板文件
 *
 * 使用说明：
 * 1. 运行脚本：node server/scripts/generate-questions-template.js
 * 2. 编辑生成的模板文件：server/scripts/questions-significance-template.json
 * 3. 填写每个问题的 significance 字段（最大 200 字）
 * 4. 运行导入脚本：node server/scripts/import-question-significance.js
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

async function generateTemplate() {
  try {
    console.log('[Template] 开始生成问题模板...');

    // 连接数据库
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongoserver:27017/afs_db');
    console.log('[Template] 数据库连接成功');

    // 获取所有问题
    const questions = await Question.find({ active: true })
      .sort({ role: 1, layer: 1, order: 1 });

    console.log(`[Template] 找到 ${questions.length} 个问题`);

    // 转换为模板格式
    const template = questions.map(q => ({
      questionId: q._id.toString(),
      role: q.role,
      layer: q.layer,
      order: q.order,
      question: q.question,
      significance: ''  // 初始为空，等待用户填写
    }));

    // 保存模板文件
    const outputPath = path.join(process.cwd(), 'scripts/questions-significance-template.json');
    await fs.writeFile(outputPath, JSON.stringify(template, null, 2), 'utf-8');

    console.log(`[Template] 模板文件已保存: ${outputPath}`);
    console.log(`[Template] 文件大小: ${(JSON.stringify(template, null, 2).length / 1024).toFixed(2)} KB`);

    // 按角色和层次统计
    const stats = {
      'A套-基础层 (elder/basic)': template.filter(q => q.role === 'elder' && q.layer === 'basic').length,
      'A套-情感层 (elder/emotional)': template.filter(q => q.role === 'elder' && q.layer === 'emotional').length,
      'B套-基础层 (family/basic)': template.filter(q => q.role === 'family' && q.layer === 'basic').length,
      'B套-情感层 (family/emotional)': template.filter(q => q.role === 'family' && q.layer === 'emotional').length,
      'C套-基础层 (friend/basic)': template.filter(q => q.role === 'friend' && q.layer === 'basic').length,
      'C套-情感层 (friend/emotional)': template.filter(q => q.role === 'friend' && q.layer === 'emotional').length,
      '总计': template.length
    };

    console.log('\n[Template] 问题统计：');
    Object.entries(stats).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    console.log('\n[Template] 下一步：');
    console.log('  1. 编辑模板文件：server/scripts/questions-significance-template.json');
    console.log('  2. 填写每个问题的 significance 字段（最大 200 字）');
    console.log('  3. 运行导入脚本：node server/scripts/import-question-significance.js');

  } catch (error) {
    console.error('[Template] 生成模板过程中发生错误:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[Template] 数据库连接已关闭');
    process.exit(0);
  }
}

// 运行生成
generateTemplate();
