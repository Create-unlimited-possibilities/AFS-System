import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Answer from '../src/models/Answer.js';
import Question from '../src/models/Question.js';
import User from '../src/models/User.js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const storagePath = path.join(projectRoot, 'server', 'storage', 'userdata');

// 使用根目录的 .env 文件
dotenv.config({ path: path.join(projectRoot, '.env') });

async function verify() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ MongoDB connected');

    // 1. Check MongoDB answers
    const totalAnswers = await Answer.countDocuments();
    console.log(`\n✓ MongoDB: ${totalAnswers} answers found`);

    // 2. Check file system
    const userdataExists = await fs.access(storagePath).then(() => true).catch(() => false);
    if (!userdataExists) {
      console.log('✗ File system: userdata directory does not exist');
    } else {
      console.log('✓ File system: userdata directory exists');

      // Check user folders
      const users = await User.find({}).limit(10);
      for (const user of users) {
        const userPath = path.join(storagePath, user._id.toString());
        const userExists = await fs.access(userPath).then(() => true).catch(() => false);

        if (userExists) {
          console.log(`  ✓ User ${user.name}: directory exists`);

          // Check A_set folder
          const asetPath = path.join(userPath, 'A_set');
          const asetExists = await fs.access(asetPath).then(() => true).catch(() => false);
          if (asetExists) {
            console.log(`    ✓ A_set folder exists`);

            // 直接从 A_set/basic 和 A_set/emotional 加载（无self子目录）
            const basicPath = path.join(asetPath, 'basic');
            const emotionalPath = path.join(asetPath, 'emotional');

            const basicFiles = await fs.readdir(basicPath).catch(() => []);
            const emotionalFiles = await fs.readdir(emotionalPath).catch(() => []);

            console.log(`      - Basic: ${basicFiles.length} files`);
            console.log(`      - Emotional: ${emotionalFiles.length} files`);
          }
        }
      }
    }

    // 3. Check layer separation
    const basicAnswers = await Answer.countDocuments({ questionLayer: 'basic' });
    const emotionalAnswers = await Answer.countDocuments({ questionLayer: 'emotional' });
    console.log(`\n✓ Layer separation:`);
    console.log(`  - Basic: ${basicAnswers} answers`);
    console.log(`  - Emotional: ${emotionalAnswers} answers`);

    // 4. Verify data consistency
    const userAnswers = await Answer.aggregate([
      { $match: { isSelfAnswer: true } },
      { $group: { _id: { userId: '$userId', layer: '$questionLayer' }, count: { $sum: 1 } } }
    ]);

    console.log(`\n✓ User answer distribution:`);
    userAnswers.forEach(item => {
      console.log(`  - User ${item._id.userId}: ${item._id.layer} = ${item.count} answers`);
    });

    console.log('\n✓ Verification complete!\n');
  } catch (error) {
    console.error('✗ Verification failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

verify();
