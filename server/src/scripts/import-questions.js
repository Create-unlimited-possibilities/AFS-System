// AFS-System/server/src/scripts/import-questions.js —— 永久终极版（永不报错）
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';



//# 1. 把问题文件复制到容器里正确的位置（最稳）
//docker cp mongoserver/init/questions.json afs-system-server-1:/app/questions.json

//# 2. 运行永久脚本（以后永远只跑这行！）
//docker exec -it afs-system-server-1 node /app/src/scripts/import-questions.js

// 智能寻找 questions.json 的三种可能路径（总有一个是对的！）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const POSSIBLE_PATHS = [
  // 方式1：您当前放的位置（最常用）
  '/app/questions.json',
  // 方式2：从主机复制进来的临时路径
  '/tmp/questions.json',
  // 方式3：从项目根目录映射进来的
  join(__dirname, '../../../mongoserver/init/questions.json'),
  join(__dirname, '../../../../mongoserver/init/questions.json'),
];

import Question from '../models/Question.js';
import 'dotenv/config';

async function findQuestionsFile() {
  for (const path of POSSIBLE_PATHS) {
    try {
      await fs.access(path);
      console.log(`找到问题文件：${path}`);
      return path;
    } catch {}
  }
  throw new Error('未找到 questions.json！请检查是否已复制进容器');
}

async function run() {
  try {
    console.log('正在连接 MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongoserver:27017/afsdb');
    console.log('MongoDB 连接成功！');

    const filePath = await findQuestionsFile();
    const raw = await fs.readFile(filePath, 'utf-8');
    const questions = JSON.parse(raw);

    if (!Array.isArray(questions) || questions.length === 0) {
      console.log('questions.json 为空！');
      return;
    }

    let imported = 0;
    let skipped = 0;

    for (const q of questions) {
      const exists = await Question.findOne({
        role: q.role,
        layer: q.layer,
        order: q.order
      });

      if (exists) {
        skipped++;
        continue;
      }

      await Question.create(q);
      imported++;
      console.log(`导入成功 [${q.role}-${q.layer}-${q.order}] ${q.question.substring(0, 40)}...`);
    }

    console.log('\n问题导入完成！');
    console.log(`新增：${imported} 条`);
    console.log(`跳过重复：${skipped} 条`);
    console.log(`总计：${questions.length} 条`);

  } catch (err) {
    console.error('导入失败：', err.message);
    console.error('请确保已运行：docker cp mongoserver/init/questions.json afs-system-server-1:/app/questions.json');
  } finally {
    await mongoose.disconnect();
  }
}

run();