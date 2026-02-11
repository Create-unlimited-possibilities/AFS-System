import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import User from '../src/models/User.js';
import Question from '../src/models/Question.js';
import Answer from '../src/models/Answer.js';

dotenv.config();

async function testDoubleStorage() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongoserver:27017/afs_db');
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email: 'dxs@gmail.com' });
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }

    const question = await Question.findOne({ role: 'elder', layer: 'basic', order: 1 });
    if (!question) {
      console.log('Question not found, creating...');
      const newQuestion = await Question.create({
        role: 'elder',
        layer: 'basic',
        order: 1,
        question: '测试问题1',
        active: true
      });
      console.log('Question created:', newQuestion._id);
    } else {
      console.log('Question found:', question._id);
    }

    const answer = await Answer.create({
      userId: user._id,
      targetUserId: user._id,
      questionId: question._id,
      questionLayer: 'basic',
      answer: '测试答案内容',
      isSelfAnswer: true,
      relationshipType: 'self'
    });

    console.log('Answer created:', answer._id);

    await new Promise(resolve => setTimeout(resolve, 500));

    const userPath = path.join('/app/storage/userdata', user._id.toString(), 'A_set/self/basic');
    const filePath = path.join(userPath, 'question_1.json');

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const fileData = JSON.parse(content);
      console.log('FileStorage file created successfully!');
      console.log('File path:', filePath);
      console.log('File content keys:', Object.keys(fileData));
    } catch (err) {
      console.error('FileStorage file not found:', err.message);
    }

    const backupPath = path.join('/app/storage/userdata/answers', answer._id.toString(), 'answer.json');
    try {
      const content = await fs.readFile(backupPath, 'utf-8');
      const backupData = JSON.parse(content);
      console.log('DualStorage backup created successfully!');
      console.log('Backup path:', backupPath);
      console.log('Backup content keys:', Object.keys(backupData));
    } catch (err) {
      console.error('DualStorage backup not found:', err.message);
    }

    await mongoose.disconnect();
    console.log('Test completed');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testDoubleStorage();
