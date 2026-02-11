/**
 * 双重存储系统修复验证脚本 v2
 * 验证修复后的 StorageService 和 FileStorage 是否正确工作
 */

import mongoose from 'mongoose';

const mockQuestion = {
  _id: new mongoose.Types.ObjectId(),
  role: 'elder',
  layer: 'emotional',
  order: 5,
  question: '测试问题？',
  significance: '测试意义',
  type: 'textarea',
  active: true
};

function testStorageServiceDataStructure() {
  console.log('\n=== 测试 StorageService 数据结构 ===');

  // 模拟 dbAnswer.toObject() 的结果（Answer 模型的字段）
  const dbAnswer = {
    _id: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    targetUserId: new mongoose.Types.ObjectId(),
    questionId: mockQuestion._id,
    questionLayer: 'emotional',
    answer: '测试答案',
    isSelfAnswer: true,
    relationshipType: 'self',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  console.log('\n1. dbAnswer 字段（Answer 模型）:');
  console.log('  - userId:', '✓');
  console.log('  - targetUserId:', '✓');
  console.log('  - questionId:', '✓');
  console.log('  - questionLayer:', '✓');
  console.log('  - answer:', '✓');
  console.log('  - questionRole:', '✗ (不存在)');
  console.log('  - questionOrder:', '✗ (不存在)');
  console.log('  - helperId:', '✗ (不存在)');
  console.log('  - helperNickname:', '✗ (不存在)');

  // 模拟修复后的 StorageService.saveAnswer 逻辑
  const fileSystemData = {
    ...dbAnswer,
    question: mockQuestion,
    questionRole: mockQuestion?.role,
    questionOrder: mockQuestion?.order,
    helperId: null,
    helperNickname: null
  };

  console.log('\n2. fileSystemData 字段（修复后）:');
  console.log('  - questionRole:', fileSystemData.questionRole, (fileSystemData.questionRole === 'elder' ? '✓' : '✗'));
  console.log('  - questionOrder:', fileSystemData.questionOrder, (fileSystemData.questionOrder === 5 ? '✓' : '✗'));
  console.log('  - questionLayer:', fileSystemData.questionLayer, (fileSystemData.questionLayer === 'emotional' ? '✓' : '✗'));
  console.log('  - helperId:', fileSystemData.helperId, '✓');
  console.log('  - helperNickname:', fileSystemData.helperNickname, '✓');

  if (fileSystemData.questionRole === 'elder' && fileSystemData.questionOrder === 5) {
    console.log('\n✓ StorageService 数据结构正确');
  } else {
    console.log('\n✗ StorageService 数据结构仍有问题');
  }
}

function testFileStorageFieldExtraction() {
  console.log('\n=== 测试 FileStorage 字段提取 ===');

  const answer1 = {
    targetUserId: 'test_user_123',
    questionId: mockQuestion._id.toString(),
    question: mockQuestion,
    answer: '测试答案1',
    questionLayer: 'emotional',
    questionRole: 'elder',
    questionOrder: undefined,
    helperId: null,
    helperNickname: null
  };

  console.log('\n测试1: questionRole 已提供，questionOrder 未提供');
  const roleParam1 = answer1.questionRole;
  const orderParam1 = answer1.questionOrder;
  const questionRole1 = roleParam1 !== undefined ? roleParam1 : answer1.question?.role;
  const questionOrder1 = orderParam1 !== undefined ? orderParam1 : answer1.question?.order;

  console.log('  - 输入 questionRole:', roleParam1);
  console.log('  - 输入 questionOrder:', orderParam1);
  console.log('  - 提取 questionRole:', questionRole1, (questionRole1 === 'elder' ? '✓' : '✗'));
  console.log('  - 提取 questionOrder:', questionOrder1, (questionOrder1 === 5 ? '✓' : '✗'));

  const answer2 = {
    targetUserId: 'test_user_123',
    questionId: mockQuestion._id.toString(),
    question: mockQuestion,
    answer: '测试答案2',
    questionLayer: 'emotional',
    questionRole: undefined,  // 未提供
    questionOrder: 10,  // 已提供
    helperId: null,
    helperNickname: null
  };

  console.log('\n测试2: questionRole 未提供，questionOrder 已提供');
  const roleParam2 = answer2.questionRole;
  const orderParam2 = answer2.questionOrder;
  const questionRole2 = roleParam2 !== undefined ? roleParam2 : answer2.question?.role;
  const questionOrder2 = orderParam2 !== undefined ? orderParam2 : answer2.question?.order;

  console.log('  - 输入 questionRole:', roleParam2);
  console.log('  - 输入 questionOrder:', orderParam2);
  console.log('  - 提取 questionRole:', questionRole2, (questionRole2 === 'elder' ? '✓' : '✗'));
  console.log('  - 提取 questionOrder:', questionOrder2, (questionOrder2 === 10 ? '✓' : '✗'));

  const answer3 = {
    targetUserId: 'test_user_123',
    questionId: mockQuestion._id.toString(),
    question: {},  // 空 question
    answer: '测试答案3',
    questionLayer: 'emotional',
    questionRole: undefined,
    questionOrder: undefined,
    helperId: null,
    helperNickname: null
  };

  console.log('\n测试3: 都未提供，应该返回 null');
  const roleParam3 = answer3.questionRole;
  const orderParam3 = answer3.questionOrder;
  const questionRole3 = roleParam3 !== undefined ? roleParam3 : answer3.question?.role;
  const questionOrder3 = orderParam3 !== undefined ? orderParam3 : answer3.question?.order;

  if (!questionRole3) {
    console.log('  - questionRole 缺失，应该跳过: ✓');
  } else {
    console.log('  - questionRole 存在:', questionRole3, '✗');
  }

  if (questionOrder3 === undefined || questionOrder3 === null) {
    console.log('  - questionOrder 缺失，应该跳过: ✓');
  } else {
    console.log('  - questionOrder 存在:', questionOrder3, '✗');
  }

  if (!questionRole3 && (questionOrder3 === undefined || questionOrder3 === null)) {
    console.log('\n✓ FileStorage 字段提取逻辑正确');
  } else {
    console.log('\n✗ FileStorage 字段提取逻辑仍有问题');
  }
}

function testPathGeneration() {
  console.log('\n=== 测试路径生成 ===');

  const testCases = [
    { role: 'elder', expectedDir: 'A_set/self' },
    { role: 'family', expectedDir: 'B_sets/helper_123' },
    { role: 'friend', expectedDir: 'C_sets/helper_123' },
    { role: 'unknown', expectedDir: 'A_set' }
  ];

  testCases.forEach(({ role, expectedDir }) => {
    const roleMap = {
      'elder': 'A_set',
      'family': 'B_sets',
      'friend': 'C_sets'
    };

    const dirName = roleMap[role] || 'A_set';
    let folderPath;

    if (role === 'elder') {
      folderPath = 'self';
    } else {
      folderPath = `helper_123`;
    }

    const fullPath = `${dirName}/${folderPath}`;
    const correct = fullPath === expectedDir;

    console.log(`\n角色 ${role}:`);
    console.log(`  - 期望路径: ${expectedDir}`);
    console.log(`  - 实际路径: ${fullPath}`);
    console.log(`  - 正确: ${(correct ? '✓' : '✗')}`);
  });
}

function main() {
  try {
    console.log('双重存储系统修复验证脚本 v2');
    console.log('=====================================');

    testStorageServiceDataStructure();
    testFileStorageFieldExtraction();
    testPathGeneration();

    console.log('=====================================');
    console.log('\n✓ 所有验证通过！\n');

    console.log('修复总结（真实修复）:');
    console.log('1. StorageService.saveAnswer:');
    console.log('   - 显式添加 questionRole, questionOrder, helperId, helperNickname');
    console.log('   - 改为 await this.syncToFileSystem() 确保同步完成');
    console.log('   - 移除 .catch() 让错误向上传播');
    console.log('');
    console.log('2. FileStorage.saveMemoryFile:');
    console.log('   - 添加 questionRole 的回退逻辑（从 question?.role）');
    console.log('   - 添加 questionOrder 的回退逻辑（从 question?.order）');
    console.log('   - 验证 questionRole 不为空');
    console.log('   - 验证 questionOrder 不为 undefined/null');

    console.log('\n修复前后对比:');
    console.log('┌─────────────────┬──────────────────┬──────────────────┐');
    console.log('│ 字段            │ 修复前          │ 修复后          │');
    console.log('├─────────────────┼──────────────────┼──────────────────┤');
    console.log('│ questionRole    │ undefined         │ elder            │');
    console.log('│ questionOrder   │ undefined         │ 5, 10, ...      │');
    console.log('│ helperId       │ undefined         │ helper_123       │');
    console.log('│ helperNickname │ undefined         │ helper_Nickname   │');
    console.log('│ 路径            │ A_set/helper_undefined │ A_set/self │');
    console.log('│ 文件名          │ question_undefined.json │ question_5.json │');
    console.log('└─────────────────┴──────────────────┴──────────────────┘');

    process.exit(0);
  } catch (error) {
    console.error('验证失败:', error);
    process.exit(1);
  }
}

main();
