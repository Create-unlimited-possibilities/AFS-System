import mongoose from 'mongoose';

async function checkUserData() {
  try {
    console.log('=== MongoDB 快速检查 ===');

    // 尝试连接到 MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/afs_db', {
      serverSelectionTimeoutMS: 5000
    }).then(async () => {
      console.log('✓ MongoDB 连接成功');

      const User = mongoose.model('User');
      const user = await User.findOne({ email: 'dxs@gmail.com' }).maxTimeMS(5000);

      if (!user) {
        console.log('✗ 未找到用户 dxs@gmail.com');
        process.exit(0);
      }

      const userId = user._id;
      console.log('用户信息:');
      console.log('  ID:', userId.toString());
      console.log('  Email:', user.email);

      const Answer = mongoose.model('Answer', new mongoose.Schema({
        userId: mongoose.Schema.Types.ObjectId,
        targetUserId: mongoose.Schema.Types.ObjectId,
        questionId: mongoose.Schema.Types.ObjectId,
        questionLayer: String,
        answer: String,
        isSelfAnswer: Boolean,
        relationshipType: String,
        createdAt: Date,
        updatedAt: Date
      }));

      // 并行查询 basic 和 emotional
      const [basicCount, emotionalCount] = await Promise.all([
        Answer.countDocuments({
          userId,
          targetUserId: userId,
          questionLayer: 'basic',
          isSelfAnswer: true
        }).maxTimeMS(3000),
        Answer.countDocuments({
          userId,
          targetUserId: userId,
          questionLayer: 'emotional',
          isSelfAnswer: true
        }).maxTimeMS(3000)
      ]);

      console.log('\n=== 答案统计 ===');
      console.log(`Basic 层: ${basicCount} 个答案`);
      console.log(`Emotional 层: ${emotionalCount} 个答案`);
      console.log(`总计: ${basicCount + emotionalCount} 个答案`);

      if (basicCount > 0 || emotionalCount > 0) {
        console.log('\n前5个 Basic 答案:');
        const basicAnswers = await Answer.find({
          userId,
          targetUserId: userId,
          questionLayer: 'basic',
          isSelfAnswer: true
        }).limit(5).sort({ createdAt: -1 }).maxTimeMS(3000);

        basicAnswers.forEach((ans, idx) => {
          console.log(`  ${idx + 1}. 问题ID: ${ans.questionId?.toString() || 'N/A'}, 答案长度: ${ans.answer?.length || 0}`);
        });

        console.log('\n前5个 Emotional 答案:');
        const emotionalAnswers = await Answer.find({
          userId,
          targetUserId: userId,
          questionLayer: 'emotional',
          isSelfAnswer: true
        }).limit(5).sort({ createdAt: -1 }).maxTimeMS(3000);

        emotionalAnswers.forEach((ans, idx) => {
          console.log(`  ${idx + 1}. 问题ID: ${ans.questionId?.toString() || 'N/A'}, 答案长度: ${ans.answer?.length || 0}`);
        });
      }

      await mongoose.disconnect();
      console.log('\n✓ MongoDB 连接已关闭');

    } catch (error) {
      console.error('✗ 检查失败:', error.message);
      process.exit(1);
    }
}

checkUserData();
