import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import AutoHookRegistry from '../src/services/autoHookRegistry.js';
import SimpleSyncQueue from '../src/services/simpleSyncQueue.js';
import dualStorage from '../src/services/dualStorage.js';
import User from '../src/models/User.js';
import Question from '../src/models/Question.js';
import Answer from '../src/models/Answer.js';

dotenv.config();

async function testDirectHook() {
  try {
    console.log('=== Step 1: Setup ===');
    const syncQueue = new SimpleSyncQueue(dualStorage);
    SimpleSyncQueue.instance = syncQueue;
    AutoHookRegistry.syncQueueClass = SimpleSyncQueue;
    console.log('Instance exists:', !!AutoHookRegistry.syncQueueClass?.instance);

    await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongoserver:27017/afs_db');
    console.log('=== Step 2: Connected ===');

    console.log('=== Step 3: Registering hook directly on Answer model ===');
    console.log('Answer model:', Answer.modelName);
    console.log('Answer schema:', !!Answer.schema);

    Answer.schema.post('save', function(doc) {
      console.log('=== HOOK TRIGGERED ===');
      console.log('Document:', doc._id.toString());
      const syncQueueClass = AutoHookRegistry.syncQueueClass;
      if (syncQueueClass?.instance) {
        syncQueueClass.instance.enqueue(
          'Answer',
          doc._id.toString(),
          'save',
          doc
        );
      }
    });

    const user = await User.findOne({ email: 'dxs@gmail.com' });
    const question = await Question.findOne({ role: 'elder', layer: 'basic', order: 1 });

    console.log('=== Step 4: Creating answer ===');
    const answer = await Answer.create({
      userId: user._id,
      targetUserId: user._id,
      questionId: question._id,
      questionLayer: 'basic',
      answer: '测试答案内容 - direct hook',
      isSelfAnswer: true,
      relationshipType: 'self'
    });

    console.log('Answer created:', answer._id.toString());

    await new Promise(resolve => setTimeout(resolve, 1000));

    const userPath = path.join('/app/storage/userdata', user._id.toString(), 'A_set/self/basic');
    const filePath = path.join(userPath, 'question_1.json');

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      console.log('✅ FileStorage file created!');
    } catch (err) {
      console.error('❌ FileStorage file not found:', err.message);
    }

    const backupPath = path.join('/app/storage/userdata/answers', answer._id.toString(), 'answer.json');
    try {
      const content = await fs.readFile(backupPath, 'utf-8');
      console.log('✅ DualStorage backup created!');
    } catch (err) {
      console.error('❌ DualStorage backup not found:', err.message);
    }

    await mongoose.disconnect();
    console.log('=== Test completed ===');
  } catch (error) {
    console.error('=== Test failed ===');
    console.error(error);
    process.exit(1);
  }
}

testDirectHook();
