import mongoose from 'mongoose';

async function checkUserData() {
  try {
    console.log('=== MongoDB 答案数据检查 ===\n');

    // 连接数据库
    await mongoose.connect('mongodb://mongoserver:27017/afs_db', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✓ MongoDB 连接成功\n');

    // 定义 Answer 模型
    const answerSchema = new mongoose.Schema({
      userId: mongoose.Schema.Types.ObjectId,
      targetUserId: mongoose.Schema.Types.ObjectId,
      questionId: mongoose.Schema.Types.ObjectId,
      questionLayer: String,
      answer: String,
      isSelfAnswer: Boolean,
      relationshipType: String,
      createdAt: Date,
      updatedAt: Date
    });

    const Answer = mongoose.model('Answer', answerSchema);
    const User = mongoose.model('User', new mongoose.Schema({
      email: String
    }));

    // 查找用户
    const user = await User.findOne({ email: 'dxs@gmail.com' });
    if (!user) {
      console.log('✗ 未找到用户 dxs@gmail.com');
      await mongoose.connection.close();
      process.exit(1);
    }

    const userId = user._id;
    console.log('用户信息:');
    console.log('  - ID:', userId.toString());
    console.log('  - Email:', user.email);
    console.log('');

    // 统计 basic 层答案
    const basicAnswers = await Answer.find({
      userId: userId,
      targetUserId: userId,
      questionLayer: 'basic',
      isSelfAnswer: true
    }).sort({ createdAt: 1 });

    console.log('=== Basic 层答案 ===');
    console.log('  数量:', basicAnswers.length);
    if (basicAnswers.length > 0) {
      console.log('  前5个问题ID:');
      basicAnswers.slice(0, 5).forEach((ans, idx) => {
        console.log(`    ${idx + 1}. ${ans.questionId?.toString() || 'N/A'} (答案长度: ${ans.answer?.length || 0})`);
      });
    }
    console.log('');

    // 统计 emotional 层答案
    const emotionalAnswers = await Answer.find({
      userId: userId,
      targetUserId: userId,
      questionLayer: 'emotional',
      isSelfAnswer: true
    }).sort({ createdAt: 1 });

    console.log('=== Emotional 层答案 ===');
    console.log('  数量:', emotionalAnswers.length);
    if (emotionalAnswers.length > 0) {
      console.log('  前5个问题ID:');
      emotionalAnswers.slice(0, 5).forEach((ans, idx) => {
        console.log(`    ${idx + 1}. ${ans.questionId?.toString() || 'N/A'} (答案长度: ${ans.answer?.length || 0})`);
      });
    }
    console.log('');

    // 检查是否有重复
    const allAnswers = [...basicAnswers, ...emotionalAnswers];
    const questionIds = allAnswers.map(a => a.questionId?.toString());
    const uniqueIds = new Set(questionIds);
    const duplicates = questionIds.filter((id, index) => questionIds.indexOf(id) !== index);

    if (duplicates.length > 0) {
      console.log('=== 检测到重复的问题ID ===');
      console.log('  重复数量:', duplicates.length);
      console.log('  重复ID:', [...new Set(duplicates)].slice(0, 10).join(', '));
      console.log('');
    }

    // 查找 Question 表，查看总共有多少题
    const Question = mongoose.model('Question', new mongoose.Schema({
      role: String,
      layer: String,
      order: Number
    }));

    const basicTotal = await Question.countDocuments({
      role: 'elder',
      layer: 'basic',
      active: true
    });

    const emotionalTotal = await Question.countDocuments({
      role: 'elder',
      layer: 'emotional',
      active: true
    });

    console.log('=== Question 表统计 ===');
    console.log('  Basic 层总题数:', basicTotal);
    console.log('  Emotional 层总题数:', emotionalTotal);
    console.log('  Basic 层已完成:', `${basicAnswers.length}/${basicTotal} (${Math.round(basicAnswers.length/basicTotal*100)}%)`);
    console.log('  Emotional 层已完成:', `${emotionalAnswers.length}/${emotionalTotal} (${Math.round(emotionalAnswers.length/emotionalTotal*100)}%)`);
    console.log('');

    // 检查答案的详细信息（第一个和最后一个）
    if (basicAnswers.length > 0) {
      console.log('=== Basic 层示例答案 ===');
      const firstBasic = basicAnswers[0];
      const lastBasic = basicAnswers[basicAnswers.length - 1];
      console.log('  第一个答案:');
      console.log('    问题ID:', firstBasic.questionId?.toString());
      console.log('    层级:', firstBasic.questionLayer);
      console.log('    答案长度:', firstBasic.answer?.length);
      console.log('    创建时间:', firstBasic.createdAt);
      console.log('  最后一个答案:');
      console.log('    问题ID:', lastBasic.questionId?.toString());
      console.log('    层级:', lastBasic.questionLayer);
      console.log('    答案长度:', lastBasic.answer?.length);
      console.log('    创建时间:', lastBasic.createdAt);
      console.log('');
    }

    if (emotionalAnswers.length > 0) {
      console.log('=== Emotional 层示例答案 ===');
      const firstEmo = emotionalAnswers[0];
      const lastEmo = emotionalAnswers[emotionalAnswers.length - 1];
      console.log('  第一个答案:');
      console.log('    问题ID:', firstEmo.questionId?.toString());
      console.log('    层级:', firstEmo.questionLayer);
      console.log('    答案长度:', firstEmo.answer?.length);
      console.log('    创建时间:', firstEmo.createdAt);
      console.log('  最后一个答案:');
      console.log('    问题ID:', lastEmo.questionId?.toString());
      console.log('    层级:', lastEmo.questionLayer);
      console.log('    答案长度:', lastEmo.answer?.length);
      console.log('');
    }

    // 关闭连接
    await mongoose.connection.close();
    console.log('✓ MongoDB 连接已关闭\n');

  } catch (error) {
    console.error('✗ 查询失败:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

checkUserData();
